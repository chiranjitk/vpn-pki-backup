/**
 * nftables Library for Debian 13
 * nftables v1.1.3 integration for firewall management
 * Supports table/chain/rule operations with JSON output parsing
 */

import { execSync } from 'child_process'
import { promisify } from 'util'
import { exec } from 'child_process'

const execAsync = promisify(exec)

// ============================================
// Types and Interfaces
// ============================================

export interface NftablesTable {
  family: 'inet' | 'ip' | 'ip6' | 'arp' | 'bridge' | 'netdev'
  name: string
  handle: number
  chains?: NftablesChain[]
}

export interface NftablesChain {
  family: string
  table: string
  name: string
  handle: number
  type: 'filter' | 'nat' | 'route'
  hook?: 'input' | 'output' | 'forward' | 'prerouting' | 'postrouting'
  priority: number
  policy: 'accept' | 'drop'
  rules?: NftablesRule[]
}

export interface NftablesRule {
  family: string
  table: string
  chain: string
  handle: number
  expr: NftablesExpr[]
  comment?: string
}

export interface NftablesExpr {
  type: 'match' | 'payload' | 'cmp' | 'immediate' | 'counter' | 'verdict' | 'nat'
  match?: {
    op: string
    left: {
      payload?: { protocol: string; field: string }
      meta?: { key: string }
      ct?: { key: string }
    }
    right: string | number
  }
  verdict?: {
    verdict: 'accept' | 'drop' | 'continue' | 'return' | 'jump' | 'goto'
    chain?: string
  }
  counter?: {
    packets: number
    bytes: number
  }
  nat?: {
    type: 'snat' | 'dnat' | 'masquerade'
    family: string
    addr?: string
    port?: number
  }
}

export interface NftablesRuleset {
  nftables: Array<{
    metainfo?: { version: string; release_name: string }
    table?: NftablesTable
    chain?: NftablesChain
    rule?: NftablesRule
  }>
}

export interface AddRuleOptions {
  table: string
  family: 'inet' | 'ip' | 'ip6'
  chain: string
  action: 'accept' | 'drop'
  protocol?: 'tcp' | 'udp' | 'icmp' | 'all'
  sourceIp?: string
  destIp?: string
  sourcePort?: string
  destPort?: string
  interface?: string
  comment?: string
  position?: number // Insert after handle
}

export interface NatRuleOptions {
  table: string
  family: 'inet' | 'ip' | 'ip6'
  chain: 'prerouting' | 'postrouting' | 'output'
  type: 'snat' | 'dnat' | 'masquerade'
  sourceIp?: string
  destIp?: string
  translatedIp: string
  translatedPort?: number
  protocol?: 'tcp' | 'udp'
  interface?: string
  comment?: string
}

export interface ForwardRuleOptions {
  table: string
  family: 'inet' | 'ip' | 'ip6'
  sourceIp?: string
  destIp?: string
  sourceInterface?: string
  destInterface?: string
  protocol?: 'tcp' | 'udp' | 'icmp' | 'all'
  sourcePort?: string
  destPort?: string
  action: 'accept' | 'drop'
  comment?: string
}

// ============================================
// Helper Functions
// ============================================

/**
 * Execute nft command with error handling
 */
async function runNft(args: string): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execAsync(`nft ${args}`, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    })
    return result
  } catch (error: unknown) {
    const execError = error as { stderr?: string; message?: string }
    throw new Error(`nft error: ${execError.stderr || execError.message}`)
  }
}

/**
 * Execute nft command synchronously (for simple operations)
 */
function runNftSync(args: string): string {
  try {
    return execSync(`nft ${args}`, { encoding: 'utf-8' })
  } catch (error: unknown) {
    const execError = error as { stderr?: Buffer; message?: string }
    const stderr = execError.stderr?.toString() || ''
    throw new Error(`nft error: ${stderr || execError.message}`)
  }
}

/**
 * Check if nftables is available
 */
export function isNftablesAvailable(): boolean {
  try {
    execSync('nft --version', { encoding: 'utf-8' })
    return true
  } catch {
    return false
  }
}

/**
 * Get nftables version
 */
export function getNftablesVersion(): string {
  try {
    const result = execSync('nft --version', { encoding: 'utf-8' })
    // Parse version from output like "nftables v1.1.3 (Commodore Bullmoose)"
    const match = result.match(/nftables v(\d+\.\d+\.\d+)/)
    return match ? match[1] : 'Unknown'
  } catch {
    return 'Not available'
  }
}

// ============================================
// Ruleset Operations
// ============================================

/**
 * List current ruleset in JSON format
 */
