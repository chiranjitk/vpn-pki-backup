/**
 * Network Interfaces Library for Debian 13
 * 
 * Detects and configures real network interfaces from the system.
 * Supports:
 * - /sys/class/net/ for interface list
 * - ip addr show for IP addresses
 * - /etc/network/interfaces or Netplan for configuration
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { readFile, readdir, writeFile, access } from 'fs/promises'
import { constants } from 'fs'
import path from 'path'

const execAsync = promisify(exec)

// Types
export type InterfaceType = 'WAN' | 'LAN' | 'VPN' | 'MANAGEMENT' | 'LOOPBACK'
export type IpMethod = 'DHCP' | 'STATIC' | 'PPPOE' | 'MANUAL'
export type InterfaceStatus = 'UP' | 'DOWN' | 'UNKNOWN'

export interface NetworkInterface {
  name: string
  type: InterfaceType
  ipMethod: IpMethod
  ipAddress: string
  subnetMask: string
  gateway: string
  dnsServers: string[]
  mac: string
  mtu: number
  status: InterfaceStatus
  isDefaultGateway: boolean
  isEnabled: boolean
  rxBytes: number
  txBytes: number
  description?: string
  speed?: string
  duplex?: string
  operState?: string
  driver?: string
  vendor?: string
  model?: string
}

export interface InterfaceConfig {
  name: string
  type: InterfaceType
  ipMethod: IpMethod
  ipAddress: string
  subnetMask: string
  gateway: string
  dnsServers: string[]
  mtu: number
  isDefaultGateway: boolean
  isEnabled: boolean
  pppoeUsername?: string
  pppoePassword?: string
  description?: string
}

interface IpAddrInfo {
  ifindex: number
  ifname: string
  flags: string[]
  mtu: number
  qdisc: string
  operstate: string
  linkmode: string
  group: string
  txqlen: number
  link_type: string
  address: string
  broadcast: string
  addr_info: Array<{
    family: string
    local: string
    prefixlen: number
    scope: string
    dynamic?: boolean
    noprefixroute?: boolean
    label?: string
    valid_life_time: number
    preferred_life_time: number
  }>
}

/**
 * Execute a command safely with timeout and error handling
 */
async function safeExec(command: string, timeout = 10000): Promise<string | null> {
  try {
    const { stdout } = await execAsync(command, { 
      timeout,
      maxBuffer: 1024 * 1024 // 1MB buffer
    })
    return stdout.trim()
  } catch {
    return null
  }
}

/**
 * Check if a file exists and is readable
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.R_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Detect interface type based on name and properties
 */
function detectInterfaceType(name: string, linkType: string, operState: string): InterfaceType {
  // Loopback
  if (name === 'lo') {
    return 'LOOPBACK'
  }

  // VPN tunnels
  if (name.startsWith('tun') || name.startsWith('tap') || name.startsWith('ppp')) {
    return 'VPN'
  }

  // Virtual interfaces
  if (name.startsWith('veth') || name.startsWith('docker') || name.startsWith('br-') || name.startsWith('vnet')) {
    return 'VPN'
  }

  // Wireless interfaces
  if (name.startsWith('wlan') || name.startsWith('wlp') || name.startsWith('wlp') || name.startsWith('wlp')) {
    return 'WAN'
  }

  // Ethernet interfaces - try to determine WAN vs LAN
  if (name.startsWith('eth') || name.startsWith('enp') || name.startsWith('eno') || name.startsWith('ens')) {
    // If it's the primary interface (usually eth0 or enp3s0), consider it WAN
    if (name === 'eth0' || name.match(/^enp\d+s\d+$/)) {
      return 'WAN'
    }
    return 'LAN'
  }

  // Default to LAN for unknown
  return 'LAN'
}

/**
 * Get the subnet mask from CIDR prefix length
 */
function prefixToSubnetMask(prefix: number): string {
  const mask = []
  for (let i = 0; i < 4; i++) {
    const n = Math.min(8, Math.max(0, prefix - i * 8))
    mask.push(256 - Math.pow(2, 8 - n))
  }
  return mask.join('.')
}

/**
 * Get default gateway for the system
 */
async function getDefaultGateway(): Promise<string> {
  const output = await safeExec('ip route show default')
  if (!output) return ''

  // Parse: default via 192.168.1.1 dev eth0 proto dhcp src 192.168.1.10 metric 100
  const match = output.match(/default via ([\d.]+)/)
  return match ? match[1] : ''
}

