import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getNftablesRules,
  getNftablesTables,
  getNftablesStatus,
  addNftablesRule,
  deleteNftablesRule,
  initializeDefaultTables,
  getRuleStats,
  isNftablesAvailable,
  type AddRuleOptions,
} from '@/lib/firewall/nftables'

// GET - List all firewall rules (from database and nftables)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const source = searchParams.get('source') || 'database' // 'database' or 'nftables' or 'all'

    // Get database rules
    const dbRules = await db.firewallRule.findMany({
      orderBy: { priority: 'asc' },
    })

    // Get nftables status
    const nftStatus = getNftablesStatus()

    // Get nftables tables if available
    let nftTables: Awaited<ReturnType<typeof getNftablesTables>> = []
    let nftRules: Awaited<ReturnType<typeof getNftablesRules>> | null = null

    if (isNftablesAvailable()) {
      try {
        nftTables = await getNftablesTables()
        if (source === 'nftables' || source === 'all') {
          nftRules = await getNftablesRules()
        }
      } catch (e) {
        console.error('Failed to get nftables data:', e)
      }
    }

    // Get rule statistics from nftables
    let stats: Map<number, { packets: number; bytes: number }> = new Map()
    try {
      stats = await getRuleStats()

      // Update database rules with stats
      for (const rule of dbRules) {
        if (rule.handle && stats.has(rule.handle)) {
          const stat = stats.get(rule.handle)!
          if (rule.packets !== stat.packets || rule.bytes !== stat.bytes) {
            await db.firewallRule.update({
              where: { id: rule.id },
              data: { packets: stat.packets, bytes: stat.bytes },
            })
          }
        }
      }
    } catch (e) {
      console.error('Failed to get rule stats:', e)
    }

    return NextResponse.json({
      rules: dbRules.map(rule => ({
        ...rule,
        packets: rule.handle && stats.has(rule.handle) ? stats.get(rule.handle)!.packets : rule.packets,
        bytes: rule.handle && stats.has(rule.handle) ? stats.get(rule.handle)!.bytes : rule.bytes,
      })),
      nftables: {
        available: nftStatus.then(s => s.available),
        version: nftStatus.then(s => s.version),
        tables: nftTables,
        ruleset: nftRules,
      },
    })
  } catch (error) {
    console.error('Get firewall rules error:', error)
    return NextResponse.json({ rules: [], error: 'Failed to get rules' }, { status: 500 })
  }
}

// POST - Create a new firewall rule (in database and nftables)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      action,
      protocol,
      sourcePort,
      destPort,
      sourceIp,
      destIp,
      interface: iface,
      isEnabled,
      priority,
      description,
      tableName,
      family,
      chainName,
      ruleType,
      applyToNftables = true,
    } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Rule name is required' },
        { status: 400 }
      )
    }

    // Get max priority
    const maxPriority = await db.firewallRule.aggregate({
      _max: { priority: true },
    })
    const newPriority = priority ?? (maxPriority._max.priority || 0) + 10

    // Validate family
    const validFamily = ['inet', 'ip', 'ip6'].includes(family) ? family : 'inet'
    const validTable = tableName || 'filter'
    const validChain = chainName || 'input'

    // Create rule in database
    const rule = await db.firewallRule.create({
      data: {
        name,
        action: action || 'ALLOW',
        protocol: protocol || 'TCP',
        sourcePort,
        destPort,
        sourceIp: sourceIp || '0.0.0.0/0',
        destIp: destIp || '0.0.0.0/0',
        interface: iface || 'eth0',
        isEnabled: isEnabled ?? true,
        priority: newPriority,
        description,
        tableName: validTable,
        family: validFamily,
        chainName: validChain,
        ruleType: ruleType || 'filter',
      },
    })

    // Apply to nftables if enabled and available
    let nftHandle: number | null = null
    if (applyToNftables && isEnabled !== false && isNftablesAvailable()) {
      try {
        // Initialize tables if needed
        await initializeDefaultTables()

        // Add rule to nftables
        const nftOptions: AddRuleOptions = {
          table: validTable,
          family: validFamily as 'inet' | 'ip' | 'ip6',
          chain: validChain,
          action: action === 'DENY' ? 'drop' : 'accept',
          protocol: protocol?.toLowerCase() as 'tcp' | 'udp' | 'icmp' | 'all' | undefined,
          sourcePort: sourcePort || undefined,
          destPort: destPort || undefined,
          sourceIp: sourceIp || '0.0.0.0/0',
          destIp: destIp || '0.0.0.0/0',
          interface: iface || undefined,
          comment: description || name,
        }

        nftHandle = await addNftablesRule(nftOptions)

        // Update rule with handle
        await db.firewallRule.update({
          where: { id: rule.id },
          data: { handle: nftHandle },
        })
      } catch (nftError) {
        console.error('Failed to apply rule to nftables:', nftError)
        // Rule was created in database but not applied to nftables
        // We'll still return success but note the issue
      }
    }

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'CREATE_FIREWALL_RULE',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'FirewallRule',
        details: JSON.stringify({
          name,
          action,
          protocol,
          nftHandle,
          tableName: validTable,
          chainName: validChain,
        }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({
      rule: {
        ...rule,
        handle: nftHandle || rule.handle,
      },
      nftablesApplied: nftHandle !== null,
    })
  } catch (error) {
    console.error('Create firewall rule error:', error)
    return NextResponse.json(
      { error: 'Failed to create rule' },
      { status: 500 }
    )
  }
}
