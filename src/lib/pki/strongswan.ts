/**
 * strongSwan VPN Integration Layer
 * Manages configuration and certificate deployment for strongSwan 6.0.1
 * 
 * IMPORTANT: For IKEv2 EAP-TLS to work properly:
 * - CA certificates MUST be in /etc/swanctl/x509ca/ (trusted root CAs)
 * - Server/end-entity certificates in /etc/swanctl/x509/
 * - Private keys in /etc/swanctl/private/
 * - CRL files in /etc/swanctl/x509crl/
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync, exec } from 'child_process'
import { promisify } from 'util'
<<<<<<< HEAD
import { getPKIPaths } from './config'

const execAsync = promisify(exec)

/**
 * Get strongSwan paths (uses configurable paths from PKI config)
 * In development/demo, uses home directory paths
 * In production, uses system paths like /etc/swanctl
 */
export function getStrongSwanPaths() {
  const pkiPaths = getPKIPaths()
  return {
    swanctlDir: pkiPaths.swanctlBase,

    // CA certificates - CRITICAL: This is where trusted CAs go for client cert verification
    x509caDir: pkiPaths.caCertsPath,

    // End entity certificates (server certs, NOT CA certs)
    x509Dir: pkiPaths.swanctlX509Path,

    // Private keys
    privateDir: pkiPaths.swanctlPrivatePath,

    // CRL files
    crlDir: pkiPaths.swanctlCrlPath,

    // Configuration
    confDir: `${pkiPaths.swanctlBase}/conf.d`,
    swanctlConf: pkiPaths.swanctlConfPath,
    strongswanConf: '/etc/strongswan.conf',

    // Legacy ipsec.d (not used in modern strongSwan)
    ipsecD: '/etc/ipsec.d',
  }
}

