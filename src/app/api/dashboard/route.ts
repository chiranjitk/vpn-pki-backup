import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getVPNStatus } from '@/lib/pki/strongswan'

// GET - Dashboard statistics
export async function GET() {
  try {
    // Get user stats
    const userStats = await db.vpnUser.groupBy({
      by: ['status'],
      _count: true,
    })

    // Get certificate stats
    const certStats = await db.certificate.groupBy({
      by: ['status'],
      _count: true,
    })

    // Get certificates expiring soon (within 30 days)
    const now = new Date()
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(now.getDate() + 30)

    const expiringCertificates = await db.certificate.findMany({
      where: {
        status: 'ACTIVE',
        expiryDate: {
          lte: thirtyDaysFromNow,
          gt: now,
        },
      },
      include: {
        user: {
          select: {
            username: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { expiryDate: 'asc' },
      take: 10,
    })

    // Calculate days remaining for each certificate
    const expiringCerts = expiringCertificates.map((cert) => ({
      id: cert.id,
      commonName: cert.commonName,
      username: cert.user.username,
      expiryDate: cert.expiryDate,
      daysRemaining: Math.ceil(
        (cert.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      ),
    }))

    // Get recent audit logs
    const recentLogs = await db.auditLog.findMany({
      where: {
        category: { in: ['CERTIFICATE_OPERATIONS', 'REVOCATION', 'USER_MANAGEMENT'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    const recentActivity = recentLogs.map((log) => ({
      id: log.id,
      action: log.action.replace(/_/g, ' '),
      user: log.actorType,
      timestamp: log.createdAt,
      status: log.status === 'SUCCESS' ? 'success' : log.status === 'FAILURE' ? 'failure' : 'warning',
    }))

    // Get CRL info
    const crlInfo = await db.crlInfo.findFirst()

    // Get VPN status with timeout
    let vpnStatus
    try {
      vpnStatus = await Promise.race([
        getVPNStatus(),
        new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error('VPN status timeout')), 5000)
        )
      ])
    } catch {
      vpnStatus = {
        running: false,
        activeConnections: 0,
        version: 'Unknown',
      }
    }

    // Calculate totals
    const totalUsers = userStats.reduce((acc, s) => acc + s._count, 0)
    const activeUsers = userStats.find((s) => s.status === 'ACTIVE')?._count || 0
    const totalCertificates = certStats.reduce((acc, s) => acc + s._count, 0)
    const activeCertificates = certStats.find((s) => s.status === 'ACTIVE')?._count || 0
    const expiredCertificates = certStats.find((s) => s.status === 'EXPIRED')?._count || 0
    const revokedCertificates = certStats.find((s) => s.status === 'REVOKED')?._count || 0

    return NextResponse.json({
      stats: {
        totalUsers,
        activeUsers,
        totalCertificates,
        activeCertificates,
        expiredCertificates,
        revokedCertificates,
        expiringSoon: expiringCerts.length,
      },
      vpn: {
        status: vpnStatus.running ? 'RUNNING' : 'STOPPED',
        uptime: vpnStatus.uptime,
        activeConnections: vpnStatus.activeConnections,
        version: vpnStatus.version,
      },
      crl: {
        lastUpdate: crlInfo?.thisUpdate || null,
        nextUpdate: crlInfo?.nextUpdate || null,
        revokedCount: crlInfo?.revokedCount || 0,
      },
      expiringCertificates: expiringCerts,
      recentActivity,
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
