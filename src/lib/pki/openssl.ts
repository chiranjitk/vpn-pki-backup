/**
 * PKI Utility Functions
 * OpenSSL wrapper for certificate operations
 * Supports both External CA (Mode A) and Managed PKI (Mode B)
 */

import { execSync, exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'

const execAsync = promisify(exec)

// PKI Configuration
export interface PKIConfig {
  workDir: string
  caDir: string
  keySize: number
  hashAlgorithm: string
  defaultDays: number
  crlDays: number
}

// Certificate Details
export interface CertificateInfo {
  subject: string
  issuer: string
  serialNumber: string
  notBefore: Date
  notAfter: Date
  status: 'valid' | 'expired' | 'revoked'
  keyUsage: string[]
  extendedKeyUsage: string[]
  subjectAltNames: string[]
  publicKeySize: number
  publicKeyAlgorithm: string
  signatureAlgorithm: string
  fingerprint: {
    sha256: string
    sha1: string
  }
}

// CSR Details
export interface CSRInfo {
  subject: string
  publicKeySize: number
  publicKeyAlgorithm: string
  signatureAlgorithm: string
  attributes: Record<string, string>
}

// CA Configuration
export interface CAConfig {
  name: string
  commonName: string
  country?: string
  state?: string
  locality?: string
  organization?: string
  organizationalUnit?: string
  emailAddress?: string
  keySize: number
  validityDays: number
}

// Server Certificate Configuration
export interface ServerCertConfig {
  commonName: string
  dnsNames: string[]
  ipAddresses: string[]
  emailAddress?: string
  organization?: string
  keySize: number
  validityDays: number
}

// Client Certificate Configuration
export interface ClientCertConfig {
  commonName: string
  emailAddress: string
  organization?: string
  organizationalUnit?: string
  keySize: number
  validityDays: number
}

// PKCS#12 Configuration
export interface PKCS12Config {
  certificatePath: string
  keyPath: string
  outputPath: string
  password: string
  friendlyName?: string
  caChainPath?: string
}

/**
 * Execute OpenSSL command with error handling
 */
async function runOpenSSL(args: string, input?: string): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execAsync(`openssl ${args}`, {
      input: input,
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large certificates
    })
    return result
  } catch (error: unknown) {
    const execError = error as { stderr?: string; message?: string }
    throw new Error(`OpenSSL error: ${execError.stderr || execError.message}`)
  }
}

/**
 * Check if OpenSSL is available
 */
export function isOpenSSLAvailable(): boolean {
  try {
    execSync('openssl version')
    return true
  } catch {
    return false
  }
}

/**
 * Get OpenSSL version
 */
export function getOpenSSLVersion(): string {
  try {
    const result = execSync('openssl version', { encoding: 'utf-8' })
    return result.trim()
  } catch {
    return 'Not available'
  }
}

/**
 * Generate RSA Private Key
 */
export async function generatePrivateKey(
  outputPath: string,
  keySize: number = 4096,
  password?: string
): Promise<void> {
  const args = password
    ? `genrsa -aes256 -passout pass:${password} -out ${outputPath} ${keySize}`
    : `genrsa -out ${outputPath} ${keySize}`
  
  await runOpenSSL(args)
  
  // Set appropriate permissions (600)
  fs.chmodSync(outputPath, 0o600)
}

/**
 * Generate Certificate Signing Request (CSR)
 */
export async function generateCSR(
  keyPath: string,
  outputPath: string,
  subject: string,
  configPath?: string,
  password?: string
): Promise<void> {
  const passArg = password ? `-passin pass:${password}` : ''
  const configArg = configPath ? `-config ${configPath}` : ''
  
  await runOpenSSL(
    `req -new -key ${keyPath} ${passArg} -out ${outputPath} -subj "${subject}" ${configArg}`
  )
}

/**
 * Create Subject String for OpenSSL
 */
