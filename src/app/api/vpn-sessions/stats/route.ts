<<<<<<< HEAD
/**
 * VPN Session Statistics API
 * GET: Get comprehensive session statistics
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    // Date range for statistics
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const period = searchParams.get('period') || 'all' // 'today', 'week', 'month', 'year', 'all'
    
    // Calculate date range based on period
    let dateFilter: Prisma.VpnSessionWhereInput = {}
    const now = new Date()
    
    if (startDate && endDate) {
      dateFilter = {
        connectedAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      }
    } else {
      switch (period) {
        case 'today':
          const todayStart = new Date(now)
          todayStart.setHours(0, 0, 0, 0)
          dateFilter = {
            connectedAt: { gte: todayStart },
          }
          break
        case 'week':
          const weekStart = new Date(now)
          weekStart.setDate(weekStart.getDate() - 7)
          weekStart.setHours(0, 0, 0, 0)
          dateFilter = {
            connectedAt: { gte: weekStart },
          }
          break
        case 'month':
          const monthStart = new Date(now)
          monthStart.setDate(1)
          monthStart.setHours(0, 0, 0, 0)
          dateFilter = {
            connectedAt: { gte: monthStart },
          }
          break
        case 'year':
          const yearStart = new Date(now.getFullYear(), 0, 1)
          dateFilter = {
            connectedAt: { gte: yearStart },
          }
          break
      }
    }
    
    // Get overall statistics
    const [
      totalSessions,
      statusCounts,
      trafficStats,
      durationStats,
      topUsers,
      topCountries,
      topDevices,
      hourlyDistribution,
      dailyDistribution,
      activeSessions,
      failedSessions,
    ] = await Promise.all([
      // Total sessions count
      db.vpnSession.count({ where: dateFilter }),
      
      // Sessions by status
      db.vpnSession.groupBy({
        by: ['status'],
        where: dateFilter,
        _count: true,
      }),
      
      // Traffic statistics
      db.vpnSession.aggregate({
        where: dateFilter,
        _sum: {
          bytesIn: true,
          bytesOut: true,
        },
        _avg: {
          bytesIn: true,
          bytesOut: true,
        },
      }),
      
      // Duration statistics
      db.vpnSession.aggregate({
        where: { ...dateFilter, duration: { not: null } },
        _sum: {
          duration: true,
        },
        _avg: {
          duration: true,
        },
        _max: {
          duration: true,
        },
        _min: {
          duration: true,
        },
      }),
      
      // Top 10 users by session count
      db.vpnSession.groupBy({
        by: ['username'],
        where: dateFilter,
        _count: true,
        _sum: {
          bytesIn: true,
          bytesOut: true,
        },
        orderBy: {
          _count: {
            username: 'desc',
          },
        },
        take: 10,
      }),
      
      // Top 10 countries
      db.vpnSession.groupBy({
        by: ['clientCountry'],
        where: { ...dateFilter, clientCountry: { not: null } },
        _count: true,
        orderBy: {
          _count: {
            clientCountry: 'desc',
          },
        },
        take: 10,
      }),
      
      // Top devices
      db.vpnSession.groupBy({
        by: ['deviceType'],
        where: { ...dateFilter, deviceType: { not: null } },
        _count: true,
        orderBy: {
          _count: {
            deviceType: 'desc',
          },
        },
      }),
      
      // Hourly distribution (sessions per hour)
      getHourlyDistribution(dateFilter),
      
      // Daily distribution (sessions per day for last 30 days)
      getDailyDistribution(dateFilter),
      
      // Active sessions count
      db.vpnSession.count({
        where: { ...dateFilter, status: 'ACTIVE' },
      }),
      
      // Failed sessions count
      db.vpnSession.count({
        where: { ...dateFilter, status: 'FAILED' },
      }),
    ])
    
    // Format status counts
    const byStatus: Record<string, number> = {}
    statusCounts.forEach(item => {
      byStatus[item.status] = item._count
    })
    
    // Format traffic stats
    const traffic = {
      totalBytesIn: trafficStats._sum.bytesIn || 0,
      totalBytesOut: trafficStats._sum.bytesOut || 0,
      totalBytes: (trafficStats._sum.bytesIn || 0) + (trafficStats._sum.bytesOut || 0),
      avgBytesIn: Math.round(trafficStats._avg.bytesIn || 0),
      avgBytesOut: Math.round(trafficStats._avg.bytesOut || 0),
      totalBytesInFormatted: formatBytes(trafficStats._sum.bytesIn || 0),
      totalBytesOutFormatted: formatBytes(trafficStats._sum.bytesOut || 0),
      totalBytesFormatted: formatBytes((trafficStats._sum.bytesIn || 0) + (trafficStats._sum.bytesOut || 0)),
    }
    
    // Format duration stats
    const duration = {
      total: durationStats._sum.duration || 0,
      average: Math.round(durationStats._avg.duration || 0),
      max: durationStats._max.duration || 0,
      min: durationStats._min.duration || 0,
      totalFormatted: formatDuration(durationStats._sum.duration || 0),
      averageFormatted: formatDuration(Math.round(durationStats._avg.duration || 0)),
      maxFormatted: formatDuration(durationStats._max.duration || 0),
      minFormatted: formatDuration(durationStats._min.duration || 0),
    }
    
    // Format top users
    const topUsersFormatted = topUsers.map(user => ({
      username: user.username,
      sessions: user._count,
      bytesIn: user._sum.bytesIn || 0,
      bytesOut: user._sum.bytesOut || 0,
      totalBytes: (user._sum.bytesIn || 0) + (user._sum.bytesOut || 0),
      totalBytesFormatted: formatBytes((user._sum.bytesIn || 0) + (user._sum.bytesOut || 0)),
    }))
    
    // Format top countries
    const topCountriesFormatted = topCountries.map(country => ({
      country: country.clientCountry,
      sessions: country._count,
    }))
    
    // Format top devices
    const topDevicesFormatted = topDevices.map(device => ({
      deviceType: device.deviceType,
      sessions: device._count,
    }))
    
    // Calculate success rate
    const successRate = totalSessions > 0
      ? ((totalSessions - failedSessions) / totalSessions * 100).toFixed(2)
      : '100.00'
    
    // Calculate unique users
    const uniqueUsers = topUsers.length
    
    const statistics = {
      period,
      dateRange: {
        start: startDate || (dateFilter.connectedAt as Record<string, Date>)?.gte || null,
        end: endDate || (dateFilter.connectedAt as Record<string, Date>)?.lte || null,
      },
      overview: {
        totalSessions,
        activeSessions,
        failedSessions,
        uniqueUsers,
        successRate: parseFloat(successRate),
      },
      byStatus,
      traffic,
      duration,
      topUsers: topUsersFormatted,
      topCountries: topCountriesFormatted,
      topDevices: topDevicesFormatted,
      hourlyDistribution,
      dailyDistribution,
    }
    
    return NextResponse.json({
      statistics,
      timestamp: new Date(),
    })
  } catch (error) {
    console.error('Error getting VPN session statistics:', error)
    return NextResponse.json(
      { error: 'Failed to get VPN session statistics' },
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

async function getHourlyDistribution(where: Prisma.VpnSessionWhereInput) {
  // Get all sessions for the period
  const sessions = await db.vpnSession.findMany({
    where,
    select: { connectedAt: true },
  })
  
  // Count by hour
  const hourly: Record<number, number> = {}
  for (let i = 0; i < 24; i++) {
    hourly[i] = 0
  }
  
  sessions.forEach(session => {
    const hour = session.connectedAt.getHours()
    hourly[hour]++
  })
  
  return Object.entries(hourly).map(([hour, count]) => ({
    hour: parseInt(hour),
    sessions: count,
  }))
}

async function getDailyDistribution(where: Prisma.VpnSessionWhereInput) {
  // Get all sessions for the period
  const sessions = await db.vpnSession.findMany({
    where,
    select: { connectedAt: true },
  })
  
  // Count by day
  const daily: Record<string, number> = {}
  
  sessions.forEach(session => {
    const date = session.connectedAt.toISOString().split('T')[0]
    daily[date] = (daily[date] || 0) + 1
  })
  
  // Sort by date and return
  return Object.entries(daily)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({
      date,
      sessions: count,
    }))
    .slice(-30) // Last 30 days
}
=======
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'today'
    
    let startDate = new Date()
    if (period === 'today') {
      startDate.setHours(0, 0, 0, 0)
    } else if (period === 'week') {
      startDate.setDate(startDate.getDate() - 7)
    } else if (period === 'month') {
      startDate.setMonth(startDate.getMonth() - 1)
    }
    
    const sessions = await db.vpnSession.findMany({
      where: { connectedAt: { gte: startDate } }
    })
    
    const activeSessions = sessions.filter(s => s.status === 'ACTIVE').length
    const totalBytesIn = sessions.reduce((sum, s) => sum + s.bytesIn, 0)
    const totalBytesOut = sessions.reduce((sum, s) => sum + s.bytesOut, 0)
    const avgDuration = sessions.length > 0 
      ? sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / sessions.length 
      : 0
    
    return NextResponse.json({
      stats: {
        activeSessions,
        totalToday: sessions.length,
        totalBytesIn,
        totalBytesOut,
        avgDuration: Math.round(avgDuration),
      }
    })
  } catch (error) {
    console.error('Failed to fetch session stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
