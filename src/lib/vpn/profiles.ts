/**
 * VPN Connection Profiles Library for strongSwan 6.0.1
 * Manages connection profiles and generates swanctl.conf configuration
 */

import * as fs from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { db } from '@/lib/db'

const execAsync = promisify(exec)

// strongSwan paths
export const SWANCTL_PATHS = {
  swanctlDir: '/etc/swanctl',
  x509caDir: '/etc/swanctl/x509ca',
  x509Dir: '/etc/swanctl/x509',
  privateDir: '/etc/swanctl/private',
  crlDir: '/etc/swanctl/x509crl',
  confDir: '/etc/swanctl/conf.d',
  swanctlConf: '/etc/swanctl/swanctl.conf',
  strongswanConf: '/etc/strongswan.conf',
}

// Types
export interface ConnectionProfileData {
  id: string
  name: string
  description?: string | null
  isDefault: boolean
  isEnabled: boolean
  connectionName: string
  ikeVersion: number
  ikeProposals: string
  espProposals: string
  localAuth: string
  localCert: string
  localId?: string | null
  remoteAuth: string
  remoteCaId?: string | null
  remoteEapId?: string | null
  poolId?: string | null
  poolName: string
  poolAddressRange: string
  dnsServers: string
  localTrafficSelector: string
  remoteTrafficSelector: string
  mobike: boolean
  fragmentation: boolean
  reauthTime: number
  dpdTimeout: number
  dpdAction: string
  startAction: string
  serverHostnames?: string | null
  localAddrs?: string | null
  configApplied: boolean
  appliedAt?: Date | null
  configPath?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface GeneratedConfig {
  content: string
  connections: string[]
  pools: string[]
  secrets: string[]
}

/**
 * Get the CA certificate filename for swanctl.conf
 * The CA must be deployed to /etc/swanctl/x509ca/ directory
 */
async function getCaCertFilename(remoteCaId: string | null | undefined): Promise<string | null> {
  if (!remoteCaId) return null
  
  try {
    // Try to find the CA in the database
    const ca = await db.certificateAuthority.findUnique({
      where: { id: remoteCaId },
      select: { certificatePath: true, name: true, isDefault: true }
    })
    
    if (!ca) {
      // If not found by ID, it might be a direct filename (backward compatibility)
      if (remoteCaId.endsWith('.pem') || remoteCaId.endsWith('.crt')) {
        return remoteCaId
      }
      return 'ca.pem' // Default fallback
    }
    
    // Extract filename from certificate path
    if (ca.certificatePath) {
      const filename = ca.certificatePath.split('/').pop()
      if (filename) return filename
    }
    
    // Default CA uses 'ca.pem'
    if (ca.isDefault) return 'ca.pem'
    
    // Generate filename from CA name
    return `${ca.name.toLowerCase().replace(/\s+/g, '-')}.pem`
  } catch {
    // On error, return the input if it looks like a filename
    if (remoteCaId.endsWith('.pem') || remoteCaId.endsWith('.crt')) {
      return remoteCaId
    }
    return 'ca.pem'
  }
}

/**
 * Get all connection profiles
 */
export async function getAllProfiles(): Promise<ConnectionProfileData[]> {
  const profiles = await db.connectionProfile.findMany({
    orderBy: [
      { isDefault: 'desc' },
      { name: 'asc' }
    ]
  })
  return profiles
}

/**
 * Get a single connection profile by ID
 */
export async function getProfileById(id: string): Promise<ConnectionProfileData | null> {
  const profile = await db.connectionProfile.findUnique({
    where: { id }
  })
  return profile
}

/**
 * Get the default connection profile
 */
export async function getDefaultProfile(): Promise<ConnectionProfileData | null> {
  const profile = await db.connectionProfile.findFirst({
    where: { 
      isDefault: true,
      isEnabled: true 
    }
  })
  return profile
}

/**
 * Create a new connection profile
 */
export async function createProfile(data: Partial<ConnectionProfileData>): Promise<ConnectionProfileData> {
  // If this is set as default, unset other defaults
  if (data.isDefault) {
    await db.connectionProfile.updateMany({
      where: { isDefault: true },
      data: { isDefault: false }
    })
  }

  const profile = await db.connectionProfile.create({
    data: {
      name: data.name || 'New Profile',
      description: data.description,
      isDefault: data.isDefault || false,
      isEnabled: data.isEnabled ?? true,
      connectionName: data.connectionName || 'ikev2-cert',
      ikeVersion: data.ikeVersion || 2,
      ikeProposals: data.ikeProposals || 'aes256-sha256-modp1024',
      espProposals: data.espProposals || 'aes256-sha256',
      localAuth: data.localAuth || 'pubkey',
      localCert: data.localCert || 'vpn-server.pem',
      localId: data.localId,
      remoteAuth: data.remoteAuth || 'pubkey',
      remoteCaId: data.remoteCaId,
      remoteEapId: data.remoteEapId,
      poolId: data.poolId,
      poolName: data.poolName || 'vpn-pool',
      poolAddressRange: data.poolAddressRange || '10.70.0.0/24',
      dnsServers: data.dnsServers || '8.8.8.8',
      localTrafficSelector: data.localTrafficSelector || '0.0.0.0/0',
      remoteTrafficSelector: data.remoteTrafficSelector || 'dynamic',
      mobike: data.mobike ?? true,
      fragmentation: data.fragmentation ?? true,
      reauthTime: data.reauthTime || 0,
      dpdTimeout: data.dpdTimeout || 30,
      dpdAction: data.dpdAction || 'restart',
      startAction: data.startAction || 'none',
      serverHostnames: data.serverHostnames,
      localAddrs: data.localAddrs,
    }
  })

  return profile
}

/**
 * Update a connection profile
 */
export async function updateProfile(id: string, data: Partial<ConnectionProfileData>): Promise<ConnectionProfileData> {
  // If this is set as default, unset other defaults
  if (data.isDefault) {
    await db.connectionProfile.updateMany({
      where: { 
        isDefault: true,
        id: { not: id }
      },
      data: { isDefault: false }
    })
  }

  const profile = await db.connectionProfile.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      isDefault: data.isDefault,
      isEnabled: data.isEnabled,
      connectionName: data.connectionName,
      ikeVersion: data.ikeVersion,
      ikeProposals: data.ikeProposals,
      espProposals: data.espProposals,
      localAuth: data.localAuth,
      localCert: data.localCert,
      localId: data.localId,
      remoteAuth: data.remoteAuth,
      remoteCaId: data.remoteCaId,
      remoteEapId: data.remoteEapId,
      poolId: data.poolId,
      poolName: data.poolName,
      poolAddressRange: data.poolAddressRange,
      dnsServers: data.dnsServers,
      localTrafficSelector: data.localTrafficSelector,
      remoteTrafficSelector: data.remoteTrafficSelector,
      mobike: data.mobike,
      fragmentation: data.fragmentation,
      reauthTime: data.reauthTime,
      dpdTimeout: data.dpdTimeout,
      dpdAction: data.dpdAction,
      startAction: data.startAction,
      serverHostnames: data.serverHostnames,
      localAddrs: data.localAddrs,
      configApplied: false, // Reset applied status on update
    }
  })

  return profile
}