export async function getNftablesRules(): Promise<NftablesRuleset> {
  const { stdout } = await runNft('-j list ruleset')
  return JSON.parse(stdout)
}

/**
 * List all tables
 */
export async function getNftablesTables(): Promise<NftablesTable[]> {
  try {
    const ruleset = await getNftablesRules()
    const tables: NftablesTable[] = []

    for (const item of ruleset.nftables) {
      if (item.table) {
        tables.push(item.table)
      }
    }

    return tables
  } catch {
    return []
  }
}

/**
 * Get chains for a specific table
 */
export async function getNftablesChains(
  family: string,
  tableName: string
): Promise<NftablesChain[]> {
  try {
    const { stdout } = await runNft(`-j list chain ${family} ${tableName}`)
    const data = JSON.parse(stdout)
    const chains: NftablesChain[] = []

    for (const item of data.nftables) {
      if (item.chain) {
        chains.push(item.chain)
      }
    }

    return chains
  } catch {
    return []
  }
}

/**
 * Get rules for a specific chain
 */
export async function getNftablesChainRules(
  family: string,
  tableName: string,
  chainName: string
): Promise<NftablesRule[]> {
  try {
    const { stdout } = await runNft(`-j list chain ${family} ${tableName} ${chainName}`)
    const data = JSON.parse(stdout)
    const rules: NftablesRule[] = []

    for (const item of data.nftables) {
      if (item.rule) {
        rules.push(item.rule)
      }
    }

    return rules
  } catch {
    return []
  }
}

/**
 * Get all rules flattened with table/chain info
 */
export async function getAllRules(): Promise<Array<{
  rule: NftablesRule
  table: { family: string; name: string }
  chain: { name: string; type: string; hook?: string }
}>> {
  const ruleset = await getNftablesRules()
  const result: Array<{
    rule: NftablesRule
    table: { family: string; name: string }
    chain: { name: string; type: string; hook?: string }
  }> = []

  // Build lookup maps
  const tables = new Map<string, NftablesTable>()
  const chains = new Map<string, NftablesChain>()

  for (const item of ruleset.nftables) {
    if (item.table) {
      const key = `${item.table.family}:${item.table.name}`
      tables.set(key, item.table)
    }
    if (item.chain) {
      const key = `${item.chain.family}:${item.chain.table}:${item.chain.name}`
      chains.set(key, item.chain)
    }
    if (item.rule) {
      const chainKey = `${item.rule.family}:${item.rule.table}:${item.rule.chain}`
      const tableKey = `${item.rule.family}:${item.rule.table}`
      const chain = chains.get(chainKey)
      const table = tables.get(tableKey)

      if (table && chain) {
        result.push({
          rule: item.rule,
          table: { family: table.family, name: table.name },
          chain: { name: chain.name, type: chain.type, hook: chain.hook },
        })
      }
    }
  }

  return result
}

// ============================================
// Table Operations
// ============================================

/**
 * Create a new table
 */
export async function createTable(
  family: 'inet' | 'ip' | 'ip6',
  name: string
): Promise<void> {
  await runNft(`add table ${family} ${name}`)
}

/**
 * Delete a table (and all its chains/rules)
 */
export async function deleteTable(
  family: 'inet' | 'ip' | 'ip6',
  name: string
): Promise<void> {
  await runNft(`delete table ${family} ${name}`)
}

// ============================================
// Chain Operations
// ============================================

/**
 * Create a base chain (attached to a hook)
 */
export async function createBaseChain(
  family: 'inet' | 'ip' | 'ip6',
  tableName: string,
  chainName: string,
  hook: 'input' | 'output' | 'forward' | 'prerouting' | 'postrouting',
  priority: number = 0,
  policy: 'accept' | 'drop' = 'accept'
): Promise<void> {
  await runNft(
    `add chain ${family} ${tableName} ${chainName} ` +
    `{ type filter hook ${hook} priority ${priority} \; policy ${policy} \; }`
  )
}

/**
 * Create a regular chain (not attached to a hook)
 */
export async function createRegularChain(
  family: 'inet' | 'ip' | 'ip6',
  tableName: string,
  chainName: string
): Promise<void> {
  await runNft(`add chain ${family} ${tableName} ${chainName}`)
}

/**
 * Delete a chain
 */
export async function deleteChain(
  family: 'inet' | 'ip' | 'ip6',
  tableName: string,
  chainName: string
): Promise<void> {
  await runNft(`delete chain ${family} ${tableName} ${chainName}`)
}

/**
 * Set chain policy
 */
