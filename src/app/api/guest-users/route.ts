import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    
    const where: Record<string, unknown> = {}
    if (status && status !== 'all') {
      where.status = status
    }
    
    const guests = await db.guestUser.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    
    return NextResponse.json({ guests })
  } catch (error) {
    console.error('Failed to fetch guest users:', error)
    return NextResponse.json({ error: 'Failed to fetch guest users' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const guest = await db.guestUser.create({
      data: {
        username: body.username,
        email: body.email,
        fullName: body.fullName || null,
        phone: body.phone || null,
        company: body.company || null,
        purpose: body.purpose || null,
        sponsorName: body.sponsorName || null,
        sponsorEmail: body.sponsorEmail || null,
        accessStartDate: new Date(body.accessStartDate),
        accessEndDate: new Date(body.accessEndDate),
        maxSessions: body.maxSessions || 1,
        allowedNetworks: body.allowedNetworks || null,
        bandwidthLimit: body.bandwidthLimit || null,
        status: 'PENDING',
      }
    })
    
    return NextResponse.json({ success: true, guest })
  } catch (error) {
    console.error('Failed to create guest user:', error)
    return NextResponse.json({ error: 'Failed to create guest user' }, { status: 500 })
  }
}