export function createSubjectString(params: {
  country?: string
  state?: string
  locality?: string
  organization?: string
  organizationalUnit?: string
  commonName: string
  emailAddress?: string
}): string {
  const parts: string[] = []
  
  if (params.country) parts.push(`/C=${params.country}`)
  if (params.state) parts.push(`/ST=${params.state}`)
  if (params.locality) parts.push(`/L=${params.locality}`)
  if (params.organization) parts.push(`/O=${params.organization}`)
  if (params.organizationalUnit) parts.push(`/OU=${params.organizationalUnit}`)
  parts.push(`/CN=${params.commonName}`)
  if (params.emailAddress) parts.push(`/emailAddress=${params.emailAddress}`)
  
  return parts.join('')
}

/**
 * Create OpenSSL Configuration File for Certificate Generation
 */
export function createCertConfig(
  outputPath: string,
  params: {
    dnsNames?: string[]
    ipAddresses?: string[]
    keyUsage?: string[]
    extendedKeyUsage?: string[]
  }
): void {
  const config = `
[req]
default_bits = 4096
default_md = sha256
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = certificate

[v3_req]
basicConstraints = CA:FALSE
keyUsage = ${params.keyUsage?.join(', ') || 'digitalSignature, keyEncipherment'}
extendedKeyUsage = ${params.extendedKeyUsage?.join(', ') || 'clientAuth'}
${params.dnsNames?.length ? `subjectAltName = @alt_names` : ''}

${params.dnsNames?.length || params.ipAddresses?.length ? `
[alt_names]
${(params.dnsNames || []).map((dns, i) => `DNS.${i + 1} = ${dns}`).join('\n')}
${(params.ipAddresses || []).map((ip, i) => `IP.${i + 1} = ${ip}`).join('\n')}
` : ''}
`
  
  fs.writeFileSync(outputPath, config)
}

/**
 * Generate Root CA Certificate
 */
export async function generateRootCA(
  keyPath: string,
  certPath: string,
  config: CAConfig,
  password?: string
): Promise<void> {
  const subject = createSubjectString({
    country: config.country,
    state: config.state,
    locality: config.locality,
    organization: config.organization,
    organizationalUnit: config.organizationalUnit,
    commonName: config.commonName,
    emailAddress: config.emailAddress,
  })
  
  const passArg = password ? `-passin pass:${password}` : ''
  
  // Generate private key
  await generatePrivateKey(keyPath, config.keySize, password)
  
  // Generate self-signed certificate
  await runOpenSSL(
    `req -x509 -new -nodes -key ${keyPath} ${passArg} -sha256 -days ${config.validityDays} ` +
    `-out ${certPath} -subj "${subject}" ` +
    `-addext "basicConstraints=critical,CA:TRUE" ` +
    `-addext "keyUsage=critical,keyCertSign,cRLSign" ` +
    `-addext "subjectKeyIdentifier=hash" ` +
    `-addext "authorityKeyIdentifier=keyid:always,issuer"`
  )
  
  fs.chmodSync(certPath, 0o644)
}

/**
 * Generate Intermediate CA Certificate
 */
export async function generateIntermediateCA(
  rootKeyPath: string,
  rootCertPath: string,
  keyPath: string,
  certPath: string,
  config: CAConfig,
  rootPassword?: string,
  intermediatePassword?: string
): Promise<void> {
  const subject = createSubjectString({
    country: config.country,
    state: config.state,
    locality: config.locality,
    organization: config.organization,
    organizationalUnit: config.organizationalUnit,
    commonName: config.commonName,
    emailAddress: config.emailAddress,
  })
  
  const rootPassArg = rootPassword ? `-passin pass:${rootPassword}` : ''
  const intPassArg = intermediatePassword ? `-passin pass:${intermediatePassword}` : ''
  
  // Generate private key
  await generatePrivateKey(keyPath, config.keySize, intermediatePassword)
  
  // Generate CSR
  const csrPath = certPath.replace('.pem', '.csr')
  await runOpenSSL(
    `req -new -key ${keyPath} ${intPassArg} -out ${csrPath} -subj "${subject}"`
  )
  
  // Sign with root CA
  await runOpenSSL(
    `x509 -req -in ${csrPath} -CA ${rootCertPath} -CAkey ${rootKeyPath} ${rootPassArg} ` +
    `-CAcreateserial -out ${certPath} -days ${config.validityDays} -sha256 ` +
    `-extfile <(echo "basicConstraints=critical,CA:TRUE,pathlen:0\n` +
    `keyUsage=critical,keyCertSign,cRLSign\n` +
    `subjectKeyIdentifier=hash\n` +
    `authorityKeyIdentifier=keyid:always,issuer")`
  )
  
  // Cleanup CSR
  if (fs.existsSync(csrPath)) {
    fs.unlinkSync(csrPath)
  }
}