export async function setChainPolicy(
  family: 'inet' | 'ip' | 'ip6',
  tableName: string,
  chainName: string,
  policy: 'accept' | 'drop'
): Promise<void> {
  await runNft(`chain ${family} ${tableName} ${chainName} { policy ${policy} \; }`)
}

// ============================================
// Rule Operations
// ============================================

/**
 * Build rule expression from options
 */
function buildRuleExpr(options: AddRuleOptions): string {
  const parts: string[] = []

  // Interface
  if (options.interface && options.interface !== 'all') {
    parts.push(`iif "${options.interface}"`)
  }

  // Protocol
  if (options.protocol && options.protocol !== 'all') {
    parts.push(`${options.protocol}`)
  }

  // Source IP
  if (options.sourceIp && options.sourceIp !== '0.0.0.0/0') {
    parts.push(`ip saddr ${options.sourceIp}`)
  }

  // Destination IP
  if (options.destIp && options.destIp !== '0.0.0.0/0') {
    parts.push(`ip daddr ${options.destIp}`)
  }

  // Source port
  if (options.sourcePort) {
    parts.push(`${options.protocol || 'tcp'} sport ${options.sourcePort}`)
  }

  // Destination port
  if (options.destPort) {
    parts.push(`${options.protocol || 'tcp'} dport ${options.destPort}`)
  }

  // Counter (always add for statistics)
  parts.push('counter')

  // Action
  parts.push(options.action)

  // Comment
  if (options.comment) {
    parts.push(`comment "${options.comment.replace(/"/g, '\\"')}"`)
  }

  return parts.join(' ')
}

/**
 * Add a rule to a chain
 */
export async function addNftablesRule(options: AddRuleOptions): Promise<number> {
  const expr = buildRuleExpr(options)

  let positionArg = ''
  if (options.position) {
    positionArg = `position ${options.position}`
  }

  const { stdout } = await runNft(
    `-e add rule ${options.family} ${options.table} ${options.chain} ${positionArg} ${expr}`
  )

  // Parse handle from output
  // nft output format: "add rule inet filter input handle 123 ..."
  const handleMatch = stdout.match(/handle (\d+)/)
  return handleMatch ? parseInt(handleMatch[1]) : 0
}

/**
 * Delete a rule by handle
 */
export async function deleteNftablesRule(
  family: 'inet' | 'ip' | 'ip6',
  tableName: string,
  chainName: string,
  handle: number
): Promise<void> {
  await runNft(`delete rule ${family} ${tableName} ${chainName} handle ${handle}`)
}

/**
 * Add NAT rule
 */
export async function addNatRule(options: NatRuleOptions): Promise<number> {
  const parts: string[] = []

  // Source IP match
  if (options.sourceIp && options.sourceIp !== '0.0.0.0/0') {
    parts.push(`ip saddr ${options.sourceIp}`)
  }

  // Destination IP match
  if (options.destIp && options.destIp !== '0.0.0.0/0') {
    parts.push(`ip daddr ${options.destIp}`)
  }

  // Protocol and port
  if (options.protocol && options.translatedPort) {
    parts.push(`${options.protocol} dport ${options.translatedPort}`)
  }

  // Interface
  if (options.interface) {
    parts.push(`iif "${options.interface}"`)
  }

  // Counter
  parts.push('counter')

  // NAT action
  if (options.type === 'masquerade') {
    parts.push('masquerade')
  } else if (options.type === 'snat') {
    parts.push(`snat to ${options.translatedIp}${options.translatedPort ? `:${options.translatedPort}` : ''}`)
  } else if (options.type === 'dnat') {
    parts.push(`dnat to ${options.translatedIp}${options.translatedPort ? `:${options.translatedPort}` : ''}`)
  }

  // Comment
  if (options.comment) {
    parts.push(`comment "${options.comment.replace(/"/g, '\\"')}"`)
  }

  const expr = parts.join(' ')
  const { stdout } = await runNft(
    `add rule ${options.family} ${options.table} ${options.chain} ${expr}`
  )

  const handleMatch = stdout.match(/handle (\d+)/)
  return handleMatch ? parseInt(handleMatch[1]) : 0
}

/**
 * Add forward rule
 */
