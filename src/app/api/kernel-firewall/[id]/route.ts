import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Get a single kernel firewall rule
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const rule = await db.kernelFirewallRule.findUnique({
      where: { id },
    })

    if (!rule) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ rule })
  } catch (error) {
    console.error('Get kernel firewall rule error:', error)
    return NextResponse.json(
      { error: 'Failed to get rule' },
      { status: 500 }
    )
  }
}

// PUT - Update a kernel firewall rule
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Check if rule exists
    const existingRule = await db.kernelFirewallRule.findUnique({
      where: { id },
    })

    if (!existingRule) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      )
    }

    // Prevent modification of system rules
    if (existingRule.isSystemRule) {
      return NextResponse.json(
        { error: 'Cannot modify system rules' },
        { status: 403 }
      )
    }

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
    } = body

    // Validate chain if provided
    const validChains = ['INPUT', 'OUTPUT', 'FORWARD', 'PREROUTING', 'POSTROUTING']
    if (chain && !validChains.includes(chain)) {
      return NextResponse.json(
        { error: `Invalid chain. Must be one of: ${validChains.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate table if provided
    const validTables = ['filter', 'nat', 'mangle', 'raw']
    if (table && !validTables.includes(table)) {
      return NextResponse.json(
        { error: `Invalid table. Must be one of: ${validTables.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate target if provided
    const validTargets = ['ACCEPT', 'DROP', 'REJECT', 'LOG', 'MASQUERADE', 'SNAT', 'DNAT']
    if (target && !validTargets.includes(target)) {
      return NextResponse.json(
        { error: `Invalid target. Must be one of: ${validTargets.join(', ')}` },
        { status: 400 }
      )
    }

    const rule = await db.kernelFirewallRule.update({
      where: { id },
      data: {
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
        isApplied: false, // Mark as unapplied after changes
        updatedAt: new Date(),
      },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'UPDATE_KERNEL_FIREWALL_RULE',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'KernelFirewallRule',
        targetId: rule.id,
        details: JSON.stringify({ name: rule.name, changes: body }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ rule })
  } catch (error) {
    console.error('Update kernel firewall rule error:', error)
    return NextResponse.json(
      { error: 'Failed to update rule' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a kernel firewall rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if rule exists
    const existingRule = await db.kernelFirewallRule.findUnique({
      where: { id },
    })

    if (!existingRule) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      )
    }

    // Prevent deletion of system rules
    if (existingRule.isSystemRule) {
      return NextResponse.json(
        { error: 'Cannot delete system rules' },
        { status: 403 }
      )
    }

    await db.kernelFirewallRule.delete({
      where: { id },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'DELETE_KERNEL_FIREWALL_RULE',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'KernelFirewallRule',
        targetId: id,
        details: JSON.stringify({ name: existingRule.name, chain: existingRule.chain }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete kernel firewall rule error:', error)
    return NextResponse.json(
      { error: 'Failed to delete rule' },
      { status: 500 }
    )
  }
}
