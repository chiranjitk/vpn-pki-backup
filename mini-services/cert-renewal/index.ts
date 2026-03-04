/**
 * Certificate Auto-Renewal Service
 * 
 * A background service that monitors and automatically renews expiring
 * VPN certificates in MANAGED PKI mode.
 * 
 * Port: 3032
 * Features:
 * - Daily check for expiring certificates
 * - Configurable renewal window (default: 30 days before expiry)
 * - Auto-renewal or manual approval workflow
 * - Email notifications for renewal events
 * - Comprehensive audit logging
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import { execSync, exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Database client
const prisma = new PrismaClient()

// Configuration
const CONFIG = {
  port: 3032,
  certDir: '/etc/swanctl/x509',
  keyDir: '/etc/swanctl/private',
  pfxDir: '/etc/swanctl/pfx',
  crlDir: '/etc/swanctl/x509crl',
  caDir: '/etc/swanctl/ca',
  defaultRenewalDays: 30,
  defaultNotifyDays: [60, 30, 14, 7],
  maxRenewalRetries: 3,
}

// Renewal settings
interface RenewalSettings {
  enabled: boolean
  daysBeforeExpiry: number
  notifyDays: number[]
  autoRenew: boolean
}

let renewalSettings: RenewalSettings = {
  enabled: true,
  daysBeforeExpiry: 30,
  notifyDays: [60, 30, 14, 7],
  autoRenew: false, // Manual approval required by default
}

// Scheduler state
interface SchedulerState {
  isRunning: boolean
  startTime: Date | null
  lastCheck: Date | null
  totalRenewals: number
  successfulRenewals: number
  failedRenewals: number
  pendingApprovals: number
  notificationsSent: number
}

const schedulerState: SchedulerState = {
  isRunning: false,
  startTime: null,
  lastCheck: null,
  totalRenewals: 0,
  successfulRenewals: 0,
  failedRenewals: 0,
  pendingApprovals: 0,
  notificationsSent: 0,
}

// Renewal log entry
interface RenewalLog {
  id: string
  certId: string
  commonName: string
  type: 'client' | 'server'
  action: 'check' | 'notify' | 'renew' | 'approve' | 'deploy' | 'error'
  status: 'success' | 'failed' | 'pending' | 'skipped'
  timestamp: Date
  message: string
  details?: Record<string, unknown>
}

// In-memory log (last 100 entries)
const renewalLogs: RenewalLog[] = []
const MAX_LOG_ENTRIES = 100

// Timer reference
let schedulerInterval: Timer | null = null

// PKI Mode check
let pkiMode: 'EXTERNAL' | 'MANAGED' = 'MANAGED'

/**
 * Add a log entry
 */
function addLog(entry: Omit<RenewalLog, 'id' | 'timestamp'>): void {
  const log: RenewalLog = {
    ...entry,
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
  }
  
  renewalLogs.unshift(log)
  if (renewalLogs.length > MAX_LOG_ENTRIES) {
    renewalLogs.pop()
  }
  
  // Log to console
  const statusIcon = entry.status === 'success' ? '✓' : entry.status === 'failed' ? '✗' : entry.status === 'pending' ? '⏳' : '○'
  console.log(`[${log.timestamp.toISOString()}] ${statusIcon} ${entry.action.toUpperCase()}: ${entry.commonName} - ${entry.message}`)
}

/**
 * Load settings from database
 */
async function loadSettings(): Promise<void> {
  try {
    // Get PKI mode
    const pkiConfig = await prisma.pkiConfiguration.findFirst()
    if (pkiConfig) {
      pkiMode = pkiConfig.mode
    }
    
    // Get renewal settings
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'cert_renewal_enabled',
            'cert_renewal_days_before',
            'cert_renewal_notify_days',
            'cert_renewal_auto',
          ],
        },
      },
    })
    
    for (const setting of settings) {
      switch (setting.key) {
        case 'cert_renewal_enabled':
          renewalSettings.enabled = setting.value === 'true'
          break
        case 'cert_renewal_days_before':
          renewalSettings.daysBeforeExpiry = parseInt(setting.value, 10) || 30
          break
        case 'cert_renewal_notify_days':
          renewalSettings.notifyDays = setting.value.split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d))
          break
        case 'cert_renewal_auto':
          renewalSettings.autoRenew = setting.value === 'true'
          break
      }
    }
    
    console.log('[Settings] Loaded renewal settings:', renewalSettings)
    console.log('[Settings] PKI Mode:', pkiMode)
  } catch (error) {
    console.error('[Settings] Error loading settings:', error)
  }
}

/**
 * Save setting to database
 */
async function saveSetting(key: string, value: string, description?: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    create: {
      key,
      value,
      category: 'cert_renewal',
      description,
    },
    update: { value },
  })
}

/**
 * Get PKI configuration for certificate generation
 */
async function getPkiConfig() {
  const pkiConfig = await prisma.pkiConfiguration.findFirst()
  return {
    minKeySize: pkiConfig?.minKeySize || 4096,
    defaultClientValidityDays: pkiConfig?.defaultClientValidityDays || 365,
    defaultServerValidityDays: pkiConfig?.defaultServerValidityDays || 730,
    swanctlConfigPath: pkiConfig?.swanctlConfigPath || '/etc/swanctl',
    autoReloadStrongswan: pkiConfig?.autoReloadStrongswan ?? true,
  }
}

