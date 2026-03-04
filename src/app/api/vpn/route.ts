/**
 * VPN API Route
 * Enhanced with multiple actions for VPN management
 * 
 * GET: Basic VPN status and connections
 * POST: Various VPN actions (status, connections, logs, test, reload, restart, terminate)
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
  terminateConnection,
  getXfrmState,
  getXfrmPolicy,
} from '@/lib/vpn/monitor'
import {
  reloadStrongSwan,
  restartStrongSwan,
  initiateConnection,
} from '@/lib/pki/strongswan'

// GET - Get VPN status and connections (backward compatible)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const detailed = searchParams.get('detailed') === 'true'

    // Get basic status
    const [status, connections] = await Promise.all([
      getVpnStatus(),
      getActiveConnections(),
    ])

    // Log status check
    try {
      await db.vpnStatus.create({
        data: {
          serviceName: 'strongswan',
          status: status.status === 'running' ? 'RUNNING' : 
                  status.status === 'stopped' ? 'STOPPED' : 'UNKNOWN',
          uptime: status.uptime,
          activeConnections: connections.length,
          lastError: status.status !== 'running' ? 'Service not running' : null,
        },
      })
    } catch {
      // Ignore database errors for status logging
    }

    // Basic response
    const basicResponse = {
      status: {
        running: status.status === 'running',
        uptime: status.uptime,
        activeConnections: connections.length,
        version: status.version,
        pid: status.pid,
      },
      connections: connections.map((conn) => ({
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
        ikeProposal: conn.ikeProposal,
        espProposal: conn.espProposal,
      })),
      timestamp: new Date(),
    }

    // If detailed view requested, add more info
    if (detailed) {
      const [stats, connectivity, certificates, alerts] = await Promise.all([
        getConnectionStats(),
        testVpnConnectivity(),
        getCertificateUsage(),
        getVpnAlerts(),
      ])

      return NextResponse.json({
        ...basicResponse,
        stats: {
          totalBytesIn: stats.totalBytesIn,
          totalBytesOut: stats.totalBytesOut,
          avgDuration: stats.avgDuration,
          uniqueUsers: stats.uniqueUsers,
        },
        connectivity: {
          success: connectivity.success,
          latency: connectivity.latency,
          error: connectivity.error,
        },
        certificates: {
          active: certificates.filter(c => c.isValid).length,
          expiring: certificates.filter(c => c.isExpiring).length,
          expired: certificates.filter(c => !c.isValid).length,
        },
        alerts: alerts.slice(0, 10),
      })
    }

    return NextResponse.json(basicResponse)
  } catch (error) {
    console.error('Get VPN status error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - VPN control actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, connectionName, logLines, reason } = body

    let result: { success: boolean; message: string; data?: unknown }

    switch (action) {
      case 'status': {
        // Get detailed status
        const [status, connections, stats] = await Promise.all([
          getVpnStatus(),
          getActiveConnections(),
          getConnectionStats(),
        ])

        result = {
          success: true,
          message: 'Status retrieved',
          data: {
            service: status,
            connections,
            stats,
          },
        }
        break
      }

      case 'connections': {
        // Get active connections with details
        const connections = await getActiveConnections()
        
        result = {
          success: true,
          message: `${connections.length} active connections`,
          data: { connections },
        }
        break
      }

      case 'logs': {
        // Get VPN logs
        const lines = logLines || 100
        const logs = await getVpnLogs(lines)
        
        result = {
          success: true,
          message: `${logs.length} log entries retrieved`,
          data: { logs },
        }
        break
      }

      case 'test': {
        // Test VPN connectivity
        const testResult = await testVpnConnectivity()
        
        result = {
          success: testResult.success,
          message: testResult.success ? 'VPN connectivity test passed' : testResult.error || 'VPN connectivity test failed',
          data: {
            latency: testResult.latency,
            details: testResult.details,
          },
        }
        break
      }

      case 'alerts': {
        // Get VPN alerts
        const alerts = await getVpnAlerts()
        
        result = {
          success: true,
          message: `${alerts.length} alerts`,
          data: { alerts },
        }
        break
      }

      case 'certificates': {
        // Get certificates in use
        const certificates = await getCertificateUsage()
        
        result = {
          success: true,
          message: `${certificates.length} certificates in use`,
          data: { certificates },
        }
        break
      }

      case 'xfrm': {
        // Get XFRM state and policies
        const [states, policies] = await Promise.all([
          getXfrmState(),
          getXfrmPolicy(),
        ])
        
        result = {
          success: true,
          message: `${states.length} states, ${policies.length} policies`,
          data: { states, policies },
        }
        break
      }

      case 'reload': {
        // Reload strongSwan configuration
        result = await reloadStrongSwan()
        
        // Log audit
        await db.auditLog.create({
          data: {
            action: 'RELOAD_VPN',
            category: 'VPN_INTEGRATION',
            actorType: 'ADMIN',
            targetType: 'VPN_SERVICE',
            status: result.success ? 'SUCCESS' : 'FAILURE',
            errorMessage: result.success ? null : result.message,
          },
        })
        break
      }

      case 'restart': {
        // Restart strongSwan service
        result = await restartStrongSwan()
        
        // Log audit
        await db.auditLog.create({
          data: {
            action: 'RESTART_VPN',
            category: 'VPN_INTEGRATION',
            actorType: 'ADMIN',
            targetType: 'VPN_SERVICE',
            status: result.success ? 'SUCCESS' : 'FAILURE',
            errorMessage: result.success ? null : result.message,
          },
        })
        break
      }

      case 'terminate': {
        // Terminate a specific connection
        if (!connectionName) {
          return NextResponse.json(
            { error: 'Connection name is required' },
            { status: 400 }
          )
        }
        
        // Get connection info before terminating
        const connections = await getActiveConnections()
        const conn = connections.find(c => c.name === connectionName)
        
        result = await terminateConnection(connectionName)
        
        // Log audit
        await db.auditLog.create({
          data: {
            action: 'TERMINATE_VPN_CONNECTION',
            category: 'VPN_INTEGRATION',
            actorType: 'ADMIN',
            targetType: 'VPN_CONNECTION',
            targetId: connectionName,
            details: JSON.stringify({
              connectionName,
              user: conn?.user,
              remoteIp: conn?.remoteIp,
              reason: reason || 'Manual termination',
            }),
            status: result.success ? 'SUCCESS' : 'FAILURE',
            errorMessage: result.success ? null : result.message,
          },
        })
        break
      }

      case 'initiate': {
        // Initiate a connection
        if (!connectionName) {
          return NextResponse.json(
            { error: 'Connection name is required' },
            { status: 400 }
          )
        }
        
        result = await initiateConnection(connectionName)
        
        // Log audit
        await db.auditLog.create({
          data: {
            action: 'INITIATE_VPN_CONNECTION',
            category: 'VPN_INTEGRATION',
            actorType: 'ADMIN',
            targetType: 'VPN_CONNECTION',
            targetId: connectionName,
            status: result.success ? 'SUCCESS' : 'FAILURE',
            errorMessage: result.success ? null : result.message,
          },
        })
        break
      }

      case 'stats': {
        // Get connection statistics
        const stats = await getConnectionStats()
        
        result = {
          success: true,
          message: 'Statistics retrieved',
          data: { stats },
        }
        break
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action', validActions: [
            'status', 'connections', 'logs', 'test', 'alerts', 
            'certificates', 'xfrm', 'reload', 'restart', 
            'terminate', 'initiate', 'stats'
          ]},
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      data: result.data,
    })
  } catch (error) {
    console.error('VPN action error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
