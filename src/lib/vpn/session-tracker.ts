/**
 * VPN Session Tracking Service
 * 
 * This module tracks VPN sessions by comparing real-time swanctl connections
 * with the database records. It:
 * 1. Creates new sessions when connections are established
 * 2. Updates traffic stats for active sessions
 * 3. Marks sessions as disconnected when they terminate
 */

import { db } from '@/lib/db'
import { getActiveConnections, VpnConnection } from './monitor'

export interface SessionSyncResult {
  created: number
  updated: number
  closed: number
  errors: string[]
}

/**
 * Sync VPN sessions from swanctl to database
 * This should be called periodically or when viewing session data
 */
export async function syncVpnSessions(): Promise<SessionSyncResult> {
  const result: SessionSyncResult = {
    created: 0,
    updated: 0,
    closed: 0,
    errors: []
  }

  try {
    // Get current active connections from swanctl
    const activeConnections = await getActiveConnections()
    
    // Get all active sessions from database
    const dbActiveSessions = await db.vpnSession.findMany({
      where: { status: 'ACTIVE' }
    })

    // Create a map of active connections by user+IP for quick lookup
    const activeConnMap = new Map<string, VpnConnection>()
    for (const conn of activeConnections) {
      const key = `${conn.user}:${conn.remoteIp}`
      activeConnMap.set(key, conn)
    }

    // Create a map of database sessions by user+IP
    const dbSessionMap = new Map<string, typeof dbActiveSessions[0]>()
    for (const session of dbActiveSessions) {
      const key = `${session.username}:${session.clientPublicIp}`
      dbSessionMap.set(key, session)
    }

    // Process each active connection
    for (const conn of activeConnections) {
      const key = `${conn.user}:${conn.remoteIp}`
      const existingSession = dbSessionMap.get(key)

      if (existingSession) {
        // Update existing session with latest traffic stats
        try {
          await db.vpnSession.update({
            where: { id: existingSession.id },
            data: {
              bytesIn: conn.bytesIn,
              bytesOut: conn.bytesOut,
              duration: conn.established,
              clientVirtualIp: conn.virtualIp || existingSession.clientVirtualIp,
            }
          })
          result.updated++
        } catch (error) {
          result.errors.push(`Failed to update session ${existingSession.id}: ${error}`)
        }
      } else {
        // Create new session
        try {
          // Look up user by certificate CN
          let userId: string | undefined
          const vpnUser = await db.vpnUser.findFirst({
            where: { username: conn.user }
          })
          if (vpnUser) {
            userId = vpnUser.id
          }

          // Generate unique session ID
          const sessionId = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

          await db.vpnSession.create({
            data: {
              sessionId,
              username: conn.user,
              userId,
              clientPublicIp: conn.remoteIp,
              serverIp: conn.localIp || 'unknown',
              clientVirtualIp: conn.virtualIp,
              certificateCn: conn.userDn,
              status: 'ACTIVE',
              bytesIn: conn.bytesIn,
              bytesOut: conn.bytesOut,
              duration: conn.established,
              connectedAt: conn.connectedAt,
            }
          })
          result.created++

          // Create audit log
          await db.auditLog.create({
            data: {
              action: 'VPN_SESSION_STARTED',
              category: 'VPN_INTEGRATION',
              actorType: 'SYSTEM',
              targetType: 'VPN_SESSION',
              details: JSON.stringify({
                username: conn.user,
                clientPublicIp: conn.remoteIp,
                virtualIp: conn.virtualIp,
              }),
              status: 'SUCCESS',
            }
          })
        } catch (error) {
          result.errors.push(`Failed to create session for ${conn.user}: ${error}`)
        }
      }
    }

    // Mark sessions as disconnected if they're no longer in swanctl
    for (const session of dbActiveSessions) {
      const key = `${session.username}:${session.clientPublicIp}`
      if (!activeConnMap.has(key)) {
        try {
          // Calculate final duration
          const now = new Date()
          const connectedAt = session.connectedAt
          const duration = Math.floor((now.getTime() - connectedAt.getTime()) / 1000)

          await db.vpnSession.update({
            where: { id: session.id },
            data: {
              status: 'DISCONNECTED',
              disconnectedAt: now,
              duration,
              disconnectReason: 'Connection terminated',
            }
          })
          result.closed++

          // Create audit log
          await db.auditLog.create({
            data: {
              action: 'VPN_SESSION_ENDED',
              category: 'VPN_INTEGRATION',
              actorType: 'SYSTEM',
              targetType: 'VPN_SESSION',
              targetId: session.id,
              details: JSON.stringify({
                username: session.username,
                clientPublicIp: session.clientPublicIp,
                duration,
                bytesIn: session.bytesIn,
                bytesOut: session.bytesOut,
              }),
              status: 'SUCCESS',
            }
          })
        } catch (error) {
          result.errors.push(`Failed to close session ${session.id}: ${error}`)
        }
      }
    }

    return result
  } catch (error) {
    result.errors.push(`Sync failed: ${error}`)
    return result
  }
}

