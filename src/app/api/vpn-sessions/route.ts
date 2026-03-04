/**
 * VPN Sessions API
 * GET: List VPN sessions with filtering
 * POST: Create/log a new VPN session
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { getActiveConnections } from '@/lib/vpn/monitor'

// GET - List VPN sessions with filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit
    
    // Filters
    const username = searchParams.get('username')
    const status = searchParams.get('status') as SessionStatus | null
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const clientIp = searchParams.get('clientIp')
    const userId = searchParams.get('userId')
    
    // Build where clause
    const where: Prisma.VpnSessionWhereInput = {}
    
    if (username) {
      where.username = { contains: username, mode: 'insensitive' }
    }
    
    if (userId) {
      where.userId = userId
    }
    
    if (status && ['ACTIVE', 'DISCONNECTED', 'TIMEOUT', 'FAILED', 'BLOCKED'].includes(status)) {
      where.status = status
    }
    
    if (clientIp) {
      where.clientPublicIp = { contains: clientIp }
    }
    
    // Date range filter
    if (startDate || endDate) {
      where.connectedAt = {}
      if (startDate) {
        where.connectedAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.connectedAt.lte = new Date(endDate)
      }
    }
    
    // Get total count for pagination
    const total = await db.vpnSession.count({ where })
    
    // Get sessions from database
    const dbSessions = await db.vpnSession.findMany({
      where,
      skip,
      take: limit,
      orderBy: { connectedAt: 'desc' },
    })
    
    // If filtering for active sessions, also include real-time connections
    let realtimeSessions: any[] = []
    if (status === 'ACTIVE' || status === 'active') {
      const activeConns = await getActiveConnections()
      
      // Get existing session usernames/IPs to avoid duplicates
      const existingKeys = new Set(
        dbSessions.map(s => `${s.username}:${s.clientPublicIp}`)
      )
      
      // Convert real-time connections to session format
      realtimeSessions = activeConns
        .filter(conn => !existingKeys.has(`${conn.user}:${conn.remoteIp}`))
        .map(conn => ({
          id: `realtime-${conn.id}`,
          sessionId: conn.id,
          username: conn.user,
          userId: null,
          clientPublicIp: conn.remoteIp,
          serverIp: conn.localIp || '',
          clientVirtualIp: conn.virtualIp,
          certificateSerial: null,
          certificateCn: null,
          connectedAt: conn.connectedAt,
          disconnectedAt: null,
          duration: conn.established,
          bytesIn: conn.bytesIn,
          bytesOut: conn.bytesOut,
          status: 'ACTIVE',
          deviceType: null,
          deviceOs: null,
          clientVersion: null,
          clientCountry: null,
          clientCity: null,
          clientIsp: null,
          mfaUsed: false,
          mfaType: null,
          isRealtime: true,
        }))
    }
    
    // Combine database sessions with real-time sessions
    const allSessions = [...dbSessions, ...realtimeSessions]
    
    // Calculate additional info for each session
    const enrichedSessions = allSessions.map(session => ({
      ...session,
      durationFormatted: formatDuration(session.duration || 0),
      bytesInFormatted: formatBytes(session.bytesIn || 0),
      bytesOutFormatted: formatBytes(session.bytesOut || 0),
      totalBytesFormatted: formatBytes((session.bytesIn || 0) + (session.bytesOut || 0)),
      isActive: session.status === 'ACTIVE',
    }))
    
    // Summary statistics
    const stats = await getSessionStats(where)
    
    // Update stats to include real-time sessions
    if (status === 'ACTIVE' || status === 'active') {
      stats.totalActive = enrichedSessions.length
      stats.realtimeCount = realtimeSessions.length
    }
    
    return NextResponse.json({
      sessions: enrichedSessions,
      pagination: {
        page,
        limit,
        total: total + realtimeSessions.length,
        totalPages: Math.ceil((total + realtimeSessions.length) / limit),
      },
      stats,
      timestamp: new Date(),
    })
  } catch (error) {
    console.error('Error getting VPN sessions:', error)
    return NextResponse.json(
      { error: 'Failed to get VPN sessions' },
      { status: 500 }
    )
  }
}

// POST - Create/log a new VPN session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Required fields
    const {
      sessionId,
      username,
      clientPublicIp,
      serverIp,
    } = body
    
    if (!sessionId || !username || !clientPublicIp || !serverIp) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, username, clientPublicIp, serverIp' },
        { status: 400 }
      )
    }
    
    // Check if session already exists
    const existingSession = await db.vpnSession.findUnique({
      where: { sessionId },
    })
    
    if (existingSession) {
      return NextResponse.json(
        { error: 'Session with this ID already exists', session: existingSession },
        { status: 409 }
      )
    }
    
    // Look up user if provided
    let userId: string | undefined
    if (username) {
      const vpnUser = await db.vpnUser.findFirst({
        where: {
          OR: [
            { username },
            { email: username },
          ],
        },
      })
      if (vpnUser) {
        userId = vpnUser.id
      }
    }
    
    // Create session
    const session = await db.vpnSession.create({
      data: {
        sessionId,
        username,
        userId,
        clientPublicIp,
        serverIp,
        clientVirtualIp: body.clientVirtualIp,
        certificateSerial: body.certificateSerial,
        certificateCn: body.certificateCn,
        status: body.status || 'ACTIVE',
        deviceType: body.deviceType,
        deviceOs: body.deviceOs,
        clientVersion: body.clientVersion,
        clientCountry: body.clientCountry,
        clientCity: body.clientCity,
        clientIsp: body.clientIsp,
        mfaUsed: body.mfaUsed || false,
        mfaType: body.mfaType,
      },
    })
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'VPN_SESSION_STARTED',
        category: 'VPN_INTEGRATION',
        actorType: 'SYSTEM',
        targetType: 'VPN_SESSION',
        targetId: session.id,
        details: JSON.stringify({
          sessionId,
          username,
          clientPublicIp,
          serverIp,
          userId,
        }),
        status: 'SUCCESS',
      },
    })
    
    return NextResponse.json({
      success: true,
      session,
      message: 'VPN session logged successfully',
    })
  } catch (error) {
    console.error('Error creating VPN session:', error)
    return NextResponse.json(
      { error: 'Failed to create VPN session' },
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

async function getSessionStats(where: Prisma.VpnSessionWhereInput) {
  // Get aggregate stats
  const aggregate = await db.vpnSession.aggregate({
    where,
    _count: true,
    _sum: {
      bytesIn: true,
      bytesOut: true,
      duration: true,
    },
  })
  
  // Get counts by status
  const statusCounts = await db.vpnSession.groupBy({
    by: ['status'],
    where,
    _count: true,
  })
  
  const byStatus: Record<string, number> = {}
  statusCounts.forEach(item => {
    byStatus[item.status] = item._count
  })
  
  return {
    total: aggregate._count,
    totalBytesIn: aggregate._sum.bytesIn || 0,
    totalBytesOut: aggregate._sum.bytesOut || 0,
    totalDuration: aggregate._sum.duration || 0,
    byStatus,
  }
}

type SessionStatus = 'ACTIVE' | 'DISCONNECTED' | 'TIMEOUT' | 'FAILED' | 'BLOCKED'
