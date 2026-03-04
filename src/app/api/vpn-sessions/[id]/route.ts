/**
 * VPN Session by ID API
 * GET: Get a specific VPN session by ID
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Try to find by ID or sessionId
    const session = await db.vpnSession.findFirst({
      where: {
        OR: [
          { id },
          { sessionId: id },
        ],
      },
      include: {
        // If we want to include related user data in the future
      } as never,
    })
    
    if (!session) {
      return NextResponse.json(
        { error: 'VPN session not found' },
        { status: 404 }
      )
    }
    
    // Get user info if available
    let userInfo = null
    if (session.userId) {
      const vpnUser = await db.vpnUser.findUnique({
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
      userInfo = vpnUser
    }
    
    // Calculate session duration if active
    let currentDuration = session.duration
    if (session.status === 'ACTIVE' && !session.disconnectedAt) {
      currentDuration = Math.floor((Date.now() - session.connectedAt.getTime()) / 1000)
    }
    
    // Format response
    const enrichedSession = {
      ...session,
      duration: currentDuration,
      durationFormatted: formatDuration(currentDuration || 0),
      bytesInFormatted: formatBytes(session.bytesIn),
      bytesOutFormatted: formatBytes(session.bytesOut),
      totalBytesFormatted: formatBytes(session.bytesIn + session.bytesOut),
      isActive: session.status === 'ACTIVE',
      connectedAtFormatted: formatDate(session.connectedAt),
      disconnectedAtFormatted: session.disconnectedAt ? formatDate(session.disconnectedAt) : null,
      userInfo,
    }
    
    // Get certificate info if available
    let certificateInfo = null
    if (session.certificateSerial) {
      const cert = await db.certificate.findFirst({
        where: { serialNumber: session.certificateSerial },
        select: {
          id: true,
          commonName: true,
          status: true,
          expiryDate: true,
          issueDate: true,
        },
      })
      certificateInfo = cert
    }
    
    return NextResponse.json({
      session: enrichedSession,
      certificate: certificateInfo,
    })
  } catch (error) {
    console.error('Error getting VPN session:', error)
    return NextResponse.json(
      { error: 'Failed to get VPN session' },
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
