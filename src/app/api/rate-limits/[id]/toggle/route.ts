import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PATCH - Toggle enable/disable a rate limit configuration
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if config exists
    const existing = await db.rateLimitConfig.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Rate limit configuration not found' }, { status: 404 })
    }

    // Toggle the isEnabled status
    const updated = await db.rateLimitConfig.update({
      where: { id },
      data: { isEnabled: !existing.isEnabled },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: existing.isEnabled ? 'DISABLE_RATE_LIMIT_CONFIG' : 'ENABLE_RATE_LIMIT_CONFIG',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetId: id,
        targetType: 'RateLimitConfig',
        details: JSON.stringify({
          scope: existing.scope,
          name: existing.name,
          previousState: existing.isEnabled,
          newState: updated.isEnabled,
        }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ success: true, config: updated })
  } catch (error) {
    console.error('Toggle rate limit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
