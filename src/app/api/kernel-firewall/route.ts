import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - List all kernel firewall rules
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const chain = searchParams.get('chain')
    const table = searchParams.get('table')
    const enabledOnly = searchParams.get('enabledOnly') === 'true'

    const where: Record<string, unknown> = {}
    if (chain) where.chain = chain
    if (table) where.table = table
    if (enabledOnly) where.isEnabled = true

    const rules = await db.kernelFirewallRule.findMany({
      where,
      orderBy: [
        { chain: 'asc' },
        { priority: 'asc' },
      ],
    })

    // Get statistics
    const stats = await db.kernelFirewallRule.aggregate({
      _count: true,
      _sum: { packetsMatched: true, bytesMatched: true },
      where: { isEnabled: true },
    })

    const appliedCount = await db.kernelFirewallRule.count({
      where: { isApplied: true },
    })

    return NextResponse.json({
      rules,
      stats: {
        total: stats._count,
        enabled: await db.kernelFirewallRule.count({ where: { isEnabled: true } }),
        applied: appliedCount,
        totalPackets: stats._sum.packetsMatched || 0,
        totalBytes: stats._sum.bytesMatched || 0,
      },
    })
  } catch (error) {
    console.error('Get kernel firewall rules error:', error)
    return NextResponse.json({ rules: [], stats: { total: 0, enabled: 0, applied: 0, totalPackets: 0, totalBytes: 0 } })
  }
}

// POST - Create a new kernel firewall rule
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      chain,
      table,
      protocol,
      sourceIp,
      sourcePort,
      destIp,
      destPort,
      inInterface,
      outInterface,
      tcpFlags,
      connectionState,
      matchExtensions,
      target,
      targetParams,
      priority,
      isEnabled,
      description,
      isSystemRule,
    } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Rule name is required' },
        { status: 400 }
      )
    }

    // Validate chain
    const validChains = ['INPUT', 'OUTPUT', 'FORWARD', 'PREROUTING', 'POSTROUTING']
    if (chain && !validChains.includes(chain)) {
      return NextResponse.json(
        { error: `Invalid chain. Must be one of: ${validChains.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate table
    const validTables = ['filter', 'nat', 'mangle', 'raw']
    if (table && !validTables.includes(table)) {
      return NextResponse.json(
        { error: `Invalid table. Must be one of: ${validTables.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate target
    const validTargets = ['ACCEPT', 'DROP', 'REJECT', 'LOG', 'MASQUERADE', 'SNAT', 'DNAT']
    if (target && !validTargets.includes(target)) {
      return NextResponse.json(
        { error: `Invalid target. Must be one of: ${validTargets.join(', ')}` },
        { status: 400 }
      )
    }

    // Get max priority for the chain if not specified
    let rulePriority = priority
    if (rulePriority === undefined || rulePriority === null) {
      const maxPriority = await db.kernelFirewallRule.aggregate({
        where: { chain: chain || 'INPUT' },
        _max: { priority: true },
      })
      rulePriority = (maxPriority._max.priority || 0) + 10
    }

    const rule = await db.kernelFirewallRule.create({
      data: {
        name,
        chain: chain || 'INPUT',
        table: table || 'filter',
        protocol,
        sourceIp,
        sourcePort,
        destIp,
        destPort,
        inInterface,
        outInterface,
        tcpFlags,
        connectionState,
        matchExtensions,
        target: target || 'ACCEPT',
        targetParams,
        priority: rulePriority,
        isEnabled: isEnabled ?? true,
        isApplied: false,
        description,
        isSystemRule: isSystemRule ?? false,
      },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'CREATE_KERNEL_FIREWALL_RULE',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'KernelFirewallRule',
        targetId: rule.id,
        details: JSON.stringify({ name, chain, table, target }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ rule })
  } catch (error) {
    console.error('Create kernel firewall rule error:', error)
    return NextResponse.json(
      { error: 'Failed to create rule' },
      { status: 500 }
    )
  }
}