export async function addForwardRule(options: ForwardRuleOptions): Promise<number> {
  const parts: string[] = []

  // Source interface
  if (options.sourceInterface) {
    parts.push(`iif "${options.sourceInterface}"`)
  }

  // Destination interface
  if (options.destInterface) {
    parts.push(`oif "${options.destInterface}"`)
  }

  // Protocol
  if (options.protocol && options.protocol !== 'all') {
    parts.push(`${options.protocol}`)
  }

  // Source IP
  if (options.sourceIp && options.sourceIp !== '0.0.0.0/0') {
    parts.push(`ip saddr ${options.sourceIp}`)
  }

  // Destination IP
  if (options.destIp && options.destIp !== '0.0.0.0/0') {
    parts.push(`ip daddr ${options.destIp}`)
  }

  // Source port
  if (options.sourcePort) {
    parts.push(`${options.protocol || 'tcp'} sport ${options.sourcePort}`)
  }

  // Destination port
  if (options.destPort) {
    parts.push(`${options.protocol || 'tcp'} dport ${options.destPort}`)
  }

  // Counter
  parts.push('counter')

  // Action
  parts.push(options.action)

  // Comment
  if (options.comment) {
    parts.push(`comment "${options.comment.replace(/"/g, '\\"')}"`)
  }

  const expr = parts.join(' ')
  const { stdout } = await runNft(
    `add rule ${options.family} ${options.table} forward ${expr}`
  )

  const handleMatch = stdout.match(/handle (\d+)/)
  return handleMatch ? parseInt(handleMatch[1]) : 0
}

// ============================================
// Configuration Operations
// ============================================

/**
 * Apply full ruleset configuration
 */
export async function applyNftablesConfig(config: string): Promise<void> {
  // Use -f - to read from stdin
  await execAsync('nft -f -', { input: config })
}

/**
 * Get current ruleset as text
 */
export async function getNftablesConfig(): Promise<string> {
  const { stdout } = await runNft('list ruleset')
  return stdout
}

/**
 * Flush all rules in a chain
 */
export async function flushChain(
  family: 'inet' | 'ip' | 'ip6',
  tableName: string,
  chainName: string
): Promise<void> {
  await runNft(`flush chain ${family} ${tableName} ${chainName}`)
}

/**
 * Flush entire table
 */
export async function flushTable(
  family: 'inet' | 'ip' | 'ip6',
  tableName: string
): Promise<void> {
  await runNft(`flush table ${family} ${tableName}`)
}

// ============================================
// Utility Functions
// ============================================

/**
 * Parse rule to human-readable format
 */
export function parseRuleToReadable(rule: NftablesRule): string {
  const parts: string[] = []

  for (const expr of rule.expr) {
    if (expr.match) {
      const left = expr.match.left
      if (left.payload) {
        parts.push(`${left.payload.protocol}.${left.payload.field} ${expr.match.op} ${expr.match.right}`)
      } else if (left.meta) {
        parts.push(`${left.meta.key} ${expr.match.op} ${expr.match.right}`)
      }
    }
    if (expr.verdict) {
      parts.push(expr.verdict.verdict.toUpperCase())
    }
    if (expr.counter) {
      parts.push(`[packets: ${expr.counter.packets}, bytes: ${expr.counter.bytes}]`)
    }
    if (expr.nat) {
      const natType = expr.nat.type.toUpperCase()
      const addr = expr.nat.addr || ''
      const port = expr.nat.port ? `:${expr.nat.port}` : ''
      parts.push(`${natType} to ${addr}${port}`)
    }
  }

  return parts.join(' ')
}

/**
 * Convert database rule to nftables rule
 */
export function dbRuleToNft(dbRule: {
  action: string
  protocol: string
  sourcePort?: string | null
  destPort?: string | null
  sourceIp: string
  destIp: string
  interface: string
  description?: string | null
}): AddRuleOptions {
  return {
    table: 'filter',
    family: 'inet',
    chain: 'input', // default
    action: dbRule.action.toLowerCase() as 'accept' | 'drop',
    protocol: dbRule.protocol.toLowerCase() as 'tcp' | 'udp' | 'icmp' | 'all',
    sourcePort: dbRule.sourcePort || undefined,
    destPort: dbRule.destPort || undefined,
    sourceIp: dbRule.sourceIp,
    destIp: dbRule.destIp,
    interface: dbRule.interface,
    comment: dbRule.description || undefined,
  }
}

/**
 * Initialize default tables and chains for VPN server
 */
export async function initializeDefaultTables(): Promise<void> {
  // Check if inet filter table exists
  const tables = await getNftablesTables()
  const hasInetFilter = tables.some(t => t.family === 'inet' && t.name === 'filter')

  if (!hasInetFilter) {
    // Create inet filter table
    await createTable('inet', 'filter')

    // Create standard chains
    await createBaseChain('inet', 'filter', 'input', 'input', 0, 'drop')
    await createBaseChain('inet', 'filter', 'output', 'output', 0, 'accept')
    await createBaseChain('inet', 'filter', 'forward', 'forward', 0, 'drop')
  }

  // Check if inet nat table exists
  const hasInetNat = tables.some(t => t.family === 'inet' && t.name === 'nat')

  if (!hasInetNat) {
    // Create inet nat table
    await createTable('inet', 'nat')

    // Create NAT chains
    await createBaseChain('inet', 'nat', 'prerouting', 'prerouting', -100, 'accept')
    await createBaseChain('inet', 'nat', 'postrouting', 'postrouting', 100, 'accept')
  }
}

