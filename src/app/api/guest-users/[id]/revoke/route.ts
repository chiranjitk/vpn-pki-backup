import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const guest = await db.guestUser.update({
      where: { id },
      data: {
        status: 'REVOKED',
      }
    })
    return NextResponse.json({ success: true, guest })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to revoke guest user' }, { status: 500 })
  }
}