/**
 * Generate Server Certificate
 */
export async function generateServerCertificate(
  caKeyPath: string,
  caCertPath: string,
  keyPath: string,
  certPath: string,
  config: ServerCertConfig,
  caPassword?: string
): Promise<void> {
  // Create subject
  const subject = createSubjectString({
    organization: config.organization,
    commonName: config.commonName,
    emailAddress: config.emailAddress,
  })
  
  const passArg = caPassword ? `-passin pass:${caPassword}` : ''
  
  // Generate private key
  await generatePrivateKey(keyPath, config.keySize)
  
  // Create config file for SAN
  const configPath = `${keyPath}.conf`
  createCertConfig(configPath, {
    dnsNames: config.dnsNames,
    ipAddresses: config.ipAddresses,
    keyUsage: ['digitalSignature', 'keyEncipherment'],
    extendedKeyUsage: ['serverAuth'],
  })
  
  // Generate CSR
  const csrPath = certPath.replace('.pem', '.csr')
  await runOpenSSL(
    `req -new -key ${keyPath} -out ${csrPath} -subj "${subject}" -config ${configPath}`
  )
  
  // Sign certificate
  await runOpenSSL(
    `x509 -req -in ${csrPath} -CA ${caCertPath} -CAkey ${caKeyPath} ${passArg} ` +
    `-CAcreateserial -out ${certPath} -days ${config.validityDays} -sha256 ` +
    `-extensions v3_req -extfile ${configPath}`
  )
  
  // Cleanup
  if (fs.existsSync(csrPath)) fs.unlinkSync(csrPath)
  if (fs.existsSync(configPath)) fs.unlinkSync(configPath)
}

/**
 * Generate Client Certificate
 */
export async function generateClientCertificate(
  caKeyPath: string,
  caCertPath: string,
  keyPath: string,
  certPath: string,
  config: ClientCertConfig,
  caPassword?: string
): Promise<void> {
  // Create subject
  const subject = createSubjectString({
    organization: config.organization,
    organizationalUnit: config.organizationalUnit,
    commonName: config.commonName,
    emailAddress: config.emailAddress,
  })
  
  const passArg = caPassword ? `-passin pass:${caPassword}` : ''
  
  // Generate private key
  await generatePrivateKey(keyPath, config.keySize)
  
  // Create config file
  const configPath = `${keyPath}.conf`
  createCertConfig(configPath, {
    keyUsage: ['digitalSignature'],
    extendedKeyUsage: ['clientAuth', '1.3.6.1.5.5.7.3.2'], // clientAuth OID
  })
  
  // Generate CSR
  const csrPath = certPath.replace('.pem', '.csr')
  await runOpenSSL(
    `req -new -key ${keyPath} -out ${csrPath} -subj "${subject}" -config ${configPath}`
  )
  
  // Sign certificate
  await runOpenSSL(
    `x509 -req -in ${csrPath} -CA ${caCertPath} -CAkey ${caKeyPath} ${passArg} ` +
    `-CAcreateserial -out ${certPath} -days ${config.validityDays} -sha256 ` +
    `-extensions v3_req -extfile ${configPath}`
  )
  
  // Cleanup
  if (fs.existsSync(csrPath)) fs.unlinkSync(csrPath)
  if (fs.existsSync(configPath)) fs.unlinkSync(configPath)
}

/**
 * Create PKCS#12 Bundle
 */
