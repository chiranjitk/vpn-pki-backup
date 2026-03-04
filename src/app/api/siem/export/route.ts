import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    
    const events = await db.siemEventLog.findMany({
      take: 1000,
      orderBy: { createdAt: 'desc' }
    })
    
    if (format === 'csv') {
      const csv = events.map(e => 
        `${e.createdAt.toISOString()},${e.eventType},${e.eventCategory},${e.severity},${e.eventData}`
      ).join('\n')
      
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="siem-events-${Date.now()}.csv"`,
        }
      })
    }
    
    return NextResponse.json({ events })
  } catch (error) {
    console.error('Failed to export SIEM events:', error)
    return NextResponse.json({ error: 'Failed to export events' }, { status: 500 })
  }
}