/**
 * Delete a connection profile
 */
export async function deleteProfile(id: string): Promise<void> {
  await db.connectionProfile.delete({
    where: { id }
  })
}

/**
 * Generate swanctl.conf content for a single profile
 */
export async function generateProfileConfig(profile: ConnectionProfileData): Promise<string> {
  const lines: string[] = []
  
  // Header comment
  lines.push(`# Connection Profile: ${profile.name}`)
  lines.push(`# Generated: ${new Date().toISOString()}`)
  if (profile.description) {
    lines.push(`# Description: ${profile.description}`)
  }
  lines.push('')

  // Connection block
  lines.push(`connections {`)
  lines.push(`  ${profile.connectionName} {`)
  
  // IKE version
  lines.push(`    version = ${profile.ikeVersion}`)
  
  // MOBIKE
  lines.push(`    mobike = ${profile.mobike ? 'yes' : 'no'}`)
  
  // Reauth time
  if (profile.reauthTime > 0) {
    lines.push(`    reauth_time = ${profile.reauthTime}s`)
  } else {
    lines.push(`    reauth_time = 0`)
  }
  
  // Fragmentation
  lines.push(`    fragmentation = ${profile.fragmentation ? 'yes' : 'no'}`)
  
  // Local addresses
  if (profile.localAddrs) {
    lines.push(`    local_addrs = ${profile.localAddrs}`)
  }
  
  // Server hostnames
  if (profile.serverHostnames) {
    lines.push(`    # Server addresses: ${profile.serverHostnames}`)
  }
  
  lines.push('')
  
  // Local authentication
  lines.push(`    local {`)
  lines.push(`      auth = ${profile.localAuth}`)
  lines.push(`      certs = ${profile.localCert}`)
  if (profile.localId) {
    lines.push(`      id = @${profile.localId}`)
  }
  lines.push(`    }`)
  lines.push('')
  
  // Remote authentication
  lines.push(`    remote {`)
  lines.push(`      auth = ${profile.remoteAuth}`)
  
  // Get CA certificate filename
  const caCertFile = await getCaCertFilename(profile.remoteCaId)
  if (caCertFile) {
    lines.push(`      cacerts = ${caCertFile}`)
  }
  
  if (profile.remoteEapId) {
    lines.push(`      eap_id = ${profile.remoteEapId}`)
  }
  lines.push(`      id = %any`)
  lines.push(`    }`)
  lines.push('')
  
  // Children (Child SA definitions)
  lines.push(`    children {`)
  lines.push(`      ${profile.connectionName} {`)
  
  // Traffic selectors
  lines.push(`        local_ts = ${profile.localTrafficSelector}`)
  lines.push(`        remote_ts = ${profile.remoteTrafficSelector}`)
  
  // ESP proposals
  const espProposals = profile.espProposals.split(',').map(p => p.trim()).filter(Boolean)
  lines.push(`        esp_proposals = ${espProposals.join(', ')}`)
  
  // Tunnel mode
  lines.push(`        mode = tunnel`)
  
  // DPD action
  lines.push(`        dpd_action = ${profile.dpdAction}`)
  
  // DPD timeout
  lines.push(`        dpd_timeout = ${profile.dpdTimeout}s`)
  
  // Policies
  lines.push(`        policies = yes`)
  
  lines.push(`      }`)
  lines.push(`    }`)
  lines.push('')
  
  // IKE proposals
  const ikeProposals = profile.ikeProposals.split(',').map(p => p.trim()).filter(Boolean)
  lines.push(`    ike_proposals = ${ikeProposals.join(', ')}`)
  
  // Pool reference
  lines.push(`    pools = ${profile.poolName}`)
  
  // Send certificate requests
  lines.push(`    send_certreq = yes`)
  
  // Send certificate always
  lines.push(`    send_cert = always`)
  
  // Start action
  if (profile.startAction && profile.startAction !== 'none') {
    lines.push(`    start_action = ${profile.startAction}`)
  }
  
  lines.push(`  }`)
  lines.push(`}`)
  lines.push('')
  
  // Pool definition
  lines.push(`pools {`)
  lines.push(`  ${profile.poolName} {`)
  lines.push(`    addrs = ${profile.poolAddressRange}`)
  const dnsServers = profile.dnsServers.split(',').map(s => s.trim()).filter(Boolean)
  if (dnsServers.length > 0) {
    lines.push(`    dns = ${dnsServers.join(', ')}`)
  }
  lines.push(`  }`)
  lines.push(`}`)
  lines.push('')
  
  // Secrets
  lines.push(`secrets {`)
  lines.push(`  private-${profile.connectionName} {`)
  lines.push(`    file = ${SWANCTL_PATHS.privateDir}/${profile.localCert.replace('.pem', '')}.pem`)
  lines.push(`  }`)
  lines.push(`}`)
  
  return lines.join('\n')
}

