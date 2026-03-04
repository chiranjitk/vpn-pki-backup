import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const session = await db.vpnSession.update({
      where: { id },
      data: {
        status: 'DISCONNECTED',
        disconnectedAt: new Date(),
        disconnectReason: body.reason || 'Admin disconnect',
      }
    })
    
    return NextResponse.json({ success: true, session })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to disconnect session' }, { status: 500 })
  }
}