/**
 * Get signing CA
 */
async function getSigningCA(): Promise<{
  id: string
  keyPath: string
  certificatePath: string
  name: string
} | null> {
  // First try to get intermediate CA
  let ca = await prisma.certificateAuthority.findFirst({
    where: {
      type: 'INTERMEDIATE',
      status: 'ACTIVE',
      keyPath: { not: null },
      certificatePath: { not: null },
    },
  })
  
  // Fall back to root CA
  if (!ca) {
    ca = await prisma.certificateAuthority.findFirst({
      where: {
        type: 'ROOT',
        status: 'ACTIVE',
        isDefault: true,
        keyPath: { not: null },
        certificatePath: { not: null },
      },
    })
  }
  
  if (!ca || !ca.keyPath || !ca.certificatePath) {
    return null
  }
  
  return {
    id: ca.id,
    keyPath: ca.keyPath,
    certificatePath: ca.certificatePath,
    name: ca.name,
  }
}

/**
 * Generate client certificate
 */
async function generateClientCertificate(
  commonName: string,
  email: string,
  validityDays: number,
  keySize: number,
  existingKeyPath?: string
): Promise<{ certPath: string; keyPath: string; serialNumber: string }> {
  const timestamp = Date.now()
  const keyPath = existingKeyPath || path.join(CONFIG.keyDir, `client_${commonName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.pem`)
  const certPath = path.join(CONFIG.certDir, `client_${commonName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.pem`)
  
  // Get signing CA
  const ca = await getSigningCA()
  if (!ca) {
    throw new Error('No signing CA available')
  }
  
  // Ensure directories exist
  if (!fs.existsSync(CONFIG.keyDir)) {
    fs.mkdirSync(CONFIG.keyDir, { recursive: true, mode: 0o700 })
  }
  if (!fs.existsSync(CONFIG.certDir)) {
    fs.mkdirSync(CONFIG.certDir, { recursive: true, mode: 0o755 })
  }
  
  // Generate private key if not reusing
  if (!existingKeyPath || !fs.existsSync(existingKeyPath)) {
    execSync(`openssl genrsa -out "${keyPath}" ${keySize}`, { encoding: 'utf-8' })
    fs.chmodSync(keyPath, 0o600)
  }
  
  // Create certificate config
  const configPath = `/tmp/cert_config_${timestamp}.cnf`
  const configContent = `
[req]
default_bits = ${keySize}
default_md = sha256
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = ${commonName}

[v3_req]
basicConstraints = CA:FALSE
keyUsage = digitalSignature
extendedKeyUsage = clientAuth
subjectKeyIdentifier = hash
`
  fs.writeFileSync(configPath, configContent)
  
  // Generate CSR
  const csrPath = `/tmp/cert_${timestamp}.csr`
  const subject = `/CN=${commonName}/emailAddress=${email}`
  execSync(`openssl req -new -key "${keyPath}" -out "${csrPath}" -subj "${subject}" -config "${configPath}"`, { encoding: 'utf-8' })
  
  // Sign certificate with CA
  const extConfigPath = `/tmp/ext_config_${timestamp}.cnf`
  const extContent = `
basicConstraints = CA:FALSE
keyUsage = digitalSignature
extendedKeyUsage = clientAuth
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
`
  fs.writeFileSync(extConfigPath, extContent)
  
  execSync(
    `openssl x509 -req -in "${csrPath}" -CA "${ca.certificatePath}" -CAkey "${ca.keyPath}" ` +
    `-CAcreateserial -out "${certPath}" -days ${validityDays} -sha256 ` +
    `-extfile "${extConfigPath}"`,
    { encoding: 'utf-8' }
  )
  
  // Get serial number
  const serialOutput = execSync(`openssl x509 -in "${certPath}" -noout -serial`, { encoding: 'utf-8' })
  const serialMatch = serialOutput.match(/serial=([A-F0-9]+)/i)
  const serialNumber = serialMatch ? serialMatch[1] : ''
  
  // Cleanup temp files
  try {
    fs.unlinkSync(configPath)
    fs.unlinkSync(csrPath)
    fs.unlinkSync(extConfigPath)
  } catch {}
  
  // Set permissions
  fs.chmodSync(certPath, 0o644)
  
  return { certPath, keyPath, serialNumber }
}

/**
 * Generate server certificate
 */