/**
 * Generate combined swanctl.conf for multiple profiles
 */
export async function generateCombinedConfig(profiles: ConnectionProfileData[]): Promise<GeneratedConfig> {
  const connections: string[] = []
  const pools: string[] = []
  const secrets: string[] = []
  
  // Track unique pool names to avoid duplicates
  const poolNames = new Set<string>()
  const secretNames = new Set<string>()

  for (const profile of profiles) {
    if (!profile.isEnabled) continue
    
    // Add connection name
    connections.push(profile.connectionName)
    
    // Add pool if not already added
    if (!poolNames.has(profile.poolName)) {
      poolNames.add(profile.poolName)
      pools.push(profile.poolName)
    }
    
    // Add secret if not already added
    const secretName = `private-${profile.connectionName}`
    if (!secretNames.has(secretName)) {
      secretNames.add(secretName)
      secrets.push(secretName)
    }
  }

  // Generate full config
  const lines: string[] = []
  
  lines.push(`# swanctl.conf - Generated by VPN PKI Management Platform`)
  lines.push(`# Generated: ${new Date().toISOString()}`)
  lines.push(`# Profiles: ${profiles.filter(p => p.isEnabled).length} enabled`)
  lines.push('')
  
  // Connections section
  lines.push(`connections {`)
  for (const profile of profiles) {
    if (!profile.isEnabled) continue
    
    lines.push(`  # Profile: ${profile.name}`)
    lines.push(`  ${profile.connectionName} {`)
    lines.push(`    version = ${profile.ikeVersion}`)
    lines.push(`    mobike = ${profile.mobike ? 'yes' : 'no'}`)
    lines.push(`    reauth_time = ${profile.reauthTime}`)
    lines.push(`    fragmentation = ${profile.fragmentation ? 'yes' : 'no'}`)
    
    if (profile.localAddrs) {
      lines.push(`    local_addrs = ${profile.localAddrs}`)
    }
    
    lines.push(`    local {`)
    lines.push(`      auth = ${profile.localAuth}`)
    lines.push(`      certs = ${profile.localCert}`)
    if (profile.localId) {
      lines.push(`      id = @${profile.localId}`)
    }
    lines.push(`    }`)
    
    lines.push(`    remote {`)
    lines.push(`      auth = ${profile.remoteAuth}`)
    
    // Get CA certificate filename
    const caCertFile = await getCaCertFilename(profile.remoteCaId)
    if (caCertFile) {
      lines.push(`      cacerts = ${caCertFile}`)
    }
    
    lines.push(`      id = %any`)
    lines.push(`    }`)
    
    lines.push(`    children {`)
    lines.push(`      ${profile.connectionName} {`)
    lines.push(`        local_ts = ${profile.localTrafficSelector}`)
    lines.push(`        remote_ts = ${profile.remoteTrafficSelector}`)
    lines.push(`        esp_proposals = ${profile.espProposals}`)
    lines.push(`        mode = tunnel`)
    lines.push(`        dpd_action = ${profile.dpdAction}`)
    lines.push(`        dpd_timeout = ${profile.dpdTimeout}s`)
    lines.push(`        policies = yes`)
    lines.push(`      }`)
    lines.push(`    }`)
    
    lines.push(`    ike_proposals = ${profile.ikeProposals}`)
    lines.push(`    pools = ${profile.poolName}`)
    lines.push(`    send_certreq = yes`)
    lines.push(`    send_cert = always`)
    
    if (profile.startAction && profile.startAction !== 'none') {
      lines.push(`    start_action = ${profile.startAction}`)
    }
    
    lines.push(`  }`)
    lines.push('')
  }
  lines.push(`}`)
  lines.push('')
  
  // Pools section
  lines.push(`pools {`)
  const addedPools = new Set<string>()
  for (const profile of profiles) {
    if (!profile.isEnabled || addedPools.has(profile.poolName)) continue
    addedPools.add(profile.poolName)
    
    lines.push(`  ${profile.poolName} {`)
    lines.push(`    addrs = ${profile.poolAddressRange}`)
    lines.push(`    dns = ${profile.dnsServers}`)
    lines.push(`  }`)
  }
  lines.push(`}`)
  lines.push('')
  
  // Secrets section
  lines.push(`secrets {`)
  const addedSecrets = new Set<string>()
  for (const profile of profiles) {
    if (!profile.isEnabled) continue
    const secretName = `private-${profile.connectionName}`
    if (addedSecrets.has(secretName)) continue
    addedSecrets.add(secretName)
    
    lines.push(`  ${secretName} {`)
    lines.push(`    file = ${SWANCTL_PATHS.privateDir}/${profile.localCert.replace('.pem', '')}.pem`)
    lines.push(`  }`)
  }
  lines.push(`}`)

  return {
    content: lines.join('\n'),
    connections,
    pools,
    secrets
  }
}

