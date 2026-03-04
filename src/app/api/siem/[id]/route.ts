import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.siemConfiguration.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete SIEM configuration' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const config = await db.siemConfiguration.update({
      where: { id },
      data: body
    })
    
    return NextResponse.json({ success: true, config })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update SIEM configuration' }, { status: 500 })
  }
}