/**
 * Get DNS servers from system
 */
async function getDnsServers(): Promise<string[]> {
  const servers: string[] = []

  // Try resolv.conf
  try {
    const resolvConf = await readFile('/etc/resolv.conf', 'utf-8')
    const lines = resolvConf.split('\n')
    for (const line of lines) {
      const match = line.match(/^nameserver\s+([\d.]+)/)
      if (match) {
        servers.push(match[1])
      }
    }
  } catch {
    // Ignore errors
  }

  // Try systemd-resolved if available
  if (servers.length === 0) {
    const output = await safeExec('resolvectl status 2>/dev/null || systemd-resolve --status 2>/dev/null')
    if (output) {
      const matches = output.matchAll(/DNS Servers?: ([\d.]+)/g)
      for (const match of matches) {
        if (!servers.includes(match[1])) {
          servers.push(match[1])
        }
      }
    }
  }

  return servers.slice(0, 3) // Max 3 DNS servers
}

/**
 * Get interface statistics from /sys/class/net
 */
async function getInterfaceStats(name: string): Promise<{ rxBytes: number; txBytes: number }> {
  try {
    const basePath = `/sys/class/net/${name}/statistics`
    const [rxBytes, txBytes] = await Promise.all([
      readFile(`${basePath}/rx_bytes`, 'utf-8'),
      readFile(`${basePath}/tx_bytes`, 'utf-8')
    ])
    return {
      rxBytes: parseInt(rxBytes.trim(), 10) || 0,
      txBytes: parseInt(txBytes.trim(), 10) || 0
    }
  } catch {
    return { rxBytes: 0, txBytes: 0 }
  }
}

/**
 * Get MTU from /sys/class/net
 */
async function getInterfaceMtu(name: string): Promise<number> {
  try {
    const mtu = await readFile(`/sys/class/net/${name}/mtu`, 'utf-8')
    return parseInt(mtu.trim(), 10) || 1500
  } catch {
    return 1500
  }
}

/**
 * Get operational state from /sys/class/net
 */
async function getInterfaceOperState(name: string): Promise<InterfaceStatus> {
  try {
    const state = await readFile(`/sys/class/net/${name}/operstate`, 'utf-8')
    const s = state.trim().toLowerCase()
    if (s === 'up' || s === 'unknown') return 'UP'
    if (s === 'down') return 'DOWN'
    return 'UNKNOWN'
  } catch {
    return 'UNKNOWN'
  }
}

/**
 * Get interface speed and duplex for ethernet
 */
async function getInterfaceSpeedDuplex(name: string): Promise<{ speed: string; duplex: string }> {
  try {
    const basePath = `/sys/class/net/${name}`
    const [speedFile, duplexFile] = await Promise.all([
      readFile(`${basePath}/speed`, 'utf-8').catch(() => ''),
      readFile(`${basePath}/duplex`, 'utf-8').catch(() => '')
    ])

    const speed = speedFile.trim()
    const duplex = duplexFile.trim()

    return {
      speed: speed && speed !== 'Unknown!' && !isNaN(parseInt(speed)) ? `${speed} Mbps` : 'Unknown',
      duplex: duplex || 'Unknown'
    }
  } catch {
    return { speed: 'Unknown', duplex: 'Unknown' }
  }
}

/**
 * Get driver and hardware info using ethtool
 */
async function getInterfaceHardwareInfo(name: string): Promise<{ driver: string; vendor: string; model: string }> {
  const result = { driver: 'Unknown', vendor: 'Unknown', model: 'Unknown' }

  const ethtoolOutput = await safeExec(`ethtool -i ${name} 2>/dev/null`)
  if (ethtoolOutput) {
    const driverMatch = ethtoolOutput.match(/driver:\s*(.+)/m)
    if (driverMatch) {
      result.driver = driverMatch[1]
    }
  }

  // Try to get PCI info
  const lspciOutput = await safeExec('lspci -nn 2>/dev/null')
  if (lspciOutput && result.driver !== 'Unknown') {
    // Find matching device based on driver
    const lines = lspciOutput.split('\n')
    for (const line of lines) {
      if (line.toLowerCase().includes('ethernet') || line.toLowerCase().includes('network')) {
        const match = line.match(/^(.+?):\s*(.+)$/)
        if (match) {
          result.vendor = match[1].trim()
          result.model = match[2].trim()
          break
        }
      }
    }
  }

  return result
}

