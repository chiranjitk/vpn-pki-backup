/**
 * VPN Session Disconnect API
 * POST: Disconnect a specific VPN session
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { terminateConnection } from '@/lib/vpn/monitor'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    
    const { reason, terminatedBy } = body
    
    // Find the session
    const session = await db.vpnSession.findFirst({
      where: {
        OR: [
          { id },
          { sessionId: id },
        ],
      },
    })
    
    if (!session) {
      return NextResponse.json(
        { error: 'VPN session not found' },
        { status: 404 }
      )
    }
    
    // Check if session is already disconnected
    if (session.status !== 'ACTIVE') {
      return NextResponse.json(
        { 
          error: 'Session is not active',
          currentStatus: session.status,
          session,
        },
        { status: 400 }
      )
    }
    
    // Calculate session duration
    const duration = Math.floor((Date.now() - session.connectedAt.getTime()) / 1000)
    
    // Try to terminate the connection via strongSwan if possible
    let terminationResult = { success: true, message: 'Session marked as disconnected' }
    
    // If we have a connection name in the system, try to terminate it
    // The sessionId might be used as the connection name in strongSwan
    if (session.sessionId) {
      try {
        terminationResult = await terminateConnection(session.sessionId)
      } catch {
        // If termination via strongSwan fails, we still update the database
        console.log('Could not terminate via strongSwan, updating database only')
      }
    }
    
    // Update session in database
    const updatedSession = await db.vpnSession.update({
      where: { id: session.id },
      data: {
        status: 'DISCONNECTED',
        disconnectedAt: new Date(),
        duration,
        disconnectReason: reason || 'Manual disconnect',
      },
    })
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'VPN_SESSION_DISCONNECTED',
        category: 'VPN_INTEGRATION',
        actorType: terminatedBy ? 'ADMIN' : 'SYSTEM',
        targetType: 'VPN_SESSION',
        targetId: session.id,
        details: JSON.stringify({
          sessionId: session.sessionId,
          username: session.username,
          clientPublicIp: session.clientPublicIp,
          duration,
          reason: reason || 'Manual disconnect',
          terminatedBy,
          swanctlTermination: terminationResult.success,
        }),
        status: 'SUCCESS',
      },
    })
    
    return NextResponse.json({
      success: true,
      message: 'Session disconnected successfully',
      session: {
        ...updatedSession,
        durationFormatted: formatDuration(duration),
        bytesInFormatted: formatBytes(updatedSession.bytesIn),
        bytesOutFormatted: formatBytes(updatedSession.bytesOut),
      },
    })
  } catch (error) {
    console.error('Error disconnecting VPN session:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect VPN session' },
      { status: 500 }
    )
  }
}

// Helper functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0s'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (mins > 0) parts.push(`${mins}m`)
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`)

  return parts.join(' ')
}
