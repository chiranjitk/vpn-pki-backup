import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { extendDays = 7 } = body
    
    const guest = await db.guestUser.findUnique({ where: { id } })
    if (!guest) {
      return NextResponse.json({ error: 'Guest user not found' }, { status: 404 })
    }
    
    const newEndDate = new Date(guest.accessEndDate)
    newEndDate.setDate(newEndDate.getDate() + extendDays)
    
    const updated = await db.guestUser.update({
      where: { id },
      data: { accessEndDate: newEndDate }
    })
    
    return NextResponse.json({ success: true, guest: updated })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to extend access' }, { status: 500 })
  }
}
