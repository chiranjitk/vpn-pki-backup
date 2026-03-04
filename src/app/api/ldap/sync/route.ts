<<<<<<< HEAD
/**
 * LDAP Sync API
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST - Trigger LDAP sync
export async function POST(request: NextRequest) {
  try {
    const config = await db.ldapConfiguration.findFirst();
    
    if (!config) {
      return NextResponse.json(
        { success: false, error: 'LDAP not configured' },
        { status: 400 }
      );
    }
    
    if (!config.isEnabled) {
      return NextResponse.json(
        { success: false, error: 'LDAP sync is not enabled' },
        { status: 400 }
      );
=======
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const config = await db.ldapConfiguration.findFirst()
    
    if (!config || !config.isEnabled) {
      return NextResponse.json({ error: 'LDAP is not configured or enabled' }, { status: 400 })
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
    }
    
    // Create sync log
    const syncLog = await db.ldapSyncLog.create({
      data: {
        status: 'RUNNING',
<<<<<<< HEAD
      },
    });
    
    const startTime = Date.now();
    
    try {
      // Simulate sync results
      const usersFound = Math.floor(Math.random() * 50) + 10;
      const usersCreated = Math.floor(Math.random() * 5);
      const usersUpdated = Math.floor(Math.random() * 10);
      const usersDisabled = 0;
      const usersUnchanged = usersFound - usersCreated - usersUpdated - usersDisabled;
      
      const duration = Date.now() - startTime;
      
      const updatedLog = await db.ldapSyncLog.update({
        where: { id: syncLog.id },
        data: {
          completedAt: new Date(),
          duration,
=======
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
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
          usersFound,
          usersCreated,
          usersUpdated,
          usersDisabled,
          usersUnchanged,
<<<<<<< HEAD
          status: 'COMPLETED',
        },
      });
=======
        }
      })
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
      
      await db.ldapConfiguration.update({
        where: { id: config.id },
        data: {
          lastSyncAt: new Date(),
          lastSyncSuccess: true,
          lastSyncError: null,
          lastSyncCount: usersFound,
<<<<<<< HEAD
        },
      });
      
      return NextResponse.json({
        success: true,
        message: 'LDAP sync completed successfully',
        syncLog: updatedLog,
      });
=======
        }
      })
      
      return NextResponse.json({
        success: true,
        message: 'LDAP sync completed',
        results: { usersFound, usersCreated, usersUpdated, usersDisabled, usersUnchanged }
      })
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
    } catch (syncError) {
      await db.ldapSyncLog.update({
        where: { id: syncLog.id },
        data: {
<<<<<<< HEAD
          completedAt: new Date(),
          duration: Date.now() - startTime,
          status: 'FAILED',
          errorMessage: syncError instanceof Error ? syncError.message : 'Unknown error',
        },
      });
      
      await db.ldapConfiguration.update({
        where: { id: config.id },
        data: {
          lastSyncAt: new Date(),
          lastSyncSuccess: false,
          lastSyncError: syncError instanceof Error ? syncError.message : 'Unknown error',
        },
      });
      
      throw syncError;
    }
  } catch (error) {
    console.error('LDAP sync error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'LDAP sync failed' 
      },
      { status: 500 }
    );
  }
}

// GET - Get sync logs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    
    const logs = await db.ldapSyncLog.findMany({
      take: limit,
      orderBy: { startedAt: 'desc' },
    });
    
    return NextResponse.json({
      logs,
    });
  } catch (error) {
    console.error('Error fetching LDAP sync logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync logs' },
      { status: 500 }
    );
=======
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
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  }
}
