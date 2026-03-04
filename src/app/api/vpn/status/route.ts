/**
 * Comprehensive VPN Status API
 * GET: Returns complete VPN status including service, connections, stats, certificates, logs, and alerts
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getVpnStatus,
  getActiveConnections,
  getConnectionStats,
  getVpnLogs,
  testVpnConnectivity,
  getCertificateUsage,
  getVpnAlerts,
  getXfrmState,
  getXfrmPolicy,
} from '@/lib/vpn/monitor'

export interface ComprehensiveVpnStatus {
  service: {
    status: 'running' | 'stopped' | 'unknown'
    uptime: number
    version: string
    pid?: number
  }
  connections: Array<{
    id: string
    name: string
    user: string
    userDn?: string
    remoteIp: string
    localIp?: string
    virtualIp?: string
    connectedAt: Date
    established: number
    state: string
    bytesIn: number
    bytesOut: number
    packetsIn: number
    packetsOut: number
    ikeProposal?: string
    espProposal?: string
  }>
  stats: {
    totalConnections: number
    totalBytesIn: number
    totalBytesOut: number
    avgDuration: number
    peakConnections: number
    uniqueUsers: number
  }
  certificates: {
    active: number
    expiring: number
    expired: number
    list: Array<{
      subject: string
      issuer: string
      serialNumber: string
      type: string
      notBefore: Date
      notAfter: Date
      isValid: boolean
      isExpiring: boolean
      daysUntilExpiry: number
    }>
  }
  recentLogs: Array<{
    timestamp: string
    level: string
    message: string
    source?: string
  }>
  alerts: Array<{
    id: string
    type: string
    message: string
    timestamp: Date
    source: string
    acknowledged: boolean
  }>
  xfrm?: {
    states: Array<{
      src: string
      dst: string
      proto: string
      spi: string
      mode: string
      reqid: string
    }>
    policies: Array<{
      src: string
      dst: string
      dir: string
      proto: string
      priority: string
      tmpl: string
    }>
  }
  connectivity: {
    success: boolean
    latency?: number
    error?: string
    details?: string
  }
  timestamp: Date
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const includeLogs = searchParams.get('logs') !== 'false'
    const logLines = parseInt(searchParams.get('logLines') || '50', 10)
    const includeXfrm = searchParams.get('xfrm') === 'true'

    // Run all monitoring functions in parallel
    const [
      serviceStatus,
      connections,
      stats,
      connectivityTest,
      certificates,
      alerts,
      xfrmState,
      xfrmPolicy,
    ] = await Promise.all([
      getVpnStatus(),
      getActiveConnections(),
      getConnectionStats(),
      testVpnConnectivity(),
      getCertificateUsage(),
      getVpnAlerts(),
      includeXfrm ? getXfrmState() : Promise.resolve([]),
      includeXfrm ? getXfrmPolicy() : Promise.resolve([]),
    ])

    // Get logs separately (can be expensive)
    let recentLogs: Array<{ timestamp: string; level: string; message: string; source?: string }> = []
    if (includeLogs) {
      recentLogs = await getVpnLogs(logLines)
    }

    // Calculate certificate stats
    const certStats = {
      active: certificates.filter(c => c.isValid).length,
      expiring: certificates.filter(c => c.isExpiring && c.isValid).length,
      expired: certificates.filter(c => !c.isValid).length,
      list: certificates.slice(0, 20), // Limit to 20 for performance
    }

    // Build response
    const response: ComprehensiveVpnStatus = {
      service: {
        status: serviceStatus.status,
        uptime: serviceStatus.uptime,
        version: serviceStatus.version,
        pid: serviceStatus.pid,
      },
      connections: connections.map(conn => ({
        id: conn.id,
        name: conn.name,
        user: conn.user,
        userDn: conn.userDn,
        remoteIp: conn.remoteIp,
        localIp: conn.localIp,
        virtualIp: conn.virtualIp,
        connectedAt: conn.connectedAt,
        established: conn.established,
        state: conn.state,
        bytesIn: conn.bytesIn,
        bytesOut: conn.bytesOut,
        packetsIn: conn.packetsIn,
        packetsOut: conn.packetsOut,
        ikeProposal: conn.ikeProposal,
        espProposal: conn.espProposal,
      })),
      stats: {
        totalConnections: stats.totalConnections,
        totalBytesIn: stats.totalBytesIn,
        totalBytesOut: stats.totalBytesOut,
        avgDuration: stats.avgDuration,
        peakConnections: stats.peakConnections,
        uniqueUsers: stats.uniqueUsers,
      },
      certificates: certStats,
      recentLogs,
      alerts,
      connectivity: {
        success: connectivityTest.success,
        latency: connectivityTest.latency,
        error: connectivityTest.error,
        details: connectivityTest.details,
      },
      timestamp: new Date(),
    }

    // Add XFRM data if requested
    if (includeXfrm) {
      response.xfrm = {
        states: xfrmState,
        policies: xfrmPolicy,
      }
    }

    // Store status in database for historical tracking
    try {
      await db.vpnStatus.create({
        data: {
          serviceName: 'strongswan',
          status: serviceStatus.status === 'running' ? 'RUNNING' : 
                  serviceStatus.status === 'stopped' ? 'STOPPED' : 'UNKNOWN',
          uptime: serviceStatus.uptime,
          activeConnections: connections.length,
          lastError: connectivityTest.error,
        },
      })
    } catch {
      // Ignore database errors for status logging
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error getting comprehensive VPN status:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get VPN status',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      },
      { status: 500 }
    )
  }
}