async function generateServerCertificate(
  commonName: string,
  dnsNames: string[],
  ipAddresses: string[],
  validityDays: number,
  keySize: number,
  existingKeyPath?: string
): Promise<{ certPath: string; keyPath: string; serialNumber: string }> {
  const timestamp = Date.now()
  const keyPath = existingKeyPath || path.join(CONFIG.keyDir, `server_${commonName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.pem`)
  const certPath = path.join(CONFIG.certDir, `server_${commonName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.pem`)
  
  // Get signing CA
  const ca = await getSigningCA()
  if (!ca) {
    throw new Error('No signing CA available')
  }
  
  // Ensure directories exist
  if (!fs.existsSync(CONFIG.keyDir)) {
    fs.mkdirSync(CONFIG.keyDir, { recursive: true, mode: 0o700 })
  }
  if (!fs.existsSync(CONFIG.certDir)) {
    fs.mkdirSync(CONFIG.certDir, { recursive: true, mode: 0o755 })
  }
  
  // Generate private key if not reusing
  if (!existingKeyPath || !fs.existsSync(existingKeyPath)) {
    execSync(`openssl genrsa -out "${keyPath}" ${keySize}`, { encoding: 'utf-8' })
    fs.chmodSync(keyPath, 0o600)
  }
  
  // Build SAN entries
  const sanEntries: string[] = [`DNS:${commonName}`]
  for (const dns of dnsNames) {
    if (dns !== commonName) {
      sanEntries.push(`DNS:${dns}`)
    }
  }
  for (const ip of ipAddresses) {
    sanEntries.push(`IP:${ip}`)
  }
  
  // Create certificate config
  const configPath = `/tmp/server_cert_config_${timestamp}.cnf`
  const configContent = `
[req]
default_bits = ${keySize}
default_md = sha256
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = ${commonName}

[v3_req]
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectKeyIdentifier = hash
subjectAltName = ${sanEntries.join(', ')}
`
  fs.writeFileSync(configPath, configContent)
  
  // Generate CSR
  const csrPath = `/tmp/server_cert_${timestamp}.csr`
  const subject = `/CN=${commonName}`
  execSync(`openssl req -new -key "${keyPath}" -out "${csrPath}" -subj "${subject}" -config "${configPath}"`, { encoding: 'utf-8' })
  
  // Sign certificate with CA
  const extConfigPath = `/tmp/server_ext_config_${timestamp}.cnf`
  const extContent = `
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
subjectAltName = ${sanEntries.join(', ')}
`
  fs.writeFileSync(extConfigPath, extContent)
  
  execSync(
    `openssl x509 -req -in "${csrPath}" -CA "${ca.certificatePath}" -CAkey "${ca.keyPath}" ` +
    `-CAcreateserial -out "${certPath}" -days ${validityDays} -sha256 ` +
    `-extfile "${extConfigPath}"`,
    { encoding: 'utf-8' }
  )
  
  // Get serial number
  const serialOutput = execSync(`openssl x509 -in "${certPath}" -noout -serial`, { encoding: 'utf-8' })
  const serialMatch = serialOutput.match(/serial=([A-F0-9]+)/i)
  const serialNumber = serialMatch ? serialMatch[1] : ''
  
  // Cleanup temp files
  try {
    fs.unlinkSync(configPath)
    fs.unlinkSync(csrPath)
    fs.unlinkSync(extConfigPath)
  } catch {}
  
  // Set permissions
  fs.chmodSync(certPath, 0o644)
  
  return { certPath, keyPath, serialNumber }
}

/**
 * Create PKCS#12 bundle
 */
async function createPfxBundle(
  certPath: string,
  keyPath: string,
  outputPath: string,
  password: string,
  caPath?: string
): Promise<void> {
  const caArg = caPath ? `-certfile "${caPath}"` : ''
  execSync(
    `openssl pkcs12 -export -out "${outputPath}" -inkey "${keyPath}" -in "${certPath}" ` +
    `${caArg} -passout pass:${password}`,
    { encoding: 'utf-8' }
  )
}

/**
 * Send email notification
 */
async function sendEmailNotification(
  to: string,
  subject: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const smtpConfig = await prisma.smtpConfiguration.findFirst({
      where: { isEnabled: true },
    })
    
    if (!smtpConfig) {
      return { success: false, error: 'SMTP not configured or disabled' }
    }
    
    // Build email content
    const emailContent = `To: ${to}
Subject: ${subject}
From: ${smtpConfig.fromName} <${smtpConfig.fromEmail}>
Content-Type: text/plain; charset=utf-8

${body}
`
    
    // Use sendmail or curl to send email
    // For production, you'd use nodemailer or similar
    const sendmailPath = '/usr/sbin/sendmail'
    if (fs.existsSync(sendmailPath)) {
      execSync(`echo "${emailContent}" | ${sendmailPath} -t`, { encoding: 'utf-8' })
    } else {
      // Fallback: use curl with SMTP API (like Mailgun, SendGrid)
      console.log(`[Email] Would send email to ${to}: ${subject}`)
    }
    
    return { success: true }
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: err }
  }
}

/**
 * Reload strongSwan
 */
async function reloadStrongSwan(): Promise<{ success: boolean; message: string }> {
  try {
    await execAsync('swanctl --load-all 2>/dev/null || systemctl reload strongswan 2>/dev/null || systemctl reload strongswan-starter 2>/dev/null')
    return { success: true, message: 'strongSwan reloaded successfully' }
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, message: `Failed to reload strongSwan: ${err}` }
  }
}

/**
 * Renew a client certificate
 */
