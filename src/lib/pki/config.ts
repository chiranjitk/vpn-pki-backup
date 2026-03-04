/**
 * PKI Configuration
 * Centralized configuration for PKI paths and settings
 * All paths are configurable via environment variables
 * 
 * IMPORTANT: Client certificates should NOT be stored in /etc/swanctl/
 * - /etc/swanctl/x509/ is for SERVER certificates only
 * - /etc/swanctl/private/ is for SERVER keys only
 * - /etc/swanctl/x509ca/ is for CA certificates only (no .srl files!)
 * - Client certificates go in /var/lib/vpn-pki/ for distribution
 */

import * as fs from 'fs'
import * as path from 'path'

export interface PKIPaths {
  // swanctl base directories
  swanctlBase: string
  
  // CA files
  caKeyPath: string
  caCertPath: string
  crlPath: string
  
  // OpenSSL CA database files
  databasePath: string
  serialPath: string
  crlNumberPath: string
  
  // Client certificate storage (separate from swanctl!)
  // These are for download/distribution, NOT for strongSwan to load
  clientCertsPath: string
  clientKeysPath: string
  clientPkcs12Path: string
  
  // CA cert storage for swanctl
  caCertsPath: string
  
  // strongSwan paths (for SERVER certificates only)
  swanctlX509Path: string
  swanctlPrivatePath: string
  swanctlCrlPath: string
  swanctlConfPath: string
}

/**
 * Get PKI paths from environment or defaults
 * Uses home directory paths by default to avoid permission issues
 */
export function getPKIPaths(): PKIPaths {
  // Use home directory for development/demo environments
  const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp'
  const defaultSwanctlBase = process.env.NODE_ENV === 'production' ? '/etc/swanctl' : `${homeDir}/vpn-pki/swanctl`
  const defaultClientBase = process.env.NODE_ENV === 'production' ? '/var/lib/vpn-pki' : `${homeDir}/vpn-pki`

  const swanctlBase = process.env.SWANCTL_BASE_PATH || defaultSwanctlBase
  const clientCertsBase = process.env.PKI_CLIENT_BASE_PATH || defaultClientBase
  
  return {
    // swanctl base
    swanctlBase,
    
    // CA key - stored securely in private directory (root:root 600)
    caKeyPath: process.env.PKI_CA_KEY_PATH || path.join(swanctlBase, 'private', 'ca.key'),
    
    // CA certificate - in x509ca for swanctl
    caCertPath: process.env.PKI_CA_CERT_PATH || path.join(swanctlBase, 'x509ca', 'ca.pem'),
    
    // CRL path
    crlPath: process.env.PKI_CRL_PATH || path.join(swanctlBase, 'x509crl', 'ca.crl.pem'),
    
    // OpenSSL CA database (in a separate directory, NOT in x509ca!)
    databasePath: process.env.PKI_DATABASE_PATH || path.join(swanctlBase, 'ca', 'index.txt'),
    serialPath: process.env.PKI_SERIAL_PATH || path.join(swanctlBase, 'ca', 'serial'),
    crlNumberPath: process.env.PKI_CRL_NUMBER_PATH || path.join(swanctlBase, 'ca', 'crlnumber'),
    
    // Client certificates - stored separately for distribution
    // NOT in /etc/swanctl/ - strongSwan should NOT load client certs!
    clientCertsPath: process.env.PKI_CLIENT_CERTS_PATH || path.join(clientCertsBase, 'certs'),
    clientKeysPath: process.env.PKI_CLIENT_KEYS_PATH || path.join(clientCertsBase, 'keys'),
    clientPkcs12Path: process.env.PKI_CLIENT_PKCS12_PATH || path.join(clientCertsBase, 'pkcs12'),
    
    // CA certs directory for swanctl (ONLY CA certs here, no .srl files!)
    caCertsPath: path.join(swanctlBase, 'x509ca'),
    
    // strongSwan standard paths (SERVER certificates only!)
    swanctlX509Path: path.join(swanctlBase, 'x509'),
    swanctlPrivatePath: path.join(swanctlBase, 'private'),
    swanctlCrlPath: path.join(swanctlBase, 'x509crl'),
    swanctlConfPath: path.join(swanctlBase, 'swanctl.conf'),
  }
}