export async function createPKCS12(config: PKCS12Config): Promise<void> {
  const caArg = config.caChainPath ? `-certfile ${config.caChainPath}` : ''
  const nameArg = config.friendlyName ? `-name "${config.friendlyName}"` : ''
  
  await runOpenSSL(
    `pkcs12 -export -out ${config.outputPath} ` +
    `-inkey ${config.keyPath} -in ${config.certificatePath} ` +
    `${caArg} ${nameArg} -passout pass:${config.password}`
  )
}

/**
 * Parse Certificate Information
 */
export async function parseCertificate(certPath: string): Promise<CertificateInfo> {
  const { stdout: textOutput } = await runOpenSSL(
    `x509 -in ${certPath} -noout -text`
  )
  
  // OpenSSL 3.x requires separate commands for each digest
  let sha256Fingerprint = ''
  let sha1Fingerprint = ''
  
  try {
    const { stdout: sha256Out } = await runOpenSSL(
      `x509 -in ${certPath} -noout -fingerprint -sha256`
    )
    const sha256Match = sha256Out.match(/SHA256 Fingerprint=([A-F0-9:]+)/i)
    sha256Fingerprint = sha256Match ? sha256Match[1] : ''
  } catch {}
  
  try {
    const { stdout: sha1Out } = await runOpenSSL(
      `x509 -in ${certPath} -noout -fingerprint -sha1`
    )
    const sha1Match = sha1Out.match(/SHA1 Fingerprint=([A-F0-9:]+)/i)
    sha1Fingerprint = sha1Match ? sha1Match[1] : ''
  } catch {}
  
  return parseCertificateText(textOutput, sha256Fingerprint, sha1Fingerprint)
}

/**
 * Parse Certificate from PEM String
 */
export async function parseCertificateFromPEM(pemData: string): Promise<CertificateInfo> {
  const { stdout: textOutput } = await runOpenSSL(
    'x509 -noout -text',
    pemData
  )
  
  // OpenSSL 3.x requires separate commands for each digest
  let sha256Fingerprint = ''
  let sha1Fingerprint = ''
  
  try {
    const { stdout: sha256Out } = await runOpenSSL(
      'x509 -noout -fingerprint -sha256',
      pemData
    )
    const sha256Match = sha256Out.match(/SHA256 Fingerprint=([A-F0-9:]+)/i)
    sha256Fingerprint = sha256Match ? sha256Match[1] : ''
  } catch {}
  
  try {
    const { stdout: sha1Out } = await runOpenSSL(
      'x509 -noout -fingerprint -sha1',
      pemData
    )
    const sha1Match = sha1Out.match(/SHA1 Fingerprint=([A-F0-9:]+)/i)
    sha1Fingerprint = sha1Match ? sha1Match[1] : ''
  } catch {}
  
  return parseCertificateText(textOutput, sha256Fingerprint, sha1Fingerprint)
}

/**
 * Parse Certificate Text Output
 */
