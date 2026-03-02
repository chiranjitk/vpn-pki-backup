import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST - Clear all notifications
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body // 'read-all' or 'clear-all'

    if (action === 'read-all') {
      await db.notification.updateMany({
        where: { isRead: false, isDismissed: false },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      })
    } else if (action === 'clear-all') {
      // Dismiss all non-dismissed notifications
      await db.notification.updateMany({
        where: { isDismissed: false },
        data: {
          isDismissed: true,
          dismissedAt: new Date(),
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to clear notifications:', error)
    return NextResponse.json({ error: 'Failed to clear notifications' }, { status: 500 })
  }
}
