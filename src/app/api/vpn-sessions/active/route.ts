import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const sessions = await db.vpnSession.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { connectedAt: 'desc' },
    })
    
    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Failed to fetch active sessions:', error)
    return NextResponse.json({ error: 'Failed to fetch active sessions' }, { status: 500 })
  }
}