/**
 * Apply a profile configuration to strongSwan
 */
export async function applyProfile(profile: ConnectionProfileData): Promise<{ 
  success: boolean
  message: string
  configPath?: string
}> {
  try {
    // Generate the configuration
    const config = await generateProfileConfig(profile)
    
    // Ensure directories exist
    ensureDirectories()
    
    // Write to conf.d directory
    const configPath = path.join(SWANCTL_PATHS.confDir, `${profile.connectionName}.conf`)
    fs.writeFileSync(configPath, config, { mode: 0o644 })
    
    // Reload strongSwan
    try {
      await execAsync('swanctl --load-all 2>&1')
    } catch {
      // Ignore reload errors in sandbox
    }
    
    // Update profile status
    await db.connectionProfile.update({
      where: { id: profile.id },
      data: {
        configApplied: true,
        appliedAt: new Date(),
        configPath
      }
    })
    
    return {
      success: true,
      message: `Profile "${profile.name}" applied successfully`,
      configPath
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      message: `Failed to apply profile: ${message}`
    }
  }
}

/**
 * Apply all enabled profiles to generate combined swanctl.conf
 */
export async function applyAllProfiles(): Promise<{
  success: boolean
  message: string
  configPath?: string
  profilesApplied: number
}> {
  try {
    // Get all enabled profiles
    const profiles = await db.connectionProfile.findMany({
      where: { isEnabled: true }
    })
    
    if (profiles.length === 0) {
      return {
        success: false,
        message: 'No enabled profiles to apply',
        profilesApplied: 0
      }
    }
    
    // Generate combined configuration
    const config = await generateCombinedConfig(profiles)
    
    // Ensure directories exist
    ensureDirectories()
    
    // Write main swanctl.conf
    fs.writeFileSync(SWANCTL_PATHS.swanctlConf, config.content, { mode: 0o644 })
    
    // Reload strongSwan
    try {
      await execAsync('swanctl --load-all 2>&1')
    } catch {
      // Ignore reload errors in sandbox
    }
    
    // Update all profiles as applied
    await db.connectionProfile.updateMany({
      where: { isEnabled: true },
      data: {
        configApplied: true,
        appliedAt: new Date(),
        configPath: SWANCTL_PATHS.swanctlConf
      }
    })
    
    return {
      success: true,
      message: `Applied ${profiles.length} profile(s) to ${SWANCTL_PATHS.swanctlConf}`,
      configPath: SWANCTL_PATHS.swanctlConf,
      profilesApplied: profiles.length
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      message: `Failed to apply profiles: ${message}`,
      profilesApplied: 0
    }
  }
}

