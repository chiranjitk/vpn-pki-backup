/**
 * VPN Session Sync API
 * POST: Sync VPN sessions from swanctl to database
 * GET: Get session statistics
 */

import { NextRequest, NextResponse } from 'next/server'
import { syncVpnSessions, getSessionStats } from '@/lib/vpn/session-tracker'

export async function POST(request: NextRequest) {
  try {
    const result = await syncVpnSessions()
    
    return NextResponse.json({
      success: true,
      message: `Synced VPN sessions: ${result.created} created, ${result.updated} updated, ${result.closed} closed`,
      ...result,
      timestamp: new Date(),
    })
  } catch (error) {
    console.error('Error syncing VPN sessions:', error)
    return NextResponse.json(
      { error: 'Failed to sync VPN sessions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const stats = await getSessionStats()
    
    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date(),
    })
  } catch (error) {
    console.error('Error getting session stats:', error)
    return NextResponse.json(
      { error: 'Failed to get session stats' },
      { status: 500 }
    )
  }
}
