import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST - Move a firewall rule up or down
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { direction } = body // 'up' or 'down'

    const currentRule = await db.firewallRule.findUnique({ where: { id } })
    if (!currentRule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    // Get all rules sorted by priority
    const allRules = await db.firewallRule.findMany({
      orderBy: { priority: 'asc' },
    })

    const currentIndex = allRules.findIndex(r => r.id === id)
    if (currentIndex === -1) {
      return NextResponse.json({ error: 'Rule not found in list' }, { status: 404 })
    }

    let targetIndex: number
    if (direction === 'up') {
      if (currentIndex === 0) {
        return NextResponse.json({ message: 'Already at top' })
      }
      targetIndex = currentIndex - 1
    } else {
      if (currentIndex === allRules.length - 1) {
        return NextResponse.json({ message: 'Already at bottom' })
      }
      targetIndex = currentIndex + 1
    }

    const targetRule = allRules[targetIndex]

    // Swap priorities
    await db.$transaction([
      db.firewallRule.update({
        where: { id: currentRule.id },
        data: { priority: targetRule.priority },
      }),
      db.firewallRule.update({
        where: { id: targetRule.id },
        data: { priority: currentRule.priority },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Move firewall rule error:', error)
    return NextResponse.json({ error: 'Failed to move rule' }, { status: 500 })
  }
}