/**
 * Get session statistics for dashboard/reports
 */
export async function getSessionStats() {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    totalSessions,
    activeSessions,
    todaySessions,
    weekSessions,
    monthSessions,
    aggregateStats,
  ] = await Promise.all([
    db.vpnSession.count(),
    db.vpnSession.count({ where: { status: 'ACTIVE' } }),
    db.vpnSession.count({ where: { connectedAt: { gte: todayStart } } }),
    db.vpnSession.count({ where: { connectedAt: { gte: weekStart } } }),
    db.vpnSession.count({ where: { connectedAt: { gte: monthStart } } }),
    db.vpnSession.aggregate({
      _sum: {
        bytesIn: true,
        bytesOut: true,
        duration: true,
      },
    }),
  ])

  // Get unique users count
  const uniqueUsers = await db.vpnSession.findMany({
    where: { status: 'ACTIVE' },
    select: { username: true },
    distinct: ['username'],
  })

  return {
    totalSessions,
    activeSessions,
    uniqueUsers: uniqueUsers.length,
    todaySessions,
    weekSessions,
    monthSessions,
    totalBytesIn: aggregateStats._sum.bytesIn || 0,
    totalBytesOut: aggregateStats._sum.bytesOut || 0,
    totalDuration: aggregateStats._sum.duration || 0,
  }
}

/**
 * Record a manual session (for external integrations)
 */
export async function recordSession(data: {
  username: string
  clientPublicIp: string
  serverIp: string
  clientVirtualIp?: string
  status?: 'ACTIVE' | 'DISCONNECTED' | 'TIMEOUT' | 'FAILED' | 'BLOCKED'
  bytesIn?: number
  bytesOut?: number
  duration?: number
  deviceType?: string
  deviceOs?: string
  clientCountry?: string
  clientCity?: string
  disconnectReason?: string
}) {
  const sessionId = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

  // Look up user
  let userId: string | undefined
  const vpnUser = await db.vpnUser.findFirst({
    where: { username: data.username }
  })
  if (vpnUser) {
    userId = vpnUser.id
  }

  const session = await db.vpnSession.create({
    data: {
      sessionId,
      username: data.username,
      userId,
      clientPublicIp: data.clientPublicIp,
      serverIp: data.serverIp,
      clientVirtualIp: data.clientVirtualIp,
      status: data.status || 'ACTIVE',
      bytesIn: data.bytesIn || 0,
      bytesOut: data.bytesOut || 0,
      duration: data.duration,
      deviceType: data.deviceType,
      deviceOs: data.deviceOs,
      clientCountry: data.clientCountry,
      clientCity: data.clientCity,
      disconnectReason: data.disconnectReason,
      connectedAt: new Date(),
      disconnectedAt: data.status === 'ACTIVE' ? undefined : new Date(),
    }
  })

  return session
}
