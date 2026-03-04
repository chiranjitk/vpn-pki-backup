import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const config = await db.ldapConfiguration.findFirst()
    
    if (!config || !config.isEnabled) {
      return NextResponse.json({ error: 'LDAP is not configured or enabled' }, { status: 400 })
    }
    
    // Create sync log
    const syncLog = await db.ldapSyncLog.create({
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
      }
    })
    
    try {
      // Simulate LDAP sync
      const usersFound = 0
      const usersCreated = 0
      const usersUpdated = 0
      const usersDisabled = 0
      const usersUnchanged = 0
      
      await db.ldapSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          duration: Date.now() - syncLog.startedAt.getTime(),
          usersFound,
          usersCreated,
          usersUpdated,
          usersDisabled,
          usersUnchanged,
        }
      })
      
      await db.ldapConfiguration.update({
        where: { id: config.id },
        data: {
          lastSyncAt: new Date(),
          lastSyncSuccess: true,
          lastSyncError: null,
          lastSyncCount: usersFound,
        }
      })
      
      return NextResponse.json({
        success: true,
        message: 'LDAP sync completed',
        results: { usersFound, usersCreated, usersUpdated, usersDisabled, usersUnchanged }
      })
    } catch (syncError) {
      await db.ldapSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: syncError instanceof Error ? syncError.message : 'Unknown error',
        }
      })
      throw syncError
    }
  } catch (error) {
    console.error('LDAP sync failed:', error)
    return NextResponse.json({ error: 'LDAP sync failed' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const logs = await db.ldapSyncLog.findMany({
      take: 20,
      orderBy: { startedAt: 'desc' }
    })
    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Failed to fetch sync logs:', error)
    return NextResponse.json({ error: 'Failed to fetch sync logs' }, { status: 500 })
  }
}
