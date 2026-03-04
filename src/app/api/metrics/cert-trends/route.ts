import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Certificate Trends API - Calculate from audit logs and certificate data
export async function GET() {
  try {
    const now = new Date()
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(now.getMonth() - 6)
    
    // Get certificate issuance by month
    const certificates = await db.certificate.findMany({
      where: {
        createdAt: {
          gte: sixMonthsAgo,
        },
      },
      select: {
        createdAt: true,
        status: true,
        expiryDate: true,
      },
    })
    
<<<<<<< HEAD
    // Get server certificates too
    const serverCerts = await db.serverCertificate.findMany({
      where: {
        createdAt: {
          gte: sixMonthsAgo,
        },
      },
      select: {
        createdAt: true,
        status: true,
        expiryDate: true,
      },
    })
    
=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
    // Get revocations by month
    const revocations = await db.revocation.findMany({
      where: {
        revokedAt: {
          gte: sixMonthsAgo,
        },
      },
      select: {
        revokedAt: true,
      },
    })
    
    // Group by month
    const months: { [key: string]: { issued: number; expired: number; revoked: number } } = {}
    
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date()
      date.setMonth(now.getMonth() - i)
      const key = date.toLocaleString('default', { month: 'short' })
      months[key] = { issued: 0, expired: 0, revoked: 0 }
    }
    
    // Count certificates issued by month
<<<<<<< HEAD
    const allCerts = [...certificates, ...serverCerts]
    
    allCerts.forEach((cert) => {
=======
    certificates.forEach((cert) => {
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
      const month = cert.createdAt.toLocaleString('default', { month: 'short' })
      if (months[month]) {
        months[month].issued++
      }
      
      // Check if expired in this period
      if (cert.status === 'EXPIRED' || cert.status === 'REVOKED') {
        const expMonth = cert.expiryDate.toLocaleString('default', { month: 'short' })
        if (months[expMonth]) {
          months[expMonth].expired++
        }
      }
    })
    
    // Count revocations by month
    revocations.forEach((rev) => {
      const month = rev.revokedAt.toLocaleString('default', { month: 'short' })
      if (months[month]) {
        months[month].revoked++
      }
    })
    
    // Convert to array for chart
    const trendData = Object.entries(months).map(([month, data]) => ({
      month,
      issued: data.issued,
      expired: data.expired,
      revoked: data.revoked,
    }))
    
    // Get audit log activity by category
    const auditByCategory = await db.auditLog.groupBy({
      by: ['category'],
      where: {
        createdAt: {
          gte: sixMonthsAgo,
        },
      },
      _count: true,
    })
    
    // Get audit activity by day (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(now.getDate() - 30)
    
    const recentAudits = await db.auditLog.findMany({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        createdAt: true,
        action: true,
        status: true,
      },
    })
    
    // Group by day
    const dailyActivity: { [key: string]: { total: number; success: number; failure: number } } = {}
    
    recentAudits.forEach((audit) => {
      const day = audit.createdAt.toISOString().split('T')[0]
      if (!dailyActivity[day]) {
        dailyActivity[day] = { total: 0, success: 0, failure: 0 }
      }
      dailyActivity[day].total++
      if (audit.status === 'SUCCESS') {
        dailyActivity[day].success++
      } else if (audit.status === 'FAILURE') {
        dailyActivity[day].failure++
      }
    })
    
    // Convert to array
    const dailyData = Object.entries(dailyActivity)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14) // Last 14 days
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        total: data.total,
        success: data.success,
        failure: data.failure,
      }))
    
    // Summary stats
    const totalIssued = trendData.reduce((sum, m) => sum + m.issued, 0)
    const totalExpired = trendData.reduce((sum, m) => sum + m.expired, 0)
    const totalRevoked = trendData.reduce((sum, m) => sum + m.revoked, 0)
    
    return NextResponse.json({
      monthly: trendData,
      dailyActivity: dailyData,
      byCategory: auditByCategory.map((c) => ({
        category: c.category,
        count: c._count,
      })),
      summary: {
        totalIssued,
        totalExpired,
        totalRevoked,
        avgPerMonth: Math.round(totalIssued / 6),
      },
    })
  } catch (error) {
    console.error('Certificate trends error:', error)
    return NextResponse.json({ error: 'Failed to get certificate trends' }, { status: 500 })
  }
}
