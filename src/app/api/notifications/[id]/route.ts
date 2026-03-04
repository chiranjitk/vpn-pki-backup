import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PATCH - Mark notification as read or dismiss
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action } = body // 'read' or 'dismiss'

    if (action === 'read') {
      await db.notification.update({
        where: { id },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      })
    } else if (action === 'dismiss') {
      await db.notification.update({
        where: { id },
        data: {
          isDismissed: true,
          dismissedAt: new Date(),
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update notification:', error)
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 })
  }
}

// DELETE - Remove notification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.notification.delete({
      where: { id },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete notification:', error)
    return NextResponse.json({ error: 'Failed to delete notification' }, { status: 500 })
  }
}