// Legacy export for backward compatibility (uses dynamic paths)
export const STRONGSWAN_PATHS = {
  get swanctlDir() { return getStrongSwanPaths().swanctlDir },
  get x509caDir() { return getStrongSwanPaths().x509caDir },
  get x509Dir() { return getStrongSwanPaths().x509Dir },
  get privateDir() { return getStrongSwanPaths().privateDir },
  get crlDir() { return getStrongSwanPaths().crlDir },
  get confDir() { return getStrongSwanPaths().confDir },
  get swanctlConf() { return getStrongSwanPaths().swanctlConf },
  get strongswanConf() { return getStrongSwanPaths().strongswanConf },
  get ipsecD() { return getStrongSwanPaths().ipsecD },
=======

const execAsync = promisify(exec)

// strongSwan 6.0.1 standard paths
export const STRONGSWAN_PATHS = {
  swanctlDir: '/etc/swanctl',
  
  // CA certificates - CRITICAL: This is where trusted CAs go for client cert verification
  x509caDir: '/etc/swanctl/x509ca',
  
  // End entity certificates (server certs, NOT CA certs)
  x509Dir: '/etc/swanctl/x509',
  
  // Private keys
  privateDir: '/etc/swanctl/private',
  
  // CRL files
  crlDir: '/etc/swanctl/x509crl',
  
  // Configuration
  confDir: '/etc/swanctl/conf.d',
  swanctlConf: '/etc/swanctl/swanctl.conf',
  strongswanConf: '/etc/strongswan.conf',
  
  // Legacy ipsec.d (not used in modern strongSwan)
  ipsecD: '/etc/ipsec.d',
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
}

// Connection Configuration
export interface IKEv2Connection {
  name: string
  localAddrs: string[]
  remoteAddrs: string[]
  localCert: string
  localKey: string
  caCerts: string[]
  espProposals: string[]
  ikeProposals: string[]
  children: IKEv2ChildSA[]
}

export interface IKEv2ChildSA {
  name: string
  espProposals: string[]
  localTs: string[]
  remoteTs: string[]
  mode: 'tunnel' | 'transport'
  policies: string[]
}

// VPN Service Status
export interface VPNServiceStatus {
  running: boolean
  uptime?: number
  activeConnections: number
  lastReload?: Date
  lastError?: string
  version: string
}

/**
 * Check if strongSwan is installed
 */
export function isStrongSwanInstalled(): boolean {
  try {
    execSync('which swanctl', { encoding: 'utf-8' })
    return true
  } catch {
    return false
  }
}

/**
 * Get strongSwan version
 */
export function getStrongSwanVersion(): string {
  try {
    const result = execSync('swanctl --version', { encoding: 'utf-8' })
    return result.trim()
  } catch {
    return 'Not installed'
  }
}

/**
 * Get VPN service status
 */
export async function getVPNStatus(): Promise<VPNServiceStatus> {
  try {
    // Check if service is running (try both service names)
    let statusOutput = ''
    try {
      const result = await execAsync('systemctl is-active strongswan 2>/dev/null || echo "inactive"')
      statusOutput = result.stdout
    } catch {
      const result = await execAsync('systemctl is-active strongswan-starter 2>/dev/null || echo "inactive"')
      statusOutput = result.stdout
    }
    const running = statusOutput.trim() === 'active'
    
<<<<<<< HEAD
    // Get active connections count using swanctl --list-sas
    // Parse the output to count actual IKE SAs (lines with IKEv2)
    let activeConnections = 0
    try {
      const { stdout: listOutput } = await execAsync('swanctl --list-sas 2>/dev/null || echo ""')
      // Count lines that match main IKE SA pattern: "connection-name: #N, STATE, IKEv2"
      // NOT child SA lines like "  net: #N, reqid..."
      const ikeSaMatches = listOutput.match(/^\S+:\s*#\d+,\s*\w+,\s*IKEv2/gm)
      activeConnections = ikeSaMatches ? ikeSaMatches.length : 0
=======
    // Get active connections count
    let activeConnections = 0
    try {
      const { stdout: listOutput } = await execAsync('swanctl --list-sas 2>/dev/null || echo ""')
      // Count unique connection names
      const connections = listOutput.match(/\[\d+\]/g) || []
      activeConnections = connections.length
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
    } catch {
      activeConnections = 0
    }
    
    // Get uptime
    let uptime: number | undefined
    if (running) {
      try {
        let uptimeOutput = ''
        try {
          const result = await execAsync(
            'systemctl show strongswan --property=ActiveEnterTimestamp 2>/dev/null | cut -d= -f2'
          )
          uptimeOutput = result.stdout
        } catch {
          const result = await execAsync(
            'systemctl show strongswan-starter --property=ActiveEnterTimestamp 2>/dev/null | cut -d= -f2'
          )
          uptimeOutput = result.stdout
        }
        if (uptimeOutput.trim()) {
          const startTime = new Date(uptimeOutput.trim())
          uptime = Math.floor((Date.now() - startTime.getTime()) / 1000)
        }
      } catch {
        // Ignore errors
      }
    }
    
    return {
      running,
      uptime,
      activeConnections,
      version: getStrongSwanVersion(),
    }
  } catch (error: unknown) {
    const execError = error as { message?: string }
    return {
      running: false,
      activeConnections: 0,
      lastError: execError.message,
      version: 'Unknown',
    }
  }
}

/**
 * Reload strongSwan configuration
 */
export async function reloadStrongSwan(): Promise<{ success: boolean; message: string }> {
  try {
    await execAsync('swanctl --load-all')
    return { success: true, message: 'strongSwan configuration reloaded successfully' }
  } catch (error: unknown) {
    const execError = error as { stderr?: string; message?: string }
    return { 
      success: false, 
      message: `Failed to reload: ${execError.stderr || execError.message}` 
    }
  }
}

/**
 * Restart strongSwan service
 */
export async function restartStrongSwan(): Promise<{ success: boolean; message: string }> {
  try {
    // Try strongswan first, then strongswan-starter
    try {
      await execAsync('systemctl restart strongswan')
    } catch {
      await execAsync('systemctl restart strongswan-starter')
    }
    return { success: true, message: 'strongSwan service restarted successfully' }
  } catch (error: unknown) {
    const execError = error as { stderr?: string; message?: string }
    return { 
      success: false, 
      message: `Failed to restart: ${execError.stderr || execError.message}` 
    }
  }
}

/**
 * Ensure all strongSwan directories exist with correct permissions
 */
export function ensureStrongSwanDirs(): void {
<<<<<<< HEAD
  const paths = getStrongSwanPaths()
  const dirs = [
    { path: paths.swanctlDir, mode: 0o755 },
    { path: paths.x509caDir, mode: 0o755 },   // CA certs - world readable
    { path: paths.x509Dir, mode: 0o755 },     // Server certs - world readable
    { path: paths.privateDir, mode: 0o700 },  // Private keys - more restrictive
    { path: paths.crlDir, mode: 0o755 },      // CRLs - world readable
    { path: paths.confDir, mode: 0o755 },
=======
  const dirs = [
    { path: STRONGSWAN_PATHS.swanctlDir, mode: 0o755 },
    { path: STRONGSWAN_PATHS.x509caDir, mode: 0o755 },   // CA certs - world readable
    { path: STRONGSWAN_PATHS.x509Dir, mode: 0o755 },     // Server certs - world readable
    { path: STRONGSWAN_PATHS.privateDir, mode: 0o700 },  // Private keys - root only
    { path: STRONGSWAN_PATHS.crlDir, mode: 0o755 },      // CRLs - world readable
    { path: STRONGSWAN_PATHS.confDir, mode: 0o755 },
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  ]
  
  dirs.forEach(({ path: dir, mode }) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode })
    }
  })
}

