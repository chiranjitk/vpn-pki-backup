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
    
    const sessions = await db.vpnSession.findMany({
      where,
      orderBy: { connectedAt: 'desc' },
      take: 100,
    })
    
    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Failed to fetch VPN sessions:', error)
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }
}
