import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guest = await db.guestUser.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvalDate: new Date(),
        approvedBy: 'admin', // In production, get from auth
      }
    })
    return NextResponse.json({ success: true, guest })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to approve guest user' }, { status: 500 })
  }
}