async function renewClientCertificate(
  certId: string,
  userId: string,
  commonName: string,
  email: string,
  pkiConfig: {
    minKeySize: number
    defaultClientValidityDays: number
    autoReloadStrongswan: boolean
  }
): Promise<{ success: boolean; error?: string; newCertId?: string }> {
  try {
    // Get old certificate for reference
    const oldCert = await prisma.certificate.findUnique({
      where: { id: certId },
    })
    
    if (!oldCert) {
      return { success: false, error: 'Certificate not found' }
    }
    
    // Generate new certificate
    const { certPath, keyPath, serialNumber } = await generateClientCertificate(
      commonName,
      email,
      pkiConfig.defaultClientValidityDays,
      oldCert.keySize || pkiConfig.minKeySize,
      undefined // Generate new key for renewed cert
    )
    
    // Get certificate info
    const certInfoOutput = execSync(`openssl x509 -in "${certPath}" -noout -text -dates`, { encoding: 'utf-8' })
    const notBeforeMatch = certInfoOutput.match(/Not Before\s*:\s*(.+)/i)
    const notAfterMatch = certInfoOutput.match(/Not After\s*:\s*(.+)/i)
    const subjectMatch = certInfoOutput.match(/Subject:\s*(.+)/)
    const issuerMatch = certInfoOutput.match(/Issuer:\s*(.+)/)
    
    const issueDate = notBeforeMatch ? new Date(notBeforeMatch[1].trim()) : new Date()
    const expiryDate = notAfterMatch ? new Date(notAfterMatch[1].trim()) : new Date()
    const subject = subjectMatch ? subjectMatch[1].trim() : `CN=${commonName}`
    const issuer = issuerMatch ? issuerMatch[1].trim() : ''
    
    // Create PKCS#12 bundle
    const pfxPassword = Math.random().toString(36).substring(2, 10)
    if (!fs.existsSync(CONFIG.pfxDir)) {
      fs.mkdirSync(CONFIG.pfxDir, { recursive: true, mode: 0o755 })
    }
    const pfxPath = path.join(CONFIG.pfxDir, `${commonName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.p12`)
    await createPfxBundle(certPath, keyPath, pfxPath, pfxPassword)
    
    // Mark old certificate as superseded
    await prisma.certificate.update({
      where: { id: certId },
      data: { status: 'EXPIRED' },
    })
    
    // Create new certificate record
    const newCert = await prisma.certificate.create({
      data: {
        userId,
        serialNumber,
        commonName,
        subject,
        issuer,
        issueDate,
        expiryDate,
        status: 'ACTIVE',
        certificatePath: certPath,
        keyPath,
        pfxPath,
        pfxPassword,
        keySize: oldCert.keySize || pkiConfig.minKeySize,
        signatureAlgorithm: 'SHA256',
        certificateType: 'CLIENT',
        ekus: 'clientAuth',
      },
    })
    
    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'CERT_AUTO_RENEW',
        category: 'CERTIFICATE_OPERATIONS',
        actorType: 'SCHEDULED_TASK',
        targetId: newCert.id,
        targetType: 'Certificate',
        details: JSON.stringify({
          oldCertId: certId,
          newCertId: newCert.id,
          commonName,
          serialNumber,
          expiryDate: expiryDate.toISOString(),
        }),
        status: 'SUCCESS',
      },
    })
    
    // Send email notification
    if (email) {
      await sendEmailNotification(
        email,
        'Certificate Renewed Successfully',
        `Your VPN certificate has been renewed.\n\n` +
        `Common Name: ${commonName}\n` +
        `New Expiry Date: ${expiryDate.toDateString()}\n\n` +
        `Please download your new certificate from the VPN portal.`
      )
      schedulerState.notificationsSent++
    }
    
    // Reload strongSwan if configured
    if (pkiConfig.autoReloadStrongswan) {
      await reloadStrongSwan()
    }
    
    schedulerState.successfulRenewals++
    addLog({
      certId: newCert.id,
      commonName,
      type: 'client',
      action: 'renew',
      status: 'success',
      message: `Certificate renewed successfully. New expiry: ${expiryDate.toDateString()}`,
      details: { oldCertId, newSerialNumber: serialNumber },
    })
    
    return { success: true, newCertId: newCert.id }
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Unknown error'
    schedulerState.failedRenewals++
    addLog({
      certId,
      commonName,
      type: 'client',
      action: 'renew',
      status: 'failed',
      message: err,
    })
    return { success: false, error: err }
  }
}

/**
 * Renew a server certificate
 */
