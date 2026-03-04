/**
 * VPN Session Reports API
 * GET: Get session history with filters and stats
 * Supports CSV and PDF export
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    // Filters
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const username = searchParams.get('username')
    const clientIp = searchParams.get('clientIp')
    const status = searchParams.get('status')
    const country = searchParams.get('country')
    const limit = parseInt(searchParams.get('limit') || '100')
    const format = searchParams.get('format') // 'csv' or 'pdf'
    
    // Build where clause
    const where: Prisma.VpnSessionWhereInput = {}
    
    if (username) {
      where.username = { contains: username, mode: 'insensitive' }
    }
    
    if (clientIp) {
      where.clientPublicIp = { contains: clientIp }
    }
    
    if (status && status !== 'all') {
      where.status = status as any
    }
    
    if (country) {
      where.clientCountry = country
    }
    
    // Date range filter
    if (startDate || endDate) {
      where.connectedAt = {}
      if (startDate) {
        where.connectedAt.gte = new Date(startDate)
      }
      if (endDate) {
        // Include the full end date
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.connectedAt.lte = end
      }
    }
    
    // Get sessions
    const sessions = await db.vpnSession.findMany({
      where,
      orderBy: { connectedAt: 'desc' },
      take: limit,
    })
    
    // Calculate statistics
    const stats = {
      totalSessions: sessions.length,
      uniqueUsers: new Set(sessions.map(s => s.username)).size,
      totalDuration: sessions.reduce((sum, s) => sum + (s.duration || 0), 0),
      totalBytesIn: sessions.reduce((sum, s) => sum + s.bytesIn, 0),
      totalBytesOut: sessions.reduce((sum, s) => sum + s.bytesOut, 0),
      avgDuration: 0,
      avgBytesPerSession: 0,
      byStatus: {} as Record<string, number>,
      byDevice: {} as Record<string, number>,
      byCountry: {} as Record<string, number>,
    }
    
    if (sessions.length > 0) {
      stats.avgDuration = Math.round(stats.totalDuration / sessions.length)
      stats.avgBytesPerSession = Math.round((stats.totalBytesIn + stats.totalBytesOut) / sessions.length)
      
      // Count by status
      sessions.forEach(s => {
        stats.byStatus[s.status] = (stats.byStatus[s.status] || 0) + 1
      })
      
      // Count by device
      sessions.forEach(s => {
        const device = s.deviceOs || s.deviceType || 'Unknown'
        stats.byDevice[device] = (stats.byDevice[device] || 0) + 1
      })
      
      // Count by country
      sessions.forEach(s => {
        const c = s.clientCountry || 'Unknown'
        stats.byCountry[c] = (stats.byCountry[c] || 0) + 1
      })
    }
    
    // Handle export formats
    if (format === 'csv') {
      return exportCSV(sessions, stats)
    }
    
    if (format === 'pdf') {
      return exportPDF(sessions, stats)
    }
    
    return NextResponse.json({
      sessions,
      stats,
      timestamp: new Date(),
    })
  } catch (error) {
    console.error('Error generating session report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}

function exportCSV(sessions: any[], stats: any) {
  const headers = [
    'Status',
    'Username',
    'Client IP',
    'VPN IP',
    'Server IP',
    'Country',
    'City',
    'Device OS',
    'Device Type',
    'Duration (seconds)',
    'Bytes In',
    'Bytes Out',
    'Connected At',
    'Disconnected At',
    'Disconnect Reason',
  ]
  
  const rows = sessions.map(s => [
    s.status,
    s.username,
    s.clientPublicIp,
    s.clientVirtualIp || '',
    s.serverIp,
    s.clientCountry || '',
    s.clientCity || '',
    s.deviceOs || '',
    s.deviceType || '',
    s.duration || 0,
    s.bytesIn,
    s.bytesOut,
    s.connectedAt.toISOString(),
    s.disconnectedAt ? s.disconnectedAt.toISOString() : '',
    s.disconnectReason || '',
  ])
  
  // Add summary row
  rows.push([])
  rows.push(['SUMMARY'])
  rows.push(['Total Sessions', stats.totalSessions])
  rows.push(['Unique Users', stats.uniqueUsers])
  rows.push(['Total Duration (seconds)', stats.totalDuration])
  rows.push(['Total Bytes In', stats.totalBytesIn])
  rows.push(['Total Bytes Out', stats.totalBytesOut])
  rows.push(['Average Duration (seconds)', stats.avgDuration])
  
  const csv = [
    headers.join(','),
    ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n')
  
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="vpn-sessions-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}

function exportPDF(sessions: any[], stats: any) {
  // Generate a simple HTML report that can be printed as PDF
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>VPN Session Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
    h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
    h2 { color: #1e40af; margin-top: 30px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
    th { background: #f3f4f6; padding: 8px; text-align: left; border: 1px solid #e5e7eb; }
    td { padding: 6px 8px; border: 1px solid #e5e7eb; }
    .status-active { background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; }
    .status-disconnected { background: #f3f4f6; color: #374151; padding: 2px 6px; border-radius: 4px; }
    .status-failed, .status-blocked { background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; }
    .status-timeout { background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; }
    .stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin: 20px 0; }
    .stat-box { background: #f9fafb; padding: 15px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; color: #1e40af; }
    .stat-label { font-size: 12px; color: #6b7280; margin-top: 5px; }
    .footer { margin-top: 30px; text-align: center; color: #6b7280; font-size: 11px; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>VPN Session Report</h1>
  <p>Generated: ${new Date().toLocaleString()}</p>
  
  <div class="stats-grid">
    <div class="stat-box">
      <div class="stat-value">${stats.totalSessions}</div>
      <div class="stat-label">Total Sessions</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${stats.uniqueUsers}</div>
      <div class="stat-label">Unique Users</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${formatDuration(stats.avgDuration)}</div>
      <div class="stat-label">Avg Duration</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${formatBytes(stats.totalBytesIn)}</div>
      <div class="stat-label">Total Download</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${formatBytes(stats.totalBytesOut)}</div>
      <div class="stat-label">Total Upload</div>
    </div>
  </div>
  
  <h2>Session Details</h2>
  <table>
    <thead>
      <tr>
        <th>Status</th>
        <th>User</th>
        <th>Client IP</th>
        <th>VPN IP</th>
        <th>Location</th>
        <th>Duration</th>
        <th>Traffic</th>
        <th>Connected</th>
      </tr>
    </thead>
    <tbody>
      ${sessions.map(s => `
        <tr>
          <td><span class="status-${s.status.toLowerCase()}">${s.status}</span></td>
          <td>${s.username}</td>
          <td>${s.clientPublicIp}</td>
          <td>${s.clientVirtualIp || '-'}</td>
          <td>${s.clientCity ? s.clientCity + ', ' : ''}${s.clientCountry || '-'}</td>
          <td>${formatDuration(s.duration)}</td>
          <td>↓${formatBytes(s.bytesIn)} / ↑${formatBytes(s.bytesOut)}</td>
          <td>${s.connectedAt.toLocaleString()}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  
  ${Object.keys(stats.byDevice).length > 0 ? `
    <h2>Sessions by Device</h2>
    <table>
      <thead><tr><th>Device</th><th>Sessions</th><th>Percentage</th></tr></thead>
      <tbody>
        ${Object.entries(stats.byDevice).map(([device, count]) => `
          <tr>
            <td>${device}</td>
            <td>${count}</td>
            <td>${((count as number / stats.totalSessions) * 100).toFixed(1)}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''}
  
  ${Object.keys(stats.byCountry).length > 0 ? `
    <h2>Sessions by Country</h2>
    <table>
      <thead><tr><th>Country</th><th>Sessions</th><th>Percentage</th></tr></thead>
      <tbody>
        ${Object.entries(stats.byCountry).map(([country, count]) => `
          <tr>
            <td>${country}</td>
            <td>${count}</td>
            <td>${((count as number / stats.totalSessions) * 100).toFixed(1)}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''}
  
  <div class="footer">
    <p>VPN PKI Management Platform - Session Report</p>
  </div>
</body>
</html>
  `
  
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'Content-Disposition': `attachment; filename="vpn-report-${new Date().toISOString().split('T')[0]}.html"`,
    },
  })
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