/**
 * Detect if interface has DHCP configuration
 */
async function detectDhcpConfig(name: string): Promise<boolean> {
  // Check dhclient lease
  const leaseFiles = [
    `/var/lib/dhcp/dhclient.${name}.leases`,
    `/var/lib/dhcp/dhclient.leases`,
    `/var/lib/NetworkManager/dhclient-${name}.conf`,
  ]

  for (const file of leaseFiles) {
    if (await fileExists(file)) {
      return true
    }
  }

  // Check NetworkManager connection
  const nmOutput = await safeExec(`nmcli -t -f DEVICE,METHOD device show ${name} 2>/dev/null`)
  if (nmOutput && nmOutput.includes('auto')) {
    return true
  }

  // Check for dhcpcd
  const dhcpcdPid = await safeExec(`pgrep -f "dhcpcd.*${name}"`)
  if (dhcpcdPid) {
    return true
  }

  return false
}

/**
 * Get all network interfaces from the system
 */
export async function getSystemInterfaces(): Promise<NetworkInterface[]> {
  const interfaces: NetworkInterface[] = []

  // Get all interfaces using ip command (JSON output)
  const ipOutput = await safeExec('ip -j addr show 2>/dev/null')
  let ipData: IpAddrInfo[] = []

  if (ipOutput) {
    try {
      ipData = JSON.parse(ipOutput)
    } catch {
      // Fall back to parsing non-JSON output
      const plainOutput = await safeExec('ip addr show')
      if (plainOutput) {
        // Parse manually - simplified
        const interfaceBlocks = plainOutput.split(/\n(?=\d+:)/)
        for (const block of interfaceBlocks) {
          const nameMatch = block.match(/^\d+:\s*([^:@\s]+)/)
          if (nameMatch) {
            ipData.push({
              ifindex: 0,
              ifname: nameMatch[1],
              flags: [],
              mtu: 1500,
              qdisc: '',
              operstate: block.includes('state UP') ? 'UP' : 'DOWN',
              linkmode: '',
              group: '',
              txqlen: 0,
              link_type: block.includes('link/ether') ? 'ether' : 'loopback',
              address: '',
              broadcast: '',
              addr_info: []
            })
          }
        }
      }
    }
  }

  // Fallback: read from /sys/class/net
  if (ipData.length === 0) {
    try {
      const netDir = '/sys/class/net'
      const entries = await readdir(netDir)
      for (const name of entries) {
        ipData.push({
          ifindex: 0,
          ifname: name,
          flags: [],
          mtu: 1500,
          qdisc: '',
          operstate: 'UNKNOWN',
          linkmode: '',
          group: '',
          txqlen: 0,
          link_type: 'unknown',
          address: '',
          broadcast: '',
          addr_info: []
        })
      }
    } catch {
      // Return empty if we can't read interfaces
      return []
    }
  }

  // Get default gateway
  const defaultGateway = await getDefaultGateway()
  const defaultGatewayInterface = await safeExec('ip route show default | sed -n "s/.*dev \\([^ ]*\\).*/\\1/p"')

  // Get DNS servers
  const dnsServers = await getDnsServers()

  // Process each interface
  for (const iface of ipData) {
    const name = iface.ifname
    if (!name) continue

    // Skip virtual interfaces we don't care about
    if (name.startsWith('veth') && !name.startsWith('veth0')) continue
    if (name.startsWith('docker') && name !== 'docker0') continue

    // Get operational state
    const operState = await getInterfaceOperState(name)
    const status: InterfaceStatus = operState

    // Get MTU
    const mtu = iface.mtu || await getInterfaceMtu(name)

    // Get MAC address
    const mac = iface.address || (await safeExec(`cat /sys/class/net/${name}/address 2>/dev/null`)) || '-'

    // Get link type
    const linkType = iface.link_type || 'unknown'

    // Detect interface type
    const type = detectInterfaceType(name, linkType, operState)

    // Get IP addresses
    let ipAddress = ''
    let subnetMask = ''
    let isDhcp = false
    let scope = 'global'

    for (const addr of iface.addr_info) {
      if (addr.family === 'inet' && (addr.scope === 'global' || addr.scope === 'universe')) {
        ipAddress = addr.local
        subnetMask = prefixToSubnetMask(addr.prefixlen)
        isDhcp = !!addr.dynamic
        scope = addr.scope
        break
      }
    }

    // If no IP found from JSON, try to parse from ip command output
    if (!ipAddress) {
      const ipAddrOutput = await safeExec(`ip -4 addr show ${name} 2>/dev/null`)
      if (ipAddrOutput) {
        const match = ipAddrOutput.match(/inet ([\d.]+)\/(\d+)/)
        if (match) {
          ipAddress = match[1]
          subnetMask = prefixToSubnetMask(parseInt(match[2], 10))
        }
      }
    }

    // Check for DHCP
    if (!isDhcp) {
      isDhcp = await detectDhcpConfig(name)
    }

    // Determine IP method
    let ipMethod: IpMethod = 'MANUAL'
    if (type === 'LOOPBACK') {
      ipMethod = 'MANUAL'
    } else if (type === 'VPN') {
      ipMethod = 'MANUAL'
    } else if (isDhcp) {
      ipMethod = 'DHCP'
    } else if (ipAddress) {
      ipMethod = 'STATIC'
    }

    // Get stats
    const { rxBytes, txBytes } = await getInterfaceStats(name)

    // Get speed/duplex for ethernet
    const { speed, duplex } = type !== 'LOOPBACK' && type !== 'VPN' 
      ? await getInterfaceSpeedDuplex(name) 
      : { speed: 'N/A', duplex: 'N/A' }

    // Get hardware info
    const { driver, vendor, model } = type !== 'LOOPBACK' && type !== 'VPN'
      ? await getInterfaceHardwareInfo(name)
      : { driver: 'N/A', vendor: 'N/A', model: 'N/A' }

    // Check if this is the default gateway interface
    const isDefaultGateway = defaultGatewayInterface?.trim() === name

    // Determine if enabled (UP flag or admin up)
    const isEnabled = iface.flags?.includes('UP') || operState === 'UP' || status === 'UP'

    // Get gateway for this interface
    let gateway = ''
    if (isDefaultGateway && defaultGateway) {
      gateway = defaultGateway
    } else if (type !== 'LOOPBACK') {
      // Try to get interface-specific gateway
      const routeOutput = await safeExec(`ip route show dev ${name} 2>/dev/null`)
      if (routeOutput) {
        const match = routeOutput.match(/via ([\d.]+)/)
        if (match) {
          gateway = match[1]
        }
      }
    }

    interfaces.push({
      name,
      type,
      ipMethod,
      ipAddress,
      subnetMask,
      gateway,
      dnsServers: isDefaultGateway ? dnsServers : [],
      mac: mac || '-',
      mtu,
      status,
      isDefaultGateway,
      isEnabled,
      rxBytes,
      txBytes,
      description: '',
      speed,
      duplex,
      operState: operState,
      driver,
      vendor,
      model,
    })
  }

  return interfaces
}

