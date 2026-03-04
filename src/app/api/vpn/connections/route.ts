/**
 * VPN Connections API
 * GET: List active VPN connections with detailed info
 * POST: Terminate a specific connection (admin action)
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getActiveConnections,
  terminateConnection as terminateConn,
  getXfrmState,
  getXfrmPolicy,
} from '@/lib/vpn/monitor'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const includeXfrm = searchParams.get('xfrm') === 'true'
    const userId = searchParams.get('userId') // Filter by user

    // Get active connections
    const connections = await getActiveConnections()

    // Filter by user if specified
    const filteredConnections = userId 
      ? connections.filter(c => c.user === userId || c.userDn?.includes(userId))
      : connections

    // Enrich with user information from database
    const enrichedConnections = await Promise.all(
      filteredConnections.map(async (conn) => {
        try {
          // Try to find matching VPN user by certificate CN
          const vpnUser = await db.vpnUser.findFirst({
            where: {
              OR: [
                { username: conn.user },
                { fullName: conn.user },
              ],
            },
            include: {
              certificates: {
                where: { status: 'ACTIVE' },
                take: 1,
              },
            },
          })

          return {
            ...conn,
            userInfo: vpnUser ? {
              id: vpnUser.id,
              username: vpnUser.username,
              fullName: vpnUser.fullName,
              email: vpnUser.email,
              department: vpnUser.department,
              status: vpnUser.status,
            } : null,
            // Format bytes for display
            bytesInFormatted: formatBytes(conn.bytesIn),
            bytesOutFormatted: formatBytes(conn.bytesOut),
            // Format duration
            durationFormatted: formatDuration(conn.established),
          }
        } catch {
          return {
            ...conn,
            userInfo: null,
            bytesInFormatted: formatBytes(conn.bytesIn),
            bytesOutFormatted: formatBytes(conn.bytesOut),
            durationFormatted: formatDuration(conn.established),
          }
        }
      })
    )

    // Get XFRM data if requested
    let xfrmData = null
    if (includeXfrm) {
      const [states, policies] = await Promise.all([
        getXfrmState(),
        getXfrmPolicy(),
      ])
      xfrmData = { states, policies }
    }

    // Calculate summary stats
    const summary = {
      total: enrichedConnections.length,
      byState: {
        established: enrichedConnections.filter(c => c.state === 'ESTABLISHED').length,
        connecting: enrichedConnections.filter(c => c.state === 'CONNECTING').length,
        rekeying: enrichedConnections.filter(c => c.state === 'REKEYING').length,
        other: enrichedConnections.filter(c => !['ESTABLISHED', 'CONNECTING', 'REKEYING'].includes(c.state)).length,
      },
      totalBytesIn: connections.reduce((sum, c) => sum + c.bytesIn, 0),
      totalBytesOut: connections.reduce((sum, c) => sum + c.bytesOut, 0),
      uniqueUsers: new Set(connections.map(c => c.user)).size,
    }

    return NextResponse.json({
      connections: enrichedConnections,
      summary,
      xfrm: xfrmData,
      timestamp: new Date(),
    })
  } catch (error) {
    console.error('Error getting VPN connections:', error)
    return NextResponse.json(
      { error: 'Failed to get VPN connections' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, connectionName, connectionId, reason } = body

    // Validate action
    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'terminate': {
        // Require connection name or ID
        const connName = connectionName || connectionId
        if (!connName) {
          return NextResponse.json(
            { error: 'Connection name or ID is required' },
            { status: 400 }
          )
        }

        // Get connection info before terminating (for audit log)
        const connections = await getActiveConnections()
        const conn = connections.find(c => c.name === connName || c.id === connName)

        // Terminate the connection
        const result = await terminateConn(connName)

        // Create audit log
        await db.auditLog.create({
          data: {
            action: 'TERMINATE_VPN_CONNECTION',
            category: 'VPN_INTEGRATION',
            actorType: 'ADMIN',
            targetType: 'VPN_CONNECTION',
            targetId: connName,
            details: JSON.stringify({
              connectionName: connName,
              user: conn?.user,
              remoteIp: conn?.remoteIp,
              reason: reason || 'Manual termination',
            }),
            status: result.success ? 'SUCCESS' : 'FAILURE',
            errorMessage: result.success ? null : result.message,
          },
        })

        return NextResponse.json({
          success: result.success,
          message: result.message,
          connection: conn ? {
            name: conn.name,
            user: conn.user,
            remoteIp: conn.remoteIp,
          } : null,
        })
      }

      case 'terminate_all': {
        // Get all active connections
        const connections = await getActiveConnections()
        const results = []

        for (const conn of connections) {
          const result = await terminateConn(conn.name)
          results.push({
            name: conn.name,
            user: conn.user,
            success: result.success,
            message: result.message,
          })
        }

        // Create audit log
        await db.auditLog.create({
          data: {
            action: 'TERMINATE_ALL_VPN_CONNECTIONS',
            category: 'VPN_INTEGRATION',
            actorType: 'ADMIN',
            targetType: 'VPN_CONNECTIONS',
            details: JSON.stringify({
              count: connections.length,
              reason: reason || 'Mass termination',
            }),
            status: 'SUCCESS',
          },
        })

        return NextResponse.json({
          success: true,
          message: `Terminated ${results.filter(r => r.success).length} of ${connections.length} connections`,
          results,
        })
      }

      case 'terminate_user': {
        // Terminate all connections for a specific user
        const { username } = body
        if (!username) {
          return NextResponse.json(
            { error: 'Username is required' },
            { status: 400 }
          )
        }

        const connections = await getActiveConnections()
        const userConns = connections.filter(c => 
          c.user === username || c.userDn?.includes(username)
        )

        if (userConns.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'No active connections found for this user',
            terminated: 0,
          })
        }

        const results = []
        for (const conn of userConns) {
          const result = await terminateConn(conn.name)
          results.push({
            name: conn.name,
            success: result.success,
            message: result.message,
          })
        }

        // Create audit log
        await db.auditLog.create({
          data: {
            action: 'TERMINATE_USER_VPN_CONNECTIONS',
            category: 'VPN_INTEGRATION',
            actorType: 'ADMIN',
            targetType: 'VPN_USER',
            targetId: username,
            details: JSON.stringify({
              username,
              connectionsTerminated: results.filter(r => r.success).length,
              reason: reason || 'User session termination',
            }),
            status: 'SUCCESS',
          },
        })

        return NextResponse.json({
          success: true,
          message: `Terminated ${results.filter(r => r.success).length} connections for user ${username}`,
          results,
        })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: terminate, terminate_all, terminate_user' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error in VPN connections action:', error)
    return NextResponse.json(
      { error: 'Failed to perform action' },
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
