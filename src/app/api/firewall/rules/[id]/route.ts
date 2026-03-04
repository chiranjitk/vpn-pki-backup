import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  deleteNftablesRule,
  addNftablesRule,
  isNftablesAvailable,
  initializeDefaultTables,
  type AddRuleOptions,
} from '@/lib/firewall/nftables'

// GET - Get a specific firewall rule
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rule = await db.firewallRule.findUnique({
      where: { id },
    })

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    return NextResponse.json({ rule })
  } catch (error) {
    console.error('Get firewall rule error:', error)
    return NextResponse.json({ error: 'Failed to get rule' }, { status: 500 })
  }
}

// PUT - Update a firewall rule
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const existingRule = await db.firewallRule.findUnique({ where: { id } })
    if (!existingRule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    // Update rule in database
    const rule = await db.firewallRule.update({
      where: { id },
      data: {
        name: name ?? existingRule.name,
        action: action ?? existingRule.action,
        protocol: protocol ?? existingRule.protocol,
        sourcePort,
        destPort,
        sourceIp: sourceIp ?? existingRule.sourceIp,
        destIp: destIp ?? existingRule.destIp,
        interface: iface ?? existingRule.interface,
        isEnabled: isEnabled ?? existingRule.isEnabled,
        priority: priority ?? existingRule.priority,
        description,
        tableName: tableName ?? existingRule.tableName,
        family: family ?? existingRule.family,
        chainName: chainName ?? existingRule.chainName,
        ruleType: ruleType ?? existingRule.ruleType,
      },
    })

    // Handle nftables updates
    let nftHandle = existingRule.handle

    if (isNftablesAvailable() && applyToNftables) {
      try {
        // Delete old rule from nftables if it had a handle
        if (existingRule.handle && existingRule.family && existingRule.tableName && existingRule.chainName) {
          try {
            await deleteNftablesRule(
              existingRule.family as 'inet' | 'ip' | 'ip6',
              existingRule.tableName,
              existingRule.chainName,
              existingRule.handle
            )
          } catch {
            // Old rule might not exist, continue
          }
        }

        // Add new rule if enabled
        if (isEnabled !== false) {
          await initializeDefaultTables()

          const nftOptions: AddRuleOptions = {
            table: rule.tableName,
            family: rule.family as 'inet' | 'ip' | 'ip6',
            chain: rule.chainName,
            action: rule.action === 'DENY' ? 'drop' : 'accept',
            protocol: rule.protocol.toLowerCase() as 'tcp' | 'udp' | 'icmp' | 'all',
            sourcePort: rule.sourcePort || undefined,
            destPort: rule.destPort || undefined,
            sourceIp: rule.sourceIp,
            destIp: rule.destIp,
            interface: rule.interface !== 'all' ? rule.interface : undefined,
            comment: rule.description || rule.name,
          }

          nftHandle = await addNftablesRule(nftOptions)

          // Update with new handle
          await db.firewallRule.update({
            where: { id },
            data: { handle: nftHandle },
          })
        } else {
          // Rule is disabled, clear handle
          nftHandle = null
          await db.firewallRule.update({
            where: { id },
            data: { handle: null },
          })
        }
      } catch (nftError) {
        console.error('Failed to update rule in nftables:', nftError)
      }
    }

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'UPDATE_FIREWALL_RULE',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'FirewallRule',
        details: JSON.stringify({ id, name: rule.name, nftHandle }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ rule: { ...rule, handle: nftHandle } })
  } catch (error) {
    console.error('Update firewall rule error:', error)
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 })
  }
}

// PATCH - Toggle rule status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { isEnabled, applyToNftables = true } = body

    const existingRule = await db.firewallRule.findUnique({ where: { id } })
    if (!existingRule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    // Update database
    const rule = await db.firewallRule.update({
      where: { id },
      data: { isEnabled },
    })

    // Handle nftables
    let nftHandle = existingRule.handle

    if (isNftablesAvailable() && applyToNftables) {
      try {
        if (!isEnabled && existingRule.handle && existingRule.family && existingRule.tableName && existingRule.chainName) {
          // Disable: remove from nftables
          await deleteNftablesRule(
            existingRule.family as 'inet' | 'ip' | 'ip6',
            existingRule.tableName,
            existingRule.chainName,
            existingRule.handle
          )
          nftHandle = null
          await db.firewallRule.update({
            where: { id },
            data: { handle: null },
          })
        } else if (isEnabled) {
          // Enable: add to nftables
          await initializeDefaultTables()

          const nftOptions: AddRuleOptions = {
            table: existingRule.tableName,
            family: existingRule.family as 'inet' | 'ip' | 'ip6',
            chain: existingRule.chainName,
            action: existingRule.action === 'DENY' ? 'drop' : 'accept',
            protocol: existingRule.protocol.toLowerCase() as 'tcp' | 'udp' | 'icmp' | 'all',
            sourcePort: existingRule.sourcePort || undefined,
            destPort: existingRule.destPort || undefined,
            sourceIp: existingRule.sourceIp,
            destIp: existingRule.destIp,
            interface: existingRule.interface !== 'all' ? existingRule.interface : undefined,
            comment: existingRule.description || existingRule.name,
          }

          nftHandle = await addNftablesRule(nftOptions)
          await db.firewallRule.update({
            where: { id },
            data: { handle: nftHandle },
          })
        }
      } catch (nftError) {
        console.error('Failed to toggle rule in nftables:', nftError)
      }
    }

    return NextResponse.json({ rule: { ...rule, handle: nftHandle } })
  } catch (error) {
    console.error('Toggle firewall rule error:', error)
    return NextResponse.json({ error: 'Failed to toggle rule' }, { status: 500 })
  }
}

// DELETE - Delete a firewall rule
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existingRule = await db.firewallRule.findUnique({ where: { id } })
    if (!existingRule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    // Delete from nftables if has handle
    if (existingRule.handle && existingRule.family && existingRule.tableName && existingRule.chainName && isNftablesAvailable()) {
      try {
        await deleteNftablesRule(
          existingRule.family as 'inet' | 'ip' | 'ip6',
          existingRule.tableName,
          existingRule.chainName,
          existingRule.handle
        )
      } catch (nftError) {
        console.error('Failed to delete rule from nftables:', nftError)
        // Continue with database deletion
      }
    }

    // Delete from database
    await db.firewallRule.delete({ where: { id } })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'DELETE_FIREWALL_RULE',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'FirewallRule',
        details: JSON.stringify({ id, name: existingRule.name }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete firewall rule error:', error)
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 })
  }
}