/**
 * Validate PEM certificate format
 */
export function validatePEMCertificate(certPath: string): { valid: boolean; error?: string } {
  try {
    if (!fs.existsSync(certPath)) {
      return { valid: false, error: 'File does not exist' }
    }
    
    const content = fs.readFileSync(certPath, 'utf-8')
    
    // Check for PEM headers
    if (!content.includes('-----BEGIN CERTIFICATE-----') || 
        !content.includes('-----END CERTIFICATE-----')) {
      return { valid: false, error: 'Invalid PEM format - missing certificate headers' }
    }
    
    // Verify with OpenSSL
    try {
      execSync(`openssl x509 -in ${certPath} -noout -text 2>/dev/null`)
      return { valid: true }
    } catch {
      return { valid: false, error: 'OpenSSL cannot parse certificate' }
    }
  } catch (error: unknown) {
    const err = error as { message?: string }
    return { valid: false, error: err.message }
  }
}

/**
 * Validate PEM private key format
 */
export function validatePEMKey(keyPath: string): { valid: boolean; error?: string } {
  try {
    if (!fs.existsSync(keyPath)) {
      return { valid: false, error: 'File does not exist' }
    }
    
    const content = fs.readFileSync(keyPath, 'utf-8')
    
    // Check for PEM headers (RSA or PKCS#8)
    if (!content.includes('-----BEGIN') || !content.includes('PRIVATE KEY-----')) {
      return { valid: false, error: 'Invalid PEM format - missing private key headers' }
    }
    
    // Verify with OpenSSL
    try {
      execSync(`openssl rsa -in ${keyPath} -check -noout 2>/dev/null || openssl pkey -in ${keyPath} -check -noout 2>/dev/null`)
      return { valid: true }
    } catch {
      return { valid: false, error: 'OpenSSL cannot parse private key' }
    }
  } catch (error: unknown) {
    const err = error as { message?: string }
    return { valid: false, error: err.message }
  }
}

/**
 * Deploy CA certificate to x509ca directory
 * CRITICAL: CA certificates MUST be in x509ca for client certificate verification
 */
export function deployCACertificate(caCertPath: string, name?: string): { 
  success: boolean
  destPath?: string
  error?: string 
} {
  try {
    ensureStrongSwanDirs()
    
    // Validate certificate first
    const validation = validatePEMCertificate(caCertPath)
    if (!validation.valid) {
      return { success: false, error: `Invalid CA certificate: ${validation.error}` }
    }
    
<<<<<<< HEAD
    const paths = getStrongSwanPaths()
    const certName = name || path.basename(caCertPath, '.pem')
    const destPath = path.join(paths.x509caDir, `${certName}.pem`)
=======
    const certName = name || path.basename(caCertPath, '.pem')
    const destPath = path.join(STRONGSWAN_PATHS.x509caDir, `${certName}.pem`)
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
    
    // Copy certificate
    fs.copyFileSync(caCertPath, destPath)
    fs.chmodSync(destPath, 0o644)
    
    console.log(`[PKI] CA certificate deployed to: ${destPath}`)
    
    return { success: true, destPath }
  } catch (error: unknown) {
    const err = error as { message?: string }
    return { success: false, error: err.message }
  }
}