/**
 * Get configuration for a specific interface
 */
export async function getInterfaceConfig(name: string): Promise<InterfaceConfig | null> {
  const interfaces = await getSystemInterfaces()
  const iface = interfaces.find(i => i.name === name)
  
  if (!iface) return null

  return {
    name: iface.name,
    type: iface.type,
    ipMethod: iface.ipMethod,
    ipAddress: iface.ipAddress,
    subnetMask: iface.subnetMask,
    gateway: iface.gateway,
    dnsServers: iface.dnsServers,
    mtu: iface.mtu,
    isDefaultGateway: iface.isDefaultGateway,
    isEnabled: iface.isEnabled,
    description: iface.description,
  }
}

/**
 * Check if system uses Netplan
 */
async function usesNetplan(): Promise<boolean> {
  const netplanDir = '/etc/netplan'
  try {
    const files = await readdir(netplanDir)
    return files.some(f => f.endsWith('.yaml') || f.endsWith('.yml'))
  } catch {
    return false
  }
}

/**
 * Generate Netplan configuration
 */
function generateNetplanConfig(config: InterfaceConfig): string {
  const lines: string[] = ['network:', '  version: 2', '  ethernets:']

  if (config.ipMethod === 'DHCP') {
    lines.push(`    ${config.name}:`)
    lines.push('      dhcp4: true')
    if (config.mtu !== 1500) {
      lines.push(`      mtu: ${config.mtu}`)
    }
  } else if (config.ipMethod === 'STATIC') {
    const cidr = config.ipAddress ? 
      `${config.ipAddress}/${config.subnetMask.split('.').reduce((acc, octet) => acc + (parseInt(octet, 10) > 0 ? 1 : 0), 0)}` :
      ''
    
    lines.push(`    ${config.name}:`)
    lines.push('      dhcp4: false')
    if (cidr) {
      lines.push(`      addresses:`)
      lines.push(`        - ${cidr}`)
    }
    if (config.gateway) {
      lines.push(`      routes:`)
      lines.push(`        - to: default`)
      lines.push(`          via: ${config.gateway}`)
    }
    if (config.dnsServers.length > 0) {
      lines.push(`      nameservers:`)
      lines.push(`        addresses:`)
      config.dnsServers.forEach(dns => {
        lines.push(`          - ${dns}`)
      })
    }
    if (config.mtu !== 1500) {
      lines.push(`      mtu: ${config.mtu}`)
    }
  }

  // Handle interface disable
  if (!config.isEnabled) {
    lines.push(`      optional: true`)
  }

  return lines.join('\n')
}

