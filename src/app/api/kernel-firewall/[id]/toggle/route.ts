import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PATCH - Toggle enable/disable a kernel firewall rule
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { isEnabled } = body

    if (typeof isEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'isEnabled must be a boolean' },
        { status: 400 }
      )
    }

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

    const rule = await db.kernelFirewallRule.update({
      where: { id },
      data: {
        isEnabled,
        isApplied: false, // Mark as unapplied after toggle
        updatedAt: new Date(),
      },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: isEnabled ? 'ENABLE_KERNEL_FIREWALL_RULE' : 'DISABLE_KERNEL_FIREWALL_RULE',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'KernelFirewallRule',
        targetId: rule.id,
        details: JSON.stringify({ name: rule.name, isEnabled }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ rule })
  } catch (error) {
    console.error('Toggle kernel firewall rule error:', error)
    return NextResponse.json(
      { error: 'Failed to toggle rule' },
      { status: 500 }
    )
  }
}
