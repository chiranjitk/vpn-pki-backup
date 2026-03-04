import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.geoIpRestriction.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete restriction:', error)
    return NextResponse.json({ error: 'Failed to delete restriction' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const restriction = await db.geoIpRestriction.update({
      where: { id },
      data: body
    })
    
    return NextResponse.json({ success: true, restriction })
  } catch (error) {
    console.error('Failed to update restriction:', error)
    return NextResponse.json({ error: 'Failed to update restriction' }, { status: 500 })
  }
}
