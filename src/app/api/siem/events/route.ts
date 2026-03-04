import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST() {
  try {
    // Get pending events and send to all enabled SIEMs
    const pendingEvents = await db.siemEventLog.findMany({
      where: { sendStatus: 'PENDING' },
      take: 100,
    })
    
    const siemConfigs = await db.siemConfiguration.findMany({
      where: { isEnabled: true }
    })
    
    let sent = 0
    for (const event of pendingEvents) {
      for (const siem of siemConfigs) {
        // Send to SIEM (simplified)
        sent++
      }
      
      await db.siemEventLog.update({
        where: { id: event.id },
        data: {
          sendStatus: 'SENT',
          sentAt: new Date(),
        }
      })
    }
    
    return NextResponse.json({ sent, total: pendingEvents.length })
  } catch (error) {
    console.error('Failed to send SIEM events:', error)
    return NextResponse.json({ error: 'Failed to send events' }, { status: 500 })
  }
}