/**
 * Ensure all required directories exist
 */
export function ensurePKIDirectories(): void {
  const paths = getPKIPaths()
  
  // Create swanctl directories (for server certs and CA)
  const dirs = [
    paths.caCertsPath,
    paths.swanctlX509Path,
    paths.swanctlCrlPath,
    paths.clientCertsPath,
    paths.clientPkcs12Path,
  ]
  
  // Create each directory with standard permissions
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o755 })
    }
  })
  
  // Create private directories with restricted permissions
  const privateDirs = [
    paths.swanctlPrivatePath,
    paths.clientKeysPath,
  ]
  
  privateDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
    }
  })
  
  // CA database directory
  const caDbDir = path.dirname(paths.databasePath)
  if (!fs.existsSync(caDbDir)) {
    fs.mkdirSync(caDbDir, { recursive: true, mode: 0o755 })
  }
  
  // Clean up any .srl files that might have been accidentally placed in x509ca
  // strongSwan tries to load ALL files from x509ca as certificates
  try {
    const x509caFiles = fs.readdirSync(paths.caCertsPath)
    x509caFiles.forEach(file => {
      if (file.endsWith('.srl') || file.endsWith('.csr') || file.endsWith('.conf')) {
        const filePath = path.join(paths.caCertsPath, file)
        // Move to CA database directory instead
        const newPath = path.join(caDbDir, file)
        fs.renameSync(filePath, newPath)
        console.log(`[PKI] Moved ${file} from x509ca to ca directory`)
      }
    })
  } catch {
    // Ignore errors
  }
}

/**
 * Initialize OpenSSL CA database files
 */
export function initializeCADatabase(): void {
  const paths = getPKIPaths()
  
  // Create index.txt if not exists
  if (!fs.existsSync(paths.databasePath)) {
    fs.writeFileSync(paths.databasePath, '', { mode: 0o644 })
  }
  
  // Create serial if not exists
  if (!fs.existsSync(paths.serialPath)) {
    fs.writeFileSync(paths.serialPath, '01\n', { mode: 0o644 })
  }
  
  // Create crlnumber if not exists
  if (!fs.existsSync(paths.crlNumberPath)) {
    fs.writeFileSync(paths.crlNumberPath, '01\n', { mode: 0o644 })
  }
}

/**
 * Create OpenSSL CA configuration file
 */
