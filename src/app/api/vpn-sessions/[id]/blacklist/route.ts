import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST - Blacklist a session's source IP and optionally suspend user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { reason, suspendUser = false } = body

    // Find the session
    const session = await db.vpnSession.findUnique({
      where: { sessionId: id },
      include: {
        user: true,
      },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Add IP to geo-ip restrictions (blacklist)
    if (session.clientPublicIp) {
      // Check if already blocked
      const existing = await db.geoIpRestriction.findFirst({
        where: {
          type: 'IP',
          value: session.clientPublicIp,
        },
      })

      if (!existing) {
        await db.geoIpRestriction.create({
          data: {
            type: 'IP',
            value: session.clientPublicIp,
            action: 'BLOCK',
            reason: reason || `Blacklisted from VPN session ${id}`,
            isEnabled: true,
          },
        })
      }
    }

    // Optionally suspend the user
    if (suspendUser && session.user) {
      await db.vpnUser.update({
        where: { id: session.user.id },
        data: { status: 'SUSPENDED' },
      })
    }

    // Disconnect the session by updating its status
    await db.vpnSession.update({
      where: { sessionId: id },
      data: {
        status: 'BLOCKED',
        disconnectedAt: new Date(),
      },
    })

    // Log the action
    await db.auditLog.create({
      data: {
        action: 'VPN_SESSION_BLACKLISTED',
        category: 'VPN_INTEGRATION',
        actorType: 'ADMIN',
        targetId: session.id,
        targetType: 'VPN_SESSION',
        details: JSON.stringify({
          sessionId: id,
          username: session.username,
          clientIp: session.clientPublicIp,
          reason,
          suspendUser,
        }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({
      success: true,
      message: `Session ${id} blacklisted successfully`,
      blacklistedIp: session.clientPublicIp,
      userSuspended: suspendUser,
    })
  } catch (error) {
    console.error('Blacklist session error:', error)
    return NextResponse.json(
      { error: 'Failed to blacklist session' },
      { status: 500 }
    )
  }
}