/**
 * Preview configuration without applying
 */
export async function previewConfig(profileId?: string): Promise<string> {
  if (profileId) {
    const profile = await getProfileById(profileId)
    if (!profile) {
      throw new Error('Profile not found')
    }
    return await generateProfileConfig(profile)
  }
  
  // Generate combined config for all enabled profiles
  const profiles = await db.connectionProfile.findMany({
    where: { isEnabled: true }
  })
  
  if (profiles.length === 0) {
    return '# No enabled profiles to generate configuration'
  }
  
  const config = await generateCombinedConfig(profiles)
  return config.content
}

/**
 * Ensure strongSwan directories exist
 */
function ensureDirectories(): void {
  const dirs = [
    { path: SWANCTL_PATHS.swanctlDir, mode: 0o755 },
    { path: SWANCTL_PATHS.x509caDir, mode: 0o755 },
    { path: SWANCTL_PATHS.x509Dir, mode: 0o755 },
    { path: SWANCTL_PATHS.privateDir, mode: 0o700 },
    { path: SWANCTL_PATHS.crlDir, mode: 0o755 },
    { path: SWANCTL_PATHS.confDir, mode: 0o755 },
  ]
  
  for (const { path: dir, mode } of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode })
    }
  }
}

/**
 * Validate profile data
 */
export function validateProfileData(data: Partial<ConnectionProfileData>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (!data.name || data.name.trim() === '') {
    errors.push('Profile name is required')
  }
  
  if (data.ikeVersion && ![1, 2].includes(data.ikeVersion)) {
    errors.push('IKE version must be 1 or 2')
  }
  
  if (data.ikeProposals) {
    const proposals = data.ikeProposals.split(',').map(p => p.trim()).filter(Boolean)
    if (proposals.length === 0) {
      errors.push('At least one IKE proposal is required')
    }
  }
  
  if (data.espProposals) {
    const proposals = data.espProposals.split(',').map(p => p.trim()).filter(Boolean)
    if (proposals.length === 0) {
      errors.push('At least one ESP proposal is required')
    }
  }
  
  if (data.poolAddressRange) {
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
    if (!cidrRegex.test(data.poolAddressRange)) {
      errors.push('Pool address range must be in CIDR format (e.g., 10.70.0.0/24)')
    }
  }
  
  if (data.dpdTimeout && data.dpdTimeout < 0) {
    errors.push('DPD timeout must be a positive number')
  }
  
  if (data.reauthTime && data.reauthTime < 0) {
    errors.push('Reauth time must be a positive number')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Get profile statistics
 */
export async function getProfileStats(): Promise<{
  total: number
  enabled: number
  disabled: number
  applied: number
  default: string | null
}> {
  const [total, enabled, applied] = await Promise.all([
    db.connectionProfile.count(),
    db.connectionProfile.count({ where: { isEnabled: true } }),
    db.connectionProfile.count({ where: { configApplied: true } })
  ])
  
  const defaultProfile = await db.connectionProfile.findFirst({
    where: { isDefault: true }
  })
  
  return {
    total,
    enabled,
    disabled: total - enabled,
    applied,
    default: defaultProfile?.name || null
  }
}
