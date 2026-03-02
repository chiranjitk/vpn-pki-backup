/**
 * strongSwan VPN Integration Layer
 * Manages configuration and certificate deployment for strongSwan 6.0.1
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync, exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// strongSwan Paths
export const STRONGSWAN_PATHS = {
  swanctlDir: '/etc/swanctl',
  x509caDir: '/etc/swanctl/x509ca',
  x509Dir: '/etc/swanctl/x509',
  privateDir: '/etc/swanctl/private',
  crlDir: '/etc/swanctl/x509crl',
  confDir: '/etc/swanctl/conf.d',
  swanctlConf: '/etc/swanctl/swanctl.conf',
  strongswanConf: '/etc/strongswan.conf',
  ipsecD: '/etc/ipsec.d',
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
    
    // Get active connections count
    let activeConnections = 0
    try {
      const { stdout: listOutput } = await execAsync('swanctl --list-sas 2>/dev/null || echo ""')
      // Count unique connection names
      const connections = listOutput.match(/\[\d+\]/g) || []
      activeConnections = connections.length
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
 * Ensure strongSwan directories exist
 */
export function ensureStrongSwanDirs(): void {
  Object.values(STRONGSWAN_PATHS).forEach((dir) => {
    if (dir.includes('.')) return // Skip files
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o755 })
    }
  })
}

/**
 * Deploy CA certificate
 */
export function deployCACertificate(caCertPath: string, name?: string): string {
  ensureStrongSwanDirs()
  
  const certName = name || path.basename(caCertPath, '.pem')
  const destPath = path.join(STRONGSWAN_PATHS.x509caDir, `${certName}.pem`)
  
  fs.copyFileSync(caCertPath, destPath)
  fs.chmodSync(destPath, 0o644)
  
  return destPath
}

/**
 * Deploy server certificate
 */
export function deployServerCertificate(
  certPath: string,
  keyPath: string,
  name?: string
): { certDest: string; keyDest: string } {
  ensureStrongSwanDirs()
  
  const certName = name || path.basename(certPath, '.pem')
  const certDest = path.join(STRONGSWAN_PATHS.x509Dir, `${certName}.pem`)
  const keyDest = path.join(STRONGSWAN_PATHS.privateDir, `${certName}.pem`)
  
  fs.copyFileSync(certPath, certDest)
  fs.copyFileSync(keyPath, keyDest)
  
  fs.chmodSync(certDest, 0o644)
  fs.chmodSync(keyDest, 0o600) // Private key should be 600
  
  return { certDest, keyDest }
}

/**
 * Deploy CRL
 */
export function deployCRL(crlPath: string, name?: string): string {
  ensureStrongSwanDirs()
  
  const crlName = name || path.basename(crlPath, '.pem')
  const destPath = path.join(STRONGSWAN_PATHS.crlDir, `${crlName}.pem`)
  
  fs.copyFileSync(crlPath, destPath)
  fs.chmodSync(destPath, 0o644)
  
  return destPath
}

/**
 * Remove CA certificate
 */
export function removeCACertificate(name: string): boolean {
  const certPath = path.join(STRONGSWAN_PATHS.x509caDir, `${name}.pem`)
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
  const certPath = path.join(STRONGSWAN_PATHS.x509Dir, `${name}.pem`)
  const keyPath = path.join(STRONGSWAN_PATHS.privateDir, `${name}.pem`)
  
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
 */
export function generateSwanctlConf(config: {
  serverCert: string
  serverKey: string
  caCerts: string[]
  localAddrs: string[]
  virtualIpPool: string
  dnsServers: string[]
}): string {
  const caCertList = config.caCerts.map(c => `"${c}"`).join(', ')
  
  return `
# VPN PKI Management Platform - Generated Configuration
# IKEv2 EAP-TLS Configuration for strongSwan 6.0.1

connections {
  ikev2-eap-tls {
    version = 2
    mobike = yes
    reauth_time = 0
    fragmentation = yes
    
    local_addrs = ${config.localAddrs.join(', ')}
    local {
      auth = eap-tls
      certs = ${config.serverCert}
      id = @vpn.server
    }
    remote {
      auth = eap-tls
      eap_id = %any
    }
    
    children {
      ikev2-eap-tls {
        local_ts = 0.0.0.0/0
        remote_ts = dynamic
        
        esp_proposals = aes256gcm16-sha256-x25519
        mode = tunnel
        dpd_action = restart
        
        policies = yes
      }
    }
    
    pools = vpn-pool
    
    ike_proposals = aes256-sha256-x25519
  }
}

pools {
  vpn-pool {
    addrs = ${config.virtualIpPool}
    dns = ${config.dnsServers.join(', ')}
  }
}

authorities {
  ca-authority {
    certs = ${caCertList}
    crl_uris = file://${STRONGSWAN_PATHS.crlDir}/ca.crl.pem
  }
}

secrets {
  private-server {
    file = ${config.serverKey}
  }
}
`
}

/**
 * Generate strongswan.conf
 */
export function generateStrongswanConf(): string {
  return `
# strongSwan configuration file
# Generated by VPN PKI Management Platform

charon {
  load_modular = yes
  plugins {
    include strongswan.d/charon/*.conf
  }
  
  # Enable CRL checking
  crl_check = strict
  
  # Cache CRLs
  cache_crl = yes
  
  # File logging
  filelog {
    /var/log/charon.log {
      time_format = %b %e %T
      default = 2
      append = no
      flush_line = yes
    }
  }
}

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
  ensureStrongSwanDirs()
  fs.writeFileSync(STRONGSWAN_PATHS.swanctlConf, content, { mode: 0o644 })
}

/**
 * Write strongswan.conf
 */
export function writeStrongswanConf(content: string): void {
  fs.writeFileSync(STRONGSWAN_PATHS.strongswanConf, content, { mode: 0o644 })
}

/**
 * List installed CA certificates
 */
export function listCACertificates(): string[] {
  if (!fs.existsSync(STRONGSWAN_PATHS.x509caDir)) {
    return []
  }
  return fs.readdirSync(STRONGSWAN_PATHS.x509caDir)
    .filter(f => f.endsWith('.pem'))
    .map(f => path.basename(f, '.pem'))
}

/**
 * List installed server certificates
 */
export function listServerCertificates(): string[] {
  if (!fs.existsSync(STRONGSWAN_PATHS.x509Dir)) {
    return []
  }
  return fs.readdirSync(STRONGSWAN_PATHS.x509Dir)
    .filter(f => f.endsWith('.pem'))
    .map(f => path.basename(f, '.pem'))
}

/**
 * List installed CRLs
 */
export function listCRLs(): string[] {
  if (!fs.existsSync(STRONGSWAN_PATHS.crlDir)) {
    return []
  }
  return fs.readdirSync(STRONGSWAN_PATHS.crlDir)
    .filter(f => f.endsWith('.pem') || f.endsWith('.crl'))
    .map(f => path.basename(f))
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