/**
 * Deploy server certificate to x509 directory
 */
export function deployServerCertificate(
  certPath: string,
  keyPath: string,
  name?: string
): { success: boolean; certDest?: string; keyDest?: string; error?: string } {
  try {
    ensureStrongSwanDirs()
    
    // Validate certificate
    const certValidation = validatePEMCertificate(certPath)
    if (!certValidation.valid) {
      return { success: false, error: `Invalid server certificate: ${certValidation.error}` }
    }
    
    // Validate key
    const keyValidation = validatePEMKey(keyPath)
    if (!keyValidation.valid) {
      return { success: false, error: `Invalid private key: ${keyValidation.error}` }
    }
    
<<<<<<< HEAD
    const paths = getStrongSwanPaths()
    const certName = name || path.basename(certPath, '.pem')
    const certDest = path.join(paths.x509Dir, `${certName}.pem`)
    const keyDest = path.join(paths.privateDir, `${certName}.pem`)
=======
    const certName = name || path.basename(certPath, '.pem')
    const certDest = path.join(STRONGSWAN_PATHS.x509Dir, `${certName}.pem`)
    const keyDest = path.join(STRONGSWAN_PATHS.privateDir, `${certName}.pem`)
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
    
    // Copy files
    fs.copyFileSync(certPath, certDest)
    fs.copyFileSync(keyPath, keyDest)
    
    // Set permissions
    fs.chmodSync(certDest, 0o644)
    fs.chmodSync(keyDest, 0o600) // Private key must be 600
    
    console.log(`[PKI] Server certificate deployed to: ${certDest}`)
    console.log(`[PKI] Private key deployed to: ${keyDest}`)
    
    return { success: true, certDest, keyDest }
  } catch (error: unknown) {
    const err = error as { message?: string }
    return { success: false, error: err.message }
  }
}

/**
 * Deploy CRL to x509crl directory
 */
export function deployCRL(crlPath: string, name?: string): { success: boolean; destPath?: string; error?: string } {
  try {
    ensureStrongSwanDirs()
    
    if (!fs.existsSync(crlPath)) {
      return { success: false, error: 'CRL file does not exist' }
    }
    
<<<<<<< HEAD
    const paths = getStrongSwanPaths()
    const crlName = name || path.basename(crlPath, '.pem').replace('.crl', '')
    const destPath = path.join(paths.crlDir, `${crlName}.crl`)
=======
    const crlName = name || path.basename(crlPath, '.pem').replace('.crl', '')
    const destPath = path.join(STRONGSWAN_PATHS.crlDir, `${crlName}.crl`)
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
    
    // Copy CRL
    fs.copyFileSync(crlPath, destPath)
    fs.chmodSync(destPath, 0o644)
    
    console.log(`[PKI] CRL deployed to: ${destPath}`)
    
    return { success: true, destPath }
  } catch (error: unknown) {
    const err = error as { message?: string }
    return { success: false, error: err.message }
  }
}

/**
 * Remove CA certificate
 */
export function removeCACertificate(name: string): boolean {
<<<<<<< HEAD
  const paths = getStrongSwanPaths()
  const certPath = path.join(paths.x509caDir, `${name}.pem`)
=======
  const certPath = path.join(STRONGSWAN_PATHS.x509caDir, `${name}.pem`)
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  if (fs.existsSync(certPath)) {
    fs.unlinkSync(certPath)
    return true
  }
  return false
}

/**
 * Remove server certificate
 */
