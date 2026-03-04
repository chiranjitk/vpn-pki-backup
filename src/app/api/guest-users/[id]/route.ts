import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.guestUser.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete guest user' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guest = await db.guestUser.findUnique({ where: { id } })
    if (!guest) {
      return NextResponse.json({ error: 'Guest user not found' }, { status: 404 })
    }
    return NextResponse.json({ guest })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch guest user' }, { status: 500 })
  }
}