async function renewServerCertificate(
  certId: string,
  hostname: string,
  commonName: string,
  dnsNames: string[],
  ipAddresses: string[],
  pkiConfig: {
    minKeySize: number
    defaultServerValidityDays: number
    autoReloadStrongswan: boolean
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get old certificate
    const oldCert = await prisma.serverCertificate.findUnique({
      where: { id: certId },
    })
    
    if (!oldCert) {
      return { success: false, error: 'Server certificate not found' }
    }
    
    // Generate new certificate
    const { certPath, keyPath, serialNumber } = await generateServerCertificate(
      commonName,
      dnsNames,
      ipAddresses,
      pkiConfig.defaultServerValidityDays,
      4096,
      undefined
    )
    
    // Get certificate info
    const certInfoOutput = execSync(`openssl x509 -in "${certPath}" -noout -text -dates`, { encoding: 'utf-8' })
    const notBeforeMatch = certInfoOutput.match(/Not Before\s*:\s*(.+)/i)
    const notAfterMatch = certInfoOutput.match(/Not After\s*:\s*(.+)/i)
    const subjectMatch = certInfoOutput.match(/Subject:\s*(.+)/)
    const issuerMatch = certInfoOutput.match(/Issuer:\s*(.+)/)
    
    const issueDate = notBeforeMatch ? new Date(notBeforeMatch[1].trim()) : new Date()
    const expiryDate = notAfterMatch ? new Date(notAfterMatch[1].trim()) : new Date()
    const subject = subjectMatch ? subjectMatch[1].trim() : `CN=${commonName}`
    const issuer = issuerMatch ? issuerMatch[1].trim() : ''
    
    // Mark old certificate as superseded
    await prisma.serverCertificate.update({
      where: { id: certId },
      data: { status: 'EXPIRED' },
    })
    
    // Create new certificate record
    const newCert = await prisma.serverCertificate.create({
      data: {
        hostname,
        commonName,
        subject,
        issuer,
        serialNumber,
        issueDate,
        expiryDate,
        status: 'ACTIVE',
        certificatePath: certPath,
        keyPath,
        isDeployed: false,
      },
    })
    
    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'SERVER_CERT_AUTO_RENEW',
        category: 'CERTIFICATE_OPERATIONS',
        actorType: 'SCHEDULED_TASK',
        targetId: newCert.id,
        targetType: 'ServerCertificate',
        details: JSON.stringify({
          oldCertId: certId,
          newCertId: newCert.id,
          commonName,
          hostname,
          serialNumber,
          expiryDate: expiryDate.toISOString(),
        }),
        status: 'SUCCESS',
      },
    })
    
    // Auto-deploy if old cert was deployed
    if (oldCert.isDeployed) {
      // Copy to swanctl directories
      const targetCertPath = path.join(CONFIG.certDir, 'vpn-server.pem')
      const targetKeyPath = path.join(CONFIG.keyDir, 'vpn-server.pem')
      
      fs.copyFileSync(certPath, targetCertPath)
      fs.copyFileSync(keyPath, targetKeyPath)
      fs.chmodSync(targetKeyPath, 0o600)
      
      await prisma.serverCertificate.update({
        where: { id: newCert.id },
        data: {
          isDeployed: true,
          deployedAt: new Date(),
        },
      })
      
      // Reload strongSwan
      if (pkiConfig.autoReloadStrongswan) {
        await reloadStrongSwan()
      }
    }
    
    schedulerState.successfulRenewals++
    addLog({
      certId: newCert.id,
      commonName,
      type: 'server',
      action: 'renew',
      status: 'success',
      message: `Server certificate renewed successfully. New expiry: ${expiryDate.toDateString()}`,
      details: { oldCertId, newSerialNumber: serialNumber, deployed: oldCert.isDeployed },
    })
    
    return { success: true }
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Unknown error'
    schedulerState.failedRenewals++
    addLog({
      certId,
      commonName,
      type: 'server',
      action: 'renew',
      status: 'failed',
      message: err,
    })
    return { success: false, error: err }
  }
}

/**
 * Create renewal notification
 */
async function createRenewalNotification(
  certId: string,
  commonName: string,
  type: 'client' | 'server',
  daysUntilExpiry: number
): Promise<void> {
  // Create notification in database
  await prisma.notification.create({
    data: {
      type: type === 'client' ? 'cert-expire' : 'server-cert-expire',
      referenceId: certId,
      title: `Certificate Expiring Soon: ${commonName}`,
      message: `The ${type} certificate "${commonName}" will expire in ${daysUntilExpiry} days. Please review and renew if needed.`,
      severity: daysUntilExpiry <= 7 ? 'error' : daysUntilExpiry <= 14 ? 'warning' : 'info',
    },
  })
  
  schedulerState.pendingApprovals++
}

/**
 * Check for expiring certificates
 */