export function removeServerCertificate(name: string): boolean {
<<<<<<< HEAD
  const paths = getStrongSwanPaths()
  const certPath = path.join(paths.x509Dir, `${name}.pem`)
  const keyPath = path.join(paths.privateDir, `${name}.pem`)
=======
  const certPath = path.join(STRONGSWAN_PATHS.x509Dir, `${name}.pem`)
  const keyPath = path.join(STRONGSWAN_PATHS.privateDir, `${name}.pem`)
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  
  let removed = false
  if (fs.existsSync(certPath)) {
    fs.unlinkSync(certPath)
    removed = true
  }
  if (fs.existsSync(keyPath)) {
    fs.unlinkSync(keyPath)
    removed = true
  }
  
  return removed
}

/**
 * Generate swanctl.conf for IKEv2 EAP-TLS
 * This configuration supports certificate-based authentication
 */
export function generateSwanctlConf(config: {
  serverCert: string
  serverKey: string
  caCerts: string[]
  localAddrs: string[]
  virtualIpPool: string
  dnsServers: string[]
  serverId?: string
}): string {
  const serverId = config.serverId || config.localAddrs[0] || 'vpn.server'
  
  return `# VPN PKI Management Platform - Generated Configuration
# IKEv2 Certificate-Based Authentication for strongSwan 6.0.1
# Generated: ${new Date().toISOString()}

connections {
  ikev2-cert {
    # IKE version 2 only
    version = 2
    
    # MOBIKE support for mobile clients
    mobike = yes
    
    # Disable reauthentication (use rekey instead)
    reauth_time = 0
    
    # Enable fragmentation for better NAT traversal
    fragmentation = yes
    
    # Local (server) addresses
    local_addrs = ${config.localAddrs.join(', ')}
    
    # Server authentication with certificate
    local {
      auth = pubkey
      certs = ${config.serverCert}
      id = @${serverId}
    }
    
    # Client authentication with certificate (EAP-TLS)
    remote {
      auth = pubkey
      # Accept any client certificate signed by our CA
      cacerts = ${config.caCerts.join(', ')}
      id = %any
    }
    
    # Child SA (IPsec tunnel)
    children {
      ikev2-cert {
        # Traffic selectors
        local_ts = 0.0.0.0/0
        remote_ts = dynamic
        
        # ESP proposals (AES-256-GCM with SHA256 and ECDH)
        esp_proposals = aes256gcm16-sha256-x25519,aes256-sha256-modp2048
        
        # Tunnel mode
        mode = tunnel
        
        # DPD action
        dpd_action = restart
        
        # Enable IPsec policies
        policies = yes
      }
    }
    
    # IKE proposals
    ike_proposals = aes256-sha256-x25519,aes256-sha256-modp2048
    
    # Virtual IP pool
    pools = vpn-pool
    
    # Send certificate requests
    send_certreq = yes
    
    # Send our certificate always
    send_cert = always
  }
}

# Virtual IP pools
pools {
  vpn-pool {
    addrs = ${config.virtualIpPool}
    dns = ${config.dnsServers.join(', ')}
  }
}

# Secrets (private keys)
secrets {
  private-server {
    file = ${config.serverKey}
  }
}
`
}

/**
 * Generate strongswan.conf for optimal IKEv2 operation
 */
export function generateStrongswanConf(): string {
  return `# strongSwan configuration file
# Generated by VPN PKI Management Platform
# For strongSwan 6.0.1

charon {
  # Load modular plugins
  load_modular = yes
  
  # Number of worker threads
  threads = 16
  
  # CRL checking mode
  # strict: require valid CRL for all certs
  # ifpossible: use CRL if available
  # never: don't check CRLs
  crl_check = ifpossible
  
  # Cache CRLs in memory
  cache_crl = yes
  
  # Certificate verification
  certificates {
    # Warn on expired CRL
    crl_reload = yes
    # Cache certificates
    cache = yes
  }
  
  # Plugins configuration
  plugins {
    include strongswan.d/charon/*.conf
  }
  
  # File logging for debugging
  filelog {
    /var/log/charon.log {
      time_format = %b %e %T
      # Log level: 0=none, 1=control, 2=controlmore, 3=debug, 4=private
      default = 2
      append = no
      flush_line = yes
    }
  }
}

# Legacy pluto configuration (not used in strongSwan 6.x)
pluto {
  load_modular = yes
  plugins {
    include strongswan.d/pluto/*.conf
  }
}
`
}