/**
 * Add VPN-specific rules for IKEv2/IPsec
 */
export async function addVpnRules(
  wanInterface: string = 'eth0',
  vpnSubnet: string = '10.70.0.0/24'
): Promise<void> {
  // Initialize tables if needed
  await initializeDefaultTables()

  // IKE (UDP 500)
  await addNftablesRule({
    table: 'filter',
    family: 'inet',
    chain: 'input',
    action: 'accept',
    protocol: 'udp',
    destPort: '500',
    interface: wanInterface,
    comment: 'IKE - UDP 500',
  })

  // IKE NAT-T (UDP 4500)
  await addNftablesRule({
    table: 'filter',
    family: 'inet',
    chain: 'input',
    action: 'accept',
    protocol: 'udp',
    destPort: '4500',
    interface: wanInterface,
    comment: 'IKE NAT-T - UDP 4500',
  })

  // ESP (Protocol 50)
  await addNftablesRule({
    table: 'filter',
    family: 'inet',
    chain: 'input',
    action: 'accept',
    protocol: 'all',
    interface: wanInterface,
    comment: 'ESP - Protocol 50',
  })

  // Forward traffic from VPN subnet
  await addForwardRule({
    table: 'filter',
    family: 'inet',
    sourceIp: vpnSubnet,
    action: 'accept',
    comment: 'Allow VPN subnet forwarding',
  })

  // NAT for VPN subnet (masquerade)
  await addNatRule({
    table: 'nat',
    family: 'inet',
    chain: 'postrouting',
    type: 'masquerade',
    sourceIp: vpnSubnet,
    comment: 'NAT for VPN subnet',
  })
}

/**
 * Get rule statistics (counters)
 */
export async function getRuleStats(): Promise<Map<number, { packets: number; bytes: number }>> {
  const rules = await getAllRules()
  const stats = new Map<number, { packets: number; bytes: number }>()

  for (const { rule } of rules) {
    for (const expr of rule.expr) {
      if (expr.counter) {
        stats.set(rule.handle, {
          packets: expr.counter.packets,
          bytes: expr.counter.bytes,
        })
      }
    }
  }

  return stats
}

/**
 * Sync database rules with nftables
 */
export async function syncRulesToNftables(dbRules: Array<{
  id: string
  action: string
  protocol: string
  sourcePort?: string | null
  destPort?: string | null
  sourceIp: string
  destIp: string
  interface: string
  isEnabled: boolean
  description?: string | null
  tableName?: string | null
  chainName?: string | null
}>): Promise<{
  synced: number
  failed: number
  errors: string[]
}> {
  const result = { synced: 0, failed: 0, errors: [] as string[] }

  // Initialize tables
  await initializeDefaultTables()

  for (const dbRule of dbRules) {
    if (!dbRule.isEnabled) continue

    try {
      const nftOptions = dbRuleToNft(dbRule)
      nftOptions.table = dbRule.tableName || 'filter'
      nftOptions.chain = dbRule.chainName || 'input'

      await addNftablesRule(nftOptions)
      result.synced++
    } catch (error) {
      result.failed++
      result.errors.push(`Failed to sync rule ${dbRule.id}: ${error}`)
    }
  }

  return result
}

/**
 * Safe exec wrapper that returns null on failure
 */
async function safeNftExec(args: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`nft ${args}`, {
      maxBuffer: 10 * 1024 * 1024,
    })
    return stdout
  } catch {
    return null
  }
}

/**
 * Get nftables status (for health checks)
 */
export async function getNftablesStatus(): Promise<{
  available: boolean
  version: string
  tables: number
  rules: number
}> {
  const available = isNftablesAvailable()
  if (!available) {
    return {
      available: false,
      version: 'Not available',
      tables: 0,
      rules: 0,
    }
  }

  const version = getNftablesVersion()

  try {
    const tables = await getNftablesTables()
    const allRules = await getAllRules()

    return {
      available: true,
      version,
      tables: tables.length,
      rules: allRules.length,
    }
  } catch {
    return {
      available: true,
      version,
      tables: 0,
      rules: 0,
    }
  }
}