export function createCAConfig(): string {
  const paths = getPKIPaths()
  const configPath = path.join(path.dirname(paths.databasePath), 'ca.cnf')
  
  const config = `# OpenSSL CA Configuration
# Generated by 24online VPN Server

[ca]
default_ca = CA_default

[CA_default]
dir               = ${path.dirname(paths.databasePath)}
database          = ${paths.databasePath}
serial            = ${paths.serialPath}
crlnumber         = ${paths.crlNumberPath}
certificate       = ${paths.caCertPath}
private_key       = ${paths.caKeyPath}
crl               = ${paths.crlPath}
default_days      = 365
default_crl_days  = 7
default_md        = sha256
preserve          = no
policy            = policy_anything
x509_extensions   = client_cert

[policy_anything]
countryName             = optional
stateOrProvinceName     = optional
localityName            = optional
organizationName        = optional
organizationalUnitName  = optional
commonName              = supplied
emailAddress            = optional

[client_cert]
basicConstraints = CA:FALSE
nsCertType = client, email
nsComment = "24online VPN Client Certificate"
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer:always
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = clientAuth, emailProtection

[server_cert]
basicConstraints = CA:FALSE
nsCertType = server
nsComment = "24online VPN Server Certificate"
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer:always
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[crl_ext]
authorityKeyIdentifier=keyid:always

[req]
default_bits       = 4096
default_keyfile    = privkey.pem
distinguished_name = req_distinguished_name
attributes         = req_attributes
x509_extensions    = v3_ca
string_mask        = utf8only

[req_distinguished_name]
countryName                    = Country Name (2 letter code)
countryName_default            = US
countryName_min                = 2
countryName_max                = 2
stateOrProvinceName            = State or Province Name (full name)
localityName                   = Locality Name (eg, city)
0.organizationName             = Organization Name (eg, company)
0.organizationName_default     = 24online
organizationalUnitName         = Organizational Unit Name (eg, section)
commonName                     = Common Name (eg, your name or your server\'s hostname)
commonName_max                 = 64
emailAddress                   = Email Address
emailAddress_max               = 64

[req_attributes]
challengePassword     = A challenge password
challengePassword_min = 4
challengePassword_max = 20

[v3_ca]
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid:always,issuer
basicConstraints       = critical, CA:true
keyUsage              = critical, digitalSignature, cRLSign, keyCertSign

[v3_intermediate_ca]
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid:always,issuer
basicConstraints       = critical, CA:true, pathlen:0
keyUsage               = critical, digitalSignature, cRLSign, keyCertSign
`
  
  fs.writeFileSync(configPath, config, { mode: 0o644 })
  return configPath
}

/**
 * Validate PKI setup
 */
export function validatePKISetup(): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const paths = getPKIPaths()
  const errors: string[] = []
  const warnings: string[] = []
  
  // Check if CA exists
  if (fs.existsSync(paths.caCertPath)) {
    // CA cert exists, check key
    if (!fs.existsSync(paths.caKeyPath)) {
      errors.push(`CA certificate exists but private key not found at ${paths.caKeyPath}`)
    }
    
    // Check key permissions
    if (fs.existsSync(paths.caKeyPath)) {
      const stat = fs.statSync(paths.caKeyPath)
      const mode = stat.mode & 0o777
      if (mode !== 0o600 && mode !== 0o400) {
        warnings.push(`CA key has insecure permissions ${mode.toString(8)}, should be 600`)
      }
    }
  } else {
    warnings.push('CA not initialized. Use PKI Management to initialize.')
  }
  
  // Check database files
  if (!fs.existsSync(paths.databasePath)) {
    warnings.push('CA database not initialized')
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Get path status for display
 */
export function getPKIPathStatus(): Array<{
  name: string
  path: string
  exists: boolean
  type: 'file' | 'directory'
  permissions?: string
}> {
  const paths = getPKIPaths()
  
  const items: Array<{ name: string; path: string; type: 'file' | 'directory' }> = [
    { name: 'CA Certificate', path: paths.caCertPath, type: 'file' },
    { name: 'CA Private Key', path: paths.caKeyPath, type: 'file' },
    { name: 'CRL File', path: paths.crlPath, type: 'file' },
    { name: 'CA Database', path: paths.databasePath, type: 'file' },
    { name: 'Serial File', path: paths.serialPath, type: 'file' },
    { name: 'Client Certs Dir', path: paths.clientCertsPath, type: 'directory' },
    { name: 'Client Keys Dir', path: paths.clientKeysPath, type: 'directory' },
    { name: 'PKCS#12 Dir', path: paths.clientPkcs12Path, type: 'directory' },
  ]
  
  return items.map(item => {
    const exists = fs.existsSync(item.path)
    let permissions: string | undefined
    
    if (exists) {
      const stat = fs.statSync(item.path)
      permissions = (stat.mode & 0o777).toString(8).padStart(3, '0')
    }
    
    return {
      name: item.name,
      path: item.path,
      exists,
      type: item.type,
      permissions,
    }
  })
}