function parseCertificateText(textOutput: string, sha256Fingerprint: string, sha1Fingerprint: string): CertificateInfo {
  // Extract subject
  const subjectMatch = textOutput.match(/Subject:\s*(.+)/)
  const subject = subjectMatch ? subjectMatch[1].trim() : ''
  
  // Extract issuer
  const issuerMatch = textOutput.match(/Issuer:\s*(.+)/)
  const issuer = issuerMatch ? issuerMatch[1].trim() : ''
  
  // Extract serial number
  const serialMatch = textOutput.match(/Serial Number:\s*([a-fA-F0-9:]+)/i)
  const serialNumber = serialMatch ? serialMatch[1].trim() : ''
  
  // Extract dates
  const notBeforeMatch = textOutput.match(/Not Before\s*:\s*(.+)/i)
  const notAfterMatch = textOutput.match(/Not After\s*:\s*(.+)/i)
  const notBefore = notBeforeMatch ? new Date(notBeforeMatch[1].trim()) : new Date()
  const notAfter = notAfterMatch ? new Date(notAfterMatch[1].trim()) : new Date()
  
  // Check status
  const now = new Date()
  const status = now > notAfter ? 'expired' : 'valid'
  
  // Extract key usage
  const keyUsage: string[] = []
  const keyUsageMatch = textOutput.match(/Key Usage:\s*([\s\S]*?)(?=Extended Key Usage|Subject Alternative Name|X509v3|$)/i)
  if (keyUsageMatch) {
    keyUsage.push(...keyUsageMatch[1].split(',').map(s => s.trim()).filter(Boolean))
  }
  
  // Extract extended key usage
  const extendedKeyUsage: string[] = []
  const extKeyUsageMatch = textOutput.match(/Extended Key Usage:\s*([\s\S]*?)(?=Subject Alternative Name|X509v3|$)/i)
  if (extKeyUsageMatch) {
    extendedKeyUsage.push(...extKeyUsageMatch[1].split(',').map(s => s.trim()).filter(Boolean))
  }
  
  // Extract SANs
  const subjectAltNames: string[] = []
  const sanMatch = textOutput.match(/Subject Alternative Name:\s*(.+)/i)
  if (sanMatch) {
    subjectAltNames.push(...sanMatch[1].split(',').map(s => s.trim()))
  }
  
  // Extract public key info
  const publicKeySizeMatch = textOutput.match(/Public-Key:\s*\((\d+)\s*bit\)/i)
  const publicKeySize = publicKeySizeMatch ? parseInt(publicKeySizeMatch[1]) : 0
  
  const publicKeyAlgoMatch = textOutput.match(/Public Key Algorithm:\s*(.+)/i)
  const publicKeyAlgorithm = publicKeyAlgoMatch ? publicKeyAlgoMatch[1].trim() : 'RSA'
  
  const sigAlgoMatch = textOutput.match(/Signature Algorithm:\s*(.+)/i)
  const signatureAlgorithm = sigAlgoMatch ? sigAlgoMatch[1].trim() : 'sha256WithRSAEncryption'
  
  return {
    subject,
    issuer,
    serialNumber,
    notBefore,
    notAfter,
    status,
    keyUsage,
    extendedKeyUsage,
    subjectAltNames,
    publicKeySize,
    publicKeyAlgorithm,
    signatureAlgorithm,
    fingerprint: {
      sha256: sha256Fingerprint,
      sha1: sha1Fingerprint,
    },
  }
}

/**
 * Parse CSR Information
 */
export async function parseCSR(csrPath: string): Promise<CSRInfo> {
  const { stdout } = await runOpenSSL(`req -in ${csrPath} -noout -text`)
  
  const subjectMatch = stdout.match(/Subject:\s*(.+)/)
  const subject = subjectMatch ? subjectMatch[1].trim() : ''
  
  const publicKeySizeMatch = stdout.match(/Public-Key:\s*\((\d+)\s*bit\)/i)
  const publicKeySize = publicKeySizeMatch ? parseInt(publicKeySizeMatch[1]) : 0
  
  const publicKeyAlgoMatch = stdout.match(/Public Key Algorithm:\s*(.+)/i)
  const publicKeyAlgorithm = publicKeyAlgoMatch ? publicKeyAlgoMatch[1].trim() : 'RSA'
  
  const sigAlgoMatch = stdout.match(/Signature Algorithm:\s*(.+)/i)
  const signatureAlgorithm = sigAlgoMatch ? sigAlgoMatch[1].trim() : 'sha256WithRSAEncryption'
  
  // Parse attributes
  const attributes: Record<string, string> = {}
  const attrMatches = subject.matchAll(/([A-Z]+)=([^\/]+)/g)
  for (const match of attrMatches) {
    attributes[match[1]] = match[2].trim()
  }
  
  return {
    subject,
    publicKeySize,
    publicKeyAlgorithm,
    signatureAlgorithm,
    attributes,
  }
}

/**
 * Revoke Certificate
 */
