import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'today'
    
    let startDate = new Date()
    if (period === 'today') {
      startDate.setHours(0, 0, 0, 0)
    } else if (period === 'week') {
      startDate.setDate(startDate.getDate() - 7)
    } else if (period === 'month') {
      startDate.setMonth(startDate.getMonth() - 1)
    }
    
    const sessions = await db.vpnSession.findMany({
      where: { connectedAt: { gte: startDate } }
    })
    
    const activeSessions = sessions.filter(s => s.status === 'ACTIVE').length
    const totalBytesIn = sessions.reduce((sum, s) => sum + s.bytesIn, 0)
    const totalBytesOut = sessions.reduce((sum, s) => sum + s.bytesOut, 0)
    const avgDuration = sessions.length > 0 
      ? sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / sessions.length 
      : 0
    
    return NextResponse.json({
      stats: {
        activeSessions,
        totalToday: sessions.length,
        totalBytesIn,
        totalBytesOut,
        avgDuration: Math.round(avgDuration),
      }
    })
  } catch (error) {
    console.error('Failed to fetch session stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