/**
 * Write swanctl.conf
 */
export function writeSwanctlConf(content: string): void {
<<<<<<< HEAD
  const paths = getStrongSwanPaths()
  ensureStrongSwanDirs()
  fs.writeFileSync(paths.swanctlConf, content, { mode: 0o644 })
=======
  ensureStrongSwanDirs()
  fs.writeFileSync(STRONGSWAN_PATHS.swanctlConf, content, { mode: 0o644 })
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
}

/**
 * Write strongswan.conf
 */
export function writeStrongswanConf(content: string): void {
<<<<<<< HEAD
  const paths = getStrongSwanPaths()
  fs.writeFileSync(paths.strongswanConf, content, { mode: 0o644 })
=======
  fs.writeFileSync(STRONGSWAN_PATHS.strongswanConf, content, { mode: 0o644 })
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
}

/**
 * List installed CA certificates in x509ca
 */
export function listCACertificates(): string[] {
<<<<<<< HEAD
  const paths = getStrongSwanPaths()
  if (!fs.existsSync(paths.x509caDir)) {
    return []
  }
  return fs.readdirSync(paths.x509caDir)
=======
  if (!fs.existsSync(STRONGSWAN_PATHS.x509caDir)) {
    return []
  }
  return fs.readdirSync(STRONGSWAN_PATHS.x509caDir)
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
    .filter(f => f.endsWith('.pem'))
    .map(f => path.basename(f, '.pem'))
}

/**
 * List installed server certificates in x509
 */
export function listServerCertificates(): string[] {
<<<<<<< HEAD
  const paths = getStrongSwanPaths()
  if (!fs.existsSync(paths.x509Dir)) {
    return []
  }
  return fs.readdirSync(paths.x509Dir)
=======
  if (!fs.existsSync(STRONGSWAN_PATHS.x509Dir)) {
    return []
  }
  return fs.readdirSync(STRONGSWAN_PATHS.x509Dir)
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
    .filter(f => f.endsWith('.pem'))
    .map(f => path.basename(f, '.pem'))
}

/**
 * List installed CRLs
 */
export function listCRLs(): string[] {
<<<<<<< HEAD
  const paths = getStrongSwanPaths()
  if (!fs.existsSync(paths.crlDir)) {
    return []
  }
  return fs.readdirSync(paths.crlDir)
=======
  if (!fs.existsSync(STRONGSWAN_PATHS.crlDir)) {
    return []
  }
  return fs.readdirSync(STRONGSWAN_PATHS.crlDir)
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
    .filter(f => f.endsWith('.pem') || f.endsWith('.crl'))
    .map(f => path.basename(f))
}

/**
 * Verify strongSwan deployment status
 */
export function verifyDeployment(): {
  caDeployed: boolean
  crlDeployed: boolean
  configExists: boolean
  errors: string[]
  warnings: string[]
} {
<<<<<<< HEAD
  const paths = getStrongSwanPaths()
=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  const errors: string[] = []
  const warnings: string[] = []
  
  // Check CA certificates
  const caCerts = listCACertificates()
  const caDeployed = caCerts.length > 0
  if (!caDeployed) {
<<<<<<< HEAD
    errors.push(`No CA certificate found in ${paths.x509caDir}`)
=======
    errors.push('No CA certificate found in /etc/swanctl/x509ca/')
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  }
  
  // Check CRL
  const crls = listCRLs()
  const crlDeployed = crls.length > 0
  if (!crlDeployed) {
<<<<<<< HEAD
    warnings.push(`No CRL found in ${paths.crlDir} - certificate status checking disabled`)
  }
  
  // Check swanctl.conf
  const configExists = fs.existsSync(paths.swanctlConf)
=======
    warnings.push('No CRL found in /etc/swanctl/x509crl/ - certificate status checking disabled')
  }
  
  // Check swanctl.conf
  const configExists = fs.existsSync(STRONGSWAN_PATHS.swanctlConf)
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  if (!configExists) {
    errors.push('swanctl.conf not found')
  }
  
  return {
    caDeployed,
    crlDeployed,
    configExists,
    errors,
    warnings,
  }
}