/**
 * Generate /etc/network/interfaces configuration
 */
function generateInterfacesFile(config: InterfaceConfig): string {
  const lines: string[] = [
    '# This file describes the network interfaces available on your system',
    '# and how to activate them. For more information, see interfaces(5).',
    '',
    'source /etc/network/interfaces.d/*',
    '',
    '# The loopback network interface',
    'auto lo',
    'iface lo inet loopback',
    '',
  ]

  if (config.ipMethod === 'DHCP') {
    lines.push(`# ${config.name} - ${config.type}`)
    lines.push(`auto ${config.name}`)
    lines.push(`iface ${config.name} inet dhcp`)
    if (config.mtu !== 1500) {
      lines.push(`    mtu ${config.mtu}`)
    }
  } else if (config.ipMethod === 'STATIC') {
    lines.push(`# ${config.name} - ${config.type}`)
    lines.push(`auto ${config.name}`)
    lines.push(`iface ${config.name} inet static`)
    if (config.ipAddress) {
      lines.push(`    address ${config.ipAddress}`)
    }
    if (config.subnetMask) {
      lines.push(`    netmask ${config.subnetMask}`)
    }
    if (config.gateway) {
      lines.push(`    gateway ${config.gateway}`)
    }
    if (config.dnsServers.length > 0) {
      lines.push(`    dns-nameservers ${config.dnsServers.join(' ')}`)
    }
    if (config.mtu !== 1500) {
      lines.push(`    mtu ${config.mtu}`)
    }
  } else if (config.ipMethod === 'PPPOE') {
    lines.push(`# ${config.name} - PPPoE`)
    lines.push(`auto ${config.name}`)
    lines.push(`iface ${config.name} inet ppp`)
    lines.push(`    provider ${config.name}`)
    if (config.pppoeUsername) {
      lines.push(`    user "${config.pppoeUsername}"`)
    }
  }

  return lines.join('\n')
}

/**
 * Apply interface configuration to the system
 */
