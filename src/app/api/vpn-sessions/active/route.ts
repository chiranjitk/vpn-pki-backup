<<<<<<< HEAD
/**
 * Active VPN Sessions API
 * GET: Get currently active VPN sessions
 * Merges database sessions with real-time swanctl connections
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getActiveConnections } from '@/lib/vpn/monitor'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    // Optional filters
    const username = searchParams.get('username')
    const clientIp = searchParams.get('clientIp')
    const deviceType = searchParams.get('deviceType')
    const country = searchParams.get('country')
    
    // Build where clause for database sessions
    const where: Record<string, unknown> = {
      status: 'ACTIVE',
    }
    
    if (username) {
      where.username = { contains: username, mode: 'insensitive' }
    }
    
    if (clientIp) {
      where.clientPublicIp = { contains: clientIp }
    }
    
    if (deviceType) {
      where.deviceType = deviceType
    }
    
    if (country) {
      where.clientCountry = country
    }
    
    // Get active sessions from database
    const dbActiveSessions = await db.vpnSession.findMany({
      where,
      orderBy: { connectedAt: 'desc' },
    })
    
    // Get real-time active connections from swanctl
    const realtimeConnections = await getActiveConnections()
    
    // Create a map of existing sessions by username and remote IP
    const existingSessionKeys = new Set(
      dbActiveSessions.map(s => `${s.username}:${s.clientPublicIp}`)
    )
    
    // Convert real-time connections to session format and add new ones
    const newSessionsFromRealtime = realtimeConnections
      .filter(conn => !existingSessionKeys.has(`${conn.user}:${conn.remoteIp}`))
      .map(conn => ({
        id: `realtime-${conn.id}`,
        sessionId: conn.id,
        username: conn.user,
        userId: null,
        clientPublicIp: conn.remoteIp,
        clientVirtualIp: conn.virtualIp,
        serverIp: conn.localIp || '',
        certificateSerial: null,
        connectedAt: conn.connectedAt,
        disconnectedAt: null,
        duration: conn.established,
        bytesIn: conn.bytesIn,
        bytesOut: conn.bytesOut,
        status: 'ACTIVE' as const,
        deviceType: null,
        deviceOs: null,
        clientCountry: null,
        clientCity: null,
        mfaUsed: false,
        // Additional real-time data
        ikeProposal: conn.ikeProposal,
        espProposal: conn.espProposal,
        userDn: conn.userDn,
        state: conn.state,
        isRealtime: true,
      }))
    
    // Merge database sessions with real-time connections
    const allActiveSessions = [
      // Update database sessions with real-time traffic data if available
      ...dbActiveSessions.map(session => {
        const realtimeConn = realtimeConnections.find(
          conn => conn.user === session.username || conn.remoteIp === session.clientPublicIp
        )
        if (realtimeConn) {
          return {
            ...session,
            // Update with real-time data
            bytesIn: realtimeConn.bytesIn || session.bytesIn,
            bytesOut: realtimeConn.bytesOut || session.bytesOut,
            duration: realtimeConn.established || session.duration,
            clientVirtualIp: realtimeConn.virtualIp || session.clientVirtualIp,
            ikeProposal: realtimeConn.ikeProposal,
            espProposal: realtimeConn.espProposal,
            isRealtime: false,
          }
        }
        return { ...session, isRealtime: false }
      }),
      // Add new real-time sessions not in database
      ...newSessionsFromRealtime,
    ]
    
    // Calculate current duration for each session
    const now = Date.now()
    const enrichedSessions = allActiveSessions.map(session => {
      const connectedAt = session.connectedAt instanceof Date ? session.connectedAt : new Date(session.connectedAt)
      const currentDuration = session.duration || Math.floor((now - connectedAt.getTime()) / 1000)
      
      return {
        ...session,
        currentDuration,
        durationFormatted: formatDuration(currentDuration),
        bytesInFormatted: formatBytes(session.bytesIn),
        bytesOutFormatted: formatBytes(session.bytesOut),
        totalBytesFormatted: formatBytes(session.bytesIn + session.bytesOut),
        connectedAtFormatted: formatDate(connectedAt),
        connectedAgo: formatTimeAgo(connectedAt),
      }
    })
    
    // Get user info for each session
    const sessionsWithUserInfo = await Promise.all(
      enrichedSessions.map(async (session) => {
        // Skip database lookup for pure realtime sessions
        if (session.isRealtime && !session.userId) {
          return {
            ...session,
            userInfo: null,
          }
        }
        
        let userInfo = null
        if (session.userId) {
          userInfo = await db.vpnUser.findUnique({
            where: { id: session.userId },
            select: {
              id: true,
              username: true,
              email: true,
              fullName: true,
              department: true,
              status: true,
            },
          })
        } else if (session.username) {
          // Try to find user by username
          userInfo = await db.vpnUser.findFirst({
            where: {
              OR: [
                { username: session.username },
                { email: session.username },
                { fullName: session.username },
              ],
            },
            select: {
              id: true,
              username: true,
              email: true,
              fullName: true,
              department: true,
              status: true,
            },
          })
        }
        
        return {
          ...session,
          userInfo,
        }
      })
    )
    
    // Calculate summary statistics
    const summary = {
      totalActive: sessionsWithUserInfo.length,
      uniqueUsers: new Set(sessionsWithUserInfo.map(s => s.username)).size,
      uniqueIps: new Set(sessionsWithUserInfo.map(s => s.clientPublicIp)).size,
      totalBytesIn: sessionsWithUserInfo.reduce((sum, s) => sum + s.bytesIn, 0),
      totalBytesOut: sessionsWithUserInfo.reduce((sum, s) => sum + s.bytesOut, 0),
      avgDuration: sessionsWithUserInfo.length > 0
        ? Math.floor(sessionsWithUserInfo.reduce((sum, s) => sum + s.currentDuration, 0) / sessionsWithUserInfo.length)
        : 0,
      byDevice: countByField(sessionsWithUserInfo, 'deviceType'),
      byCountry: countByField(sessionsWithUserInfo, 'clientCountry'),
      byOs: countByField(sessionsWithUserInfo, 'deviceOs'),
      mfaEnabled: sessionsWithUserInfo.filter(s => s.mfaUsed).length,
      realtimeConnections: realtimeConnections.length,
    }
    
    // Format summary
    const formattedSummary = {
      ...summary,
      totalBytesInFormatted: formatBytes(summary.totalBytesIn),
      totalBytesOutFormatted: formatBytes(summary.totalBytesOut),
      avgDurationFormatted: formatDuration(summary.avgDuration),
    }
    
    return NextResponse.json({
      sessions: sessionsWithUserInfo,
      summary: formattedSummary,
      timestamp: new Date(),
    })
  } catch (error) {
    console.error('Error getting active VPN sessions:', error)
    return NextResponse.json(
      { error: 'Failed to get active VPN sessions' },
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

function formatDate(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function countByField(arr: Record<string, unknown>[], field: string): Record<string, number> {
  const counts: Record<string, number> = {}
  arr.forEach(item => {
    const value = item[field] as string | null
    if (value) {
      counts[value] = (counts[value] || 0) + 1
    }
  })
  return counts
}
=======
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
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