export async function revokeCertificate(
  caCertPath: string,
  caKeyPath: string,
  certPath: string,
  databasePath: string,
  reason: string = 'keyCompromise',
  caPassword?: string
): Promise<void> {
  const passArg = caPassword ? `-passin pass:${caPassword}` : ''
  
  // Create database directory if not exists
  const dbDir = path.dirname(databasePath)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }
  
  // Create database files if not exist
  if (!fs.existsSync(databasePath)) {
    fs.writeFileSync(databasePath, '')
  }
  const crlnumberPath = databasePath.replace('index.txt', 'crlnumber')
  if (!fs.existsSync(crlnumberPath)) {
    fs.writeFileSync(crlnumberPath, '01\n')
  }
  
  // Create OpenSSL CA config
  const caConfigPath = path.join(dbDir, 'ca.cnf')
  const caConfig = `
[ca]
default_ca = CA_default

[CA_default]
database = ${databasePath}
crlnumber = ${crlnumberPath}
default_crl_days = 7
default_md = sha256
crl_extensions = crl_ext

[crl_ext]
authorityKeyIdentifier=keyid:always
`
  fs.writeFileSync(caConfigPath, caConfig)
  
  // Revoke certificate
  await runOpenSSL(
    `ca -config ${caConfigPath} -revoke ${certPath} ` +
    `-cert ${caCertPath} -keyfile ${caKeyPath} ${passArg} ` +
    `-crl_reason ${reason}`
  )
}

/**
 * Generate CRL
 */
export async function generateCRL(
  caCertPath: string,
  caKeyPath: string,
  databasePath: string,
  crlPath: string,
  validityDays: number = 7,
  caPassword?: string
): Promise<void> {
  const passArg = caPassword ? `-passin pass:${caPassword}` : ''
  const dbDir = path.dirname(databasePath)
  const caConfigPath = path.join(dbDir, 'ca.cnf')
  
  await runOpenSSL(
    `ca -config ${caConfigPath} -gencrl ` +
    `-cert ${caCertPath} -keyfile ${caKeyPath} ${passArg} ` +
    `-out ${crlPath} -crldays ${validityDays}`
  )
}

/**
 * Verify Certificate Against CRL
 */
export async function verifyCertificateWithCRL(
  certPath: string,
  caCertPath: string,
  crlPath: string
): Promise<{ valid: boolean; reason?: string }> {
  try {
    await runOpenSSL(
      `verify -crl_check -CAfile ${caCertPath} -CRLfile ${crlPath} ${certPath}`
    )
    return { valid: true }
  } catch (error: unknown) {
    const execError = error as { message?: string }
    return { valid: false, reason: execError.message }
  }
}

/**
 * Convert PEM to DER
 */
export async function pemToDer(pemPath: string, derPath: string): Promise<void> {
  await runOpenSSL(`x509 -in ${pemPath} -outform DER -out ${derPath}`)
}

/**
 * Convert DER to PEM
 */
export async function derToPem(derPath: string, pemPath: string): Promise<void> {
  await runOpenSSL(`x509 -in ${derPath} -inform DER -outform PEM -out ${pemPath}`)
}

/**
 * Verify Certificate Chain
 */
export async function verifyCertificateChain(
  certPath: string,
  chainPath: string
): Promise<{ valid: boolean; reason?: string }> {
  try {
    await runOpenSSL(`verify -CAfile ${chainPath} ${certPath}`)
    return { valid: true }
  } catch (error: unknown) {
    const execError = error as { message?: string }
    return { valid: false, reason: execError.message }
  }
}

/**
 * Get Certificate Serial Number
 */
export async function getCertificateSerial(certPath: string): Promise<string> {
  const { stdout } = await runOpenSSL(`x509 -in ${certPath} -noout -serial`)
  const match = stdout.match(/serial=([A-F0-9]+)/i)
  return match ? match[1] : ''
}

/**
 * Check if certificate is expired
 */
export function isCertificateExpired(notAfter: Date): boolean {
  return new Date() > notAfter
}

/**
 * Get days until expiration
 */
export function getDaysUntilExpiration(notAfter: Date): number {
  const now = new Date()
  const diff = notAfter.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}