export async function applyInterfaceConfig(config: InterfaceConfig): Promise<{ success: boolean; message: string; details?: string }> {
  try {
    // Validate configuration
    if (!config.name) {
      return { success: false, message: 'Interface name is required' }
    }

    if (config.ipMethod === 'STATIC') {
      if (!config.ipAddress) {
        return { success: false, message: 'IP Address is required for static configuration' }
      }
      if (!config.subnetMask) {
        return { success: false, message: 'Subnet mask is required for static configuration' }
      }
    }

    if (config.ipMethod === 'PPPOE') {
      if (!config.pppoeUsername) {
        return { success: false, message: 'PPPoE username is required' }
      }
    }

    // Check if interface exists
    const exists = await fileExists(`/sys/class/net/${config.name}`)
    if (!exists) {
      return { success: false, message: `Interface ${config.name} does not exist` }
    }

    // Generate configuration based on system type
    const useNetplan = await usesNetplan()
    let configPath: string
    let configContent: string

    if (useNetplan) {
      configPath = `/etc/netplan/99-${config.name}.yaml`
      configContent = generateNetplanConfig(config)
    } else {
      // For /etc/network/interfaces, we need to be more careful
      // Read existing config and modify only the relevant interface
      const interfacesPath = '/etc/network/interfaces'
      configPath = interfacesPath
      
      // Generate new interface config section
      const existingConfig = await safeExec(`cat ${interfacesPath}`)
      if (existingConfig) {
        // This is a simplified approach - in production you'd want to parse and modify
        configContent = generateInterfacesFile(config)
      } else {
        configContent = generateInterfacesFile(config)
      }
    }

    // Write configuration
    try {
      await writeFile(configPath, configContent, 'utf-8')
    } catch {
      return { 
        success: false, 
        message: 'Failed to write configuration. Are you running as root?',
        details: `Path: ${configPath}`
      }
    }

    // Apply the configuration
    if (useNetplan) {
      // Apply netplan
      const netplanResult = await safeExec('netplan apply 2>&1')
      if (netplanResult === null) {
        return {
          success: false,
          message: 'Failed to apply netplan configuration. Check the configuration syntax.',
          details: configContent
        }
      }
    } else {
      // Bring interface down and up
      if (config.isEnabled) {
        await safeExec(`ip link set ${config.name} down 2>/dev/null`)
        
        if (config.ipMethod === 'DHCP') {
          await safeExec(`dhclient -r ${config.name} 2>/dev/null`)
          await safeExec(`dhclient ${config.name} 2>/dev/null`)
        } else if (config.ipMethod === 'STATIC') {
          // Apply static IP
          await safeExec(`ip addr flush dev ${config.name}`)
          if (config.ipAddress && config.subnetMask) {
            const prefix = config.subnetMask.split('.').reduce((acc, octet) => {
              return acc + (parseInt(octet, 10).toString(2).match(/1/g)?.length || 0)
            }, 0)
            await safeExec(`ip addr add ${config.ipAddress}/${prefix} dev ${config.name}`)
          }
          if (config.gateway && config.isDefaultGateway) {
            await safeExec(`ip route add default via ${config.gateway} dev ${config.name}`)
          }
        }
        
        // Set MTU
        if (config.mtu !== 1500) {
          await safeExec(`ip link set ${config.name} mtu ${config.mtu}`)
        }
        
        await safeExec(`ip link set ${config.name} up`)
      } else {
        await safeExec(`ip link set ${config.name} down`)
      }
    }

    // Configure DNS if specified
    if (config.dnsServers.length > 0 && config.isDefaultGateway) {
      const resolvConf = config.dnsServers.map(dns => `nameserver ${dns}`).join('\n')
      try {
        await writeFile('/etc/resolv.conf', resolvConf + '\n', 'utf-8')
      } catch {
        // DNS config might fail if resolvconf is managing it
      }
    }

    return {
      success: true,
      message: `Interface ${config.name} configuration applied successfully`,
      details: useNetplan ? 'Netplan configuration applied' : 'Traditional ifupdown configuration applied'
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      message: `Failed to apply configuration: ${errorMessage}`
    }
  }
}

/**
 * Enable/disable an interface
 */
export async function setInterfaceState(name: string, enabled: boolean): Promise<{ success: boolean; message: string }> {
  try {
    const exists = await fileExists(`/sys/class/net/${name}`)
    if (!exists) {
      return { success: false, message: `Interface ${name} does not exist` }
    }

    if (enabled) {
      await safeExec(`ip link set ${name} up`)
      return { success: true, message: `Interface ${name} enabled` }
    } else {
      await safeExec(`ip link set ${name} down`)
      return { success: true, message: `Interface ${name} disabled` }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, message: `Failed to change interface state: ${errorMessage}` }
  }
}

/**
 * Test network connectivity
 */
export async function testConnectivity(host = '8.8.8.8'): Promise<{ success: boolean; latency: number; error?: string }> {
  const start = Date.now()
  const result = await safeExec(`ping -c 1 -W 2 ${host} 2>/dev/null`)
  const latency = Date.now() - start

  if (result && result.includes('1 received')) {
    return { success: true, latency }
  }

  return { success: false, latency: 0, error: 'Ping failed' }
}

/**
 * Get network statistics summary
 */
export async function getNetworkStats(): Promise<{
  totalRxBytes: number
  totalTxBytes: number
  interfaceCount: number
  upCount: number
  downCount: number
}> {
  const interfaces = await getSystemInterfaces()
  
  return {
    totalRxBytes: interfaces.reduce((sum, i) => sum + i.rxBytes, 0),
    totalTxBytes: interfaces.reduce((sum, i) => sum + i.txBytes, 0),
    interfaceCount: interfaces.length,
    upCount: interfaces.filter(i => i.status === 'UP').length,
    downCount: interfaces.filter(i => i.status === 'DOWN').length,
  }
}