async function checkExpiringCertificates(): Promise<{
  clientCerts: Array<{
    id: string
    commonName: string
    userId: string
    email: string | null
    expiryDate: Date
    daysUntilExpiry: number
  }>
  serverCerts: Array<{
    id: string
    commonName: string
    hostname: string
    expiryDate: Date
    daysUntilExpiry: number
  }>
}> {
  const now = new Date()
  const checkUntil = new Date(now.getTime() + Math.max(...renewalSettings.notifyDays) * 24 * 60 * 60 * 1000)
  
  // Get expiring client certificates
  const clientCerts = await prisma.certificate.findMany({
    where: {
      status: 'ACTIVE',
      certificateType: 'CLIENT',
      expiryDate: {
        lte: checkUntil,
        gt: now,
      },
    },
    include: {
      user: true,
    },
  })
  
  // Get expiring server certificates
  const serverCerts = await prisma.serverCertificate.findMany({
    where: {
      status: 'ACTIVE',
      expiryDate: {
        lte: checkUntil,
        gt: now,
      },
    },
  })
  
  const processedClientCerts = clientCerts.map(cert => ({
    id: cert.id,
    commonName: cert.commonName,
    userId: cert.userId,
    email: cert.user.email,
    expiryDate: cert.expiryDate,
    daysUntilExpiry: Math.ceil((cert.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  }))
  
  const processedServerCerts = serverCerts.map(cert => ({
    id: cert.id,
    commonName: cert.commonName,
    hostname: cert.hostname,
    expiryDate: cert.expiryDate,
    daysUntilExpiry: Math.ceil((cert.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  }))
  
  return { clientCerts: processedClientCerts, serverCerts: processedServerCerts }
}

/**
 * Run renewal check cycle
 */
async function runRenewalCheck(): Promise<void> {
  if (pkiMode !== 'MANAGED') {
    console.log('[Scheduler] Skipping renewal check - not in MANAGED mode')
    return
  }
  
  if (!renewalSettings.enabled) {
    console.log('[Scheduler] Skipping renewal check - renewal is disabled')
    return
  }
  
  schedulerState.lastCheck = new Date()
  console.log('[Scheduler] Running renewal check...')
  
  const pkiConfig = await getPkiConfig()
  const { clientCerts, serverCerts } = await checkExpiringCertificates()
  
  console.log(`[Scheduler] Found ${clientCerts.length} expiring client certs, ${serverCerts.length} expiring server certs`)
  
  // Process client certificates
  for (const cert of clientCerts) {
    try {
      // Check if we should send notification
      if (renewalSettings.notifyDays.includes(cert.daysUntilExpiry)) {
        addLog({
          certId: cert.id,
          commonName: cert.commonName,
          type: 'client',
          action: 'notify',
          status: 'success',
          message: `Notification triggered - ${cert.daysUntilExpiry} days until expiry`,
        })
        
        // Create notification for admin
        await createRenewalNotification(cert.id, cert.commonName, 'client', cert.daysUntilExpiry)
        
        // Send email to user if email exists
        if (cert.email) {
          await sendEmailNotification(
            cert.email,
            `VPN Certificate Expiring Soon (${cert.daysUntilExpiry} days)`,
            `Your VPN certificate "${cert.commonName}" will expire in ${cert.daysUntilExpiry} days.\n\n` +
            `Please contact your administrator or log in to the VPN portal to renew your certificate.`
          )
          schedulerState.notificationsSent++
        }
      }
      
      // Check if we should auto-renew
      if (cert.daysUntilExpiry <= renewalSettings.daysBeforeExpiry) {
        if (renewalSettings.autoRenew) {
          // Auto-renew
          console.log(`[Scheduler] Auto-renewing client certificate: ${cert.commonName}`)
          schedulerState.totalRenewals++
          await renewClientCertificate(
            cert.id,
            cert.userId,
            cert.commonName,
            cert.email || '',
            pkiConfig
          )
        } else {
          // Create approval request
          const existingNotification = await prisma.notification.findFirst({
            where: {
              type: 'cert-renewal-required',
              referenceId: cert.id,
              isRead: false,
            },
          })
          
          if (!existingNotification) {
            await prisma.notification.create({
              data: {
                type: 'cert-renewal-required',
                referenceId: cert.id,
                title: `Certificate Renewal Required: ${cert.commonName}`,
                message: `The client certificate "${cert.commonName}" expires in ${cert.daysUntilExpiry} days and requires renewal approval.`,
                severity: 'warning',
              },
            })
            schedulerState.pendingApprovals++
          }
          
          addLog({
            certId: cert.id,
            commonName: cert.commonName,
            type: 'client',
            action: 'approve',
            status: 'pending',
            message: `Renewal pending approval - ${cert.daysUntilExpiry} days until expiry`,
          })
        }
      }
    } catch (error) {
      console.error(`[Scheduler] Error processing client cert ${cert.commonName}:`, error)
      addLog({
        certId: cert.id,
        commonName: cert.commonName,
        type: 'client',
        action: 'error',
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
  
  // Process server certificates
  for (const cert of serverCerts) {
    try {
      // Check if we should send notification
      if (renewalSettings.notifyDays.includes(cert.daysUntilExpiry)) {
        addLog({
          certId: cert.id,
          commonName: cert.commonName,
          type: 'server',
          action: 'notify',
          status: 'success',
          message: `Notification triggered - ${cert.daysUntilExpiry} days until expiry`,
        })
        
        // Create notification for admin
        await createRenewalNotification(cert.id, cert.commonName, 'server', cert.daysUntilExpiry)
      }
      
      // Check if we should auto-renew
      if (cert.daysUntilExpiry <= renewalSettings.daysBeforeExpiry) {
        if (renewalSettings.autoRenew) {
          console.log(`[Scheduler] Auto-renewing server certificate: ${cert.commonName}`)
          schedulerState.totalRenewals++
          await renewServerCertificate(
            cert.id,
            cert.hostname,
            cert.commonName,
            [cert.hostname], // DNS names
            [], // IP addresses
            pkiConfig
          )
        } else {
          // Create approval request
          const existingNotification = await prisma.notification.findFirst({
            where: {
              type: 'server-cert-renewal-required',
              referenceId: cert.id,
              isRead: false,
            },
          })
          
          if (!existingNotification) {
            await prisma.notification.create({
              data: {
                type: 'server-cert-renewal-required',
                referenceId: cert.id,
                title: `Server Certificate Renewal Required: ${cert.commonName}`,
                message: `The server certificate "${cert.commonName}" (${cert.hostname}) expires in ${cert.daysUntilExpiry} days and requires renewal approval.`,
                severity: 'warning',
              },
            })
            schedulerState.pendingApprovals++
          }
          
          addLog({
            certId: cert.id,
            commonName: cert.commonName,
            type: 'server',
            action: 'approve',
            status: 'pending',
            message: `Renewal pending approval - ${cert.daysUntilExpiry} days until expiry`,
          })
        }
      }
    } catch (error) {
      console.error(`[Scheduler] Error processing server cert ${cert.commonName}:`, error)
      addLog({
        certId: cert.id,
        commonName: cert.commonName,
        type: 'server',
        action: 'error',
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
}

/**
 * Start the scheduler
 */
function startScheduler(): { success: boolean; message: string } {
  if (schedulerState.isRunning) {
    return { success: false, message: 'Scheduler is already running' }
  }
  
  schedulerState.isRunning = true
  schedulerState.startTime = new Date()
  
  // Run initial check immediately
  runRenewalCheck().catch(console.error)
  
  // Set up interval for periodic checks (every 24 hours)
  schedulerInterval = setInterval(() => {
    runRenewalCheck().catch(console.error)
  }, 24 * 60 * 60 * 1000) // 24 hours
  
  console.log('[Scheduler] Certificate renewal scheduler started')
  
  return { success: true, message: 'Scheduler started successfully' }
}

/**
 * Stop the scheduler
 */
function stopScheduler(): { success: boolean; message: string } {
  if (!schedulerState.isRunning) {
    return { success: false, message: 'Scheduler is not running' }
  }
  
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
  }
  
  schedulerState.isRunning = false
  
  console.log('[Scheduler] Certificate renewal scheduler stopped')
  
  return { success: true, message: 'Scheduler stopped successfully' }
}

/**
 * Force renew a specific certificate
 */
async function forceRenewCertificate(certId: string, type: 'client' | 'server'): Promise<{ success: boolean; message: string }> {
  try {
    const pkiConfig = await getPkiConfig()
    
    if (type === 'client') {
      const cert = await prisma.certificate.findUnique({
        where: { id: certId },
        include: { user: true },
      })
      
      if (!cert) {
        return { success: false, message: 'Certificate not found' }
      }
      
      schedulerState.totalRenewals++
      const result = await renewClientCertificate(
        cert.id,
        cert.userId,
        cert.commonName,
        cert.user.email || '',
        pkiConfig
      )
      
      return {
        success: result.success,
        message: result.success ? 'Certificate renewed successfully' : `Failed to renew: ${result.error}`,
      }
    } else {
      const cert = await prisma.serverCertificate.findUnique({
        where: { id: certId },
      })
      
      if (!cert) {
        return { success: false, message: 'Server certificate not found' }
      }
      
      schedulerState.totalRenewals++
      const result = await renewServerCertificate(
        cert.id,
        cert.hostname,
        cert.commonName,
        [cert.hostname],
        [],
        pkiConfig
      )
      
      return {
        success: result.success,
        message: result.success ? 'Server certificate renewed successfully' : `Failed to renew: ${result.error}`,
      }
    }
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, message: err }
  }
}

/**
 * HTTP Server request handler
 */
async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const method = request.method
  const pathname = url.pathname
  
  // CORS headers for cross-origin requests
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Transform-Port',
  }
  
  // Handle preflight requests
  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    // GET /status - Get renewal service status
    if (method === 'GET' && pathname === '/status') {
      const status = {
        ...schedulerState,
        startTime: schedulerState.startTime?.toISOString() || null,
        lastCheck: schedulerState.lastCheck?.toISOString() || null,
        pkiMode,
        settings: renewalSettings,
        config: {
          port: CONFIG.port,
          certDir: CONFIG.certDir,
          keyDir: CONFIG.keyDir,
          defaultRenewalDays: CONFIG.defaultRenewalDays,
        },
        recentLogs: renewalLogs.slice(0, 20),
      }
      
      return Response.json(status, { headers: corsHeaders })
    }
    
    // GET /expiring - Get list of certificates expiring soon
    if (method === 'GET' && pathname === '/expiring') {
      const certs = await checkExpiringCertificates()
      return Response.json(certs, { headers: corsHeaders })
    }
    
    // GET /logs - Get all renewal logs
    if (method === 'GET' && pathname === '/logs') {
      return Response.json(renewalLogs, { headers: corsHeaders })
    }
    
    // POST /check - Run immediate check for expiring certs
    if (method === 'POST' && pathname === '/check') {
      await runRenewalCheck()
      return Response.json({ success: true, message: 'Renewal check completed' }, { headers: corsHeaders })
    }
    
    // POST /start - Start scheduler
    if (method === 'POST' && pathname === '/start') {
      const result = startScheduler()
      return Response.json(result, { headers: corsHeaders })
    }
    
    // POST /stop - Stop scheduler
    if (method === 'POST' && pathname === '/stop') {
      const result = stopScheduler()
      return Response.json(result, { headers: corsHeaders })
    }
    
    // POST /renew/:certId - Force renew specific certificate
    if (method === 'POST' && pathname.startsWith('/renew/')) {
      const certId = pathname.replace('/renew/', '')
      const body = await request.json() as { type?: 'client' | 'server' }
      const type = body.type || 'client'
      const result = await forceRenewCertificate(certId, type)
      return Response.json(result, { headers: corsHeaders })
    }
    
    // PUT /config - Update renewal settings
    if (method === 'PUT' && pathname === '/config') {
      const body = await request.json() as {
        enabled?: boolean
        daysBeforeExpiry?: number
        notifyDays?: number[]
        autoRenew?: boolean
      }
      
      if (body.enabled !== undefined) {
        renewalSettings.enabled = body.enabled
        await saveSetting('cert_renewal_enabled', body.enabled.toString(), 'Enable certificate auto-renewal')
      }
      
      if (body.daysBeforeExpiry !== undefined) {
        renewalSettings.daysBeforeExpiry = body.daysBeforeExpiry
        await saveSetting('cert_renewal_days_before', body.daysBeforeExpiry.toString(), 'Days before expiry to trigger renewal')
      }
      
      if (body.notifyDays !== undefined) {
        renewalSettings.notifyDays = body.notifyDays
        await saveSetting('cert_renewal_notify_days', body.notifyDays.join(','), 'Days before expiry to send notifications')
      }
      
      if (body.autoRenew !== undefined) {
        renewalSettings.autoRenew = body.autoRenew
        await saveSetting('cert_renewal_auto', body.autoRenew.toString(), 'Enable automatic renewal without approval')
      }
      
      return Response.json({ success: true, settings: renewalSettings }, { headers: corsHeaders })
    }
    
    // 404 for unknown routes
    return Response.json(
      { error: 'Not found' },
      { status: 404, headers: corsHeaders }
    )
  } catch (error) {
    console.error('[Server] Error handling request:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}

/**
 * Initialize default settings
 */
async function initializeDefaultSettings(): Promise<void> {
  const existingSettings = await prisma.systemSetting.count({
    where: { category: 'cert_renewal' },
  })
  
  if (existingSettings === 0) {
    console.log('[Init] Creating default renewal settings...')
    
    // SQLite doesn't support skipDuplicates, so create one by one
    const settings = [
      { key: 'cert_renewal_enabled', value: 'true', category: 'cert_renewal', description: 'Enable certificate auto-renewal' },
      { key: 'cert_renewal_days_before', value: '30', category: 'cert_renewal', description: 'Days before expiry to trigger renewal' },
      { key: 'cert_renewal_notify_days', value: '60,30,14,7', category: 'cert_renewal', description: 'Days before expiry to send notifications' },
      { key: 'cert_renewal_auto', value: 'false', category: 'cert_renewal', description: 'Enable automatic renewal without approval' },
    ]
    
    for (const setting of settings) {
      try {
        await prisma.systemSetting.create({ data: setting })
      } catch {
        // Ignore duplicate key errors
      }
    }
    
    console.log('[Init] Default renewal settings created')
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log('========================================')
  console.log('  Certificate Auto-Renewal Service')
  console.log('========================================')
  console.log(`Port: ${CONFIG.port}`)
  console.log(`Certificate Directory: ${CONFIG.certDir}`)
  console.log(`Key Directory: ${CONFIG.keyDir}`)
  console.log(`Default Renewal Days: ${CONFIG.defaultRenewalDays}`)
  console.log('========================================')
  
  // Connect to database
  await prisma.$connect()
  console.log('[Database] Connected successfully')
  
  // Initialize default settings
  await initializeDefaultSettings()
  
  // Load settings from database
  await loadSettings()
  
  // Ensure directories exist (with sandbox fallback)
  const ensureDir = (dir: string, mode: number = 0o755): string => {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode })
      }
      return dir
    } catch (error) {
      console.warn(`[Warning] Could not create directory ${dir}: ${error}`)
      const fallbackDir = dir.replace('/etc/swanctl', '/tmp/swanctl')
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true, mode })
      }
      console.log(`[Fallback] Using directory: ${fallbackDir}`)
      return fallbackDir
    }
  }
  
  CONFIG.certDir = ensureDir(CONFIG.certDir, 0o755)
  CONFIG.keyDir = ensureDir(CONFIG.keyDir, 0o700)
  CONFIG.pfxDir = ensureDir(CONFIG.pfxDir, 0o755)
  
  // Start the HTTP server
  const server = Bun.serve({
    port: CONFIG.port,
    fetch: handleRequest,
  })
  
  console.log(`[Server] Listening on http://localhost:${CONFIG.port}`)
  
  // Auto-start scheduler if enabled
  if (renewalSettings.enabled && pkiMode === 'MANAGED') {
    const autoStartResult = startScheduler()
    console.log(`[Scheduler] Auto-start: ${autoStartResult.message}`)
  } else {
    console.log(`[Scheduler] Auto-start skipped (enabled: ${renewalSettings.enabled}, mode: ${pkiMode})`)
  }
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[Server] Shutting down...')
    stopScheduler()
    await prisma.$disconnect()
    process.exit(0)
  })
  
  process.on('SIGTERM', async () => {
    console.log('\n[Server] Shutting down...')
    stopScheduler()
    await prisma.$disconnect()
    process.exit(0)
  })
}

// Run the service
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