/**
 * Get active VPN connections
 */
export async function getActiveConnections(): Promise<Array<{
  name: string
  localId: string
  remoteId: string
  localAddr: string
  remoteAddr: string
  state: string
  established: number
}>> {
  try {
    const { stdout } = await execAsync('swanctl --list-sas 2>/dev/null || echo ""')
    
    const connections: Array<{
      name: string
      localId: string
      remoteId: string
      localAddr: string
      remoteAddr: string
      state: string
      established: number
    }> = []
    
    // Parse output - this is a simplified parser
    const lines = stdout.split('\n')
    let currentConn: typeof connections[0] | null = null
    
    for (const line of lines) {
      if (line.match(/^\s*(\S+):\s*$/)) {
        if (currentConn) {
          connections.push(currentConn)
        }
        const nameMatch = line.match(/^\s*(\S+):\s*$/)
        currentConn = {
          name: nameMatch ? nameMatch[1] : 'unknown',
          localId: '',
          remoteId: '',
          localAddr: '',
          remoteAddr: '',
          state: 'ESTABLISHED',
          established: 0,
        }
      } else if (currentConn) {
        // Parse connection details
        const localMatch = line.match(/local:\s*(\S+)/)
        const remoteMatch = line.match(/remote:\s*(\S+)/)
        if (localMatch) currentConn.localAddr = localMatch[1]
        if (remoteMatch) currentConn.remoteAddr = remoteMatch[1]
      }
    }
    
    if (currentConn) {
      connections.push(currentConn)
    }
    
    return connections
  } catch {
    return []
  }
}

/**
 * Terminate a specific connection
 */
export async function terminateConnection(name: string): Promise<{ success: boolean; message: string }> {
  try {
    await execAsync(`swanctl --terminate --ike ${name}`)
    return { success: true, message: `Connection ${name} terminated` }
  } catch (error: unknown) {
    const execError = error as { message?: string }
    return { success: false, message: `Failed to terminate: ${execError.message}` }
  }
}

/**
 * Initiate a connection
 */
export async function initiateConnection(name: string): Promise<{ success: boolean; message: string }> {
  try {
    await execAsync(`swanctl --initiate --ike ${name}`)
    return { success: true, message: `Connection ${name} initiated` }
  } catch (error: unknown) {
    const execError = error as { message?: string }
    return { success: false, message: `Failed to initiate: ${execError.message}` }
  }
}

/**
 * Fetch CRL from URL
 */
export async function fetchCRL(url: string, outputPath: string): Promise<{ success: boolean; message: string }> {
  try {
    const { stdout } = await execAsync(`curl -sSL "${url}"`)
    fs.writeFileSync(outputPath, stdout, { mode: 0o644 })
    return { success: true, message: 'CRL fetched successfully' }
  } catch (error: unknown) {
    const execError = error as { message?: string }
    return { success: false, message: `Failed to fetch CRL: ${execError.message}` }
  }
}

/**
 * Get loaded certificates from strongSwan
 */
export async function getLoadedCertificates(): Promise<{
  success: boolean
  certificates: Array<{ type: string; subject: string; issuer: string }>
  error?: string
}> {
  try {
    const { stdout } = await execAsync('swanctl --list-certs 2>/dev/null || echo ""')
    
    const certificates: Array<{ type: string; subject: string; issuer: string }> = []
    const lines = stdout.split('\n')
    
    for (const line of lines) {
      if (line.includes('subject:')) {
        const subjectMatch = line.match(/subject:\s*"([^"]+)"/)
        if (subjectMatch) {
          certificates.push({
            type: 'unknown',
            subject: subjectMatch[1],
            issuer: ''
          })
        }
      }
    }
    
    return { success: true, certificates }
  } catch (error: unknown) {
    const err = error as { message?: string }
    return { success: false, certificates: [], error: err.message }
  }
}
