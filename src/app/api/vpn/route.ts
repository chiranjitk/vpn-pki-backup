import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getVPNStatus,
  reloadStrongSwan,
  restartStrongSwan,
  getActiveConnections,
  terminateConnection,
} from '@/lib/pki/strongswan'

// GET - Get VPN status and connections
export async function GET() {
  try {
    const [status, connections] = await Promise.all([
      getVPNStatus(),
      getActiveConnections(),
    ])

    // Log status check
    await db.vpnStatus.create({
      data: {
        serviceName: 'strongswan',
        status: status.running ? 'RUNNING' : 'STOPPED',
        uptime: status.uptime,
        activeConnections: status.activeConnections,
        lastError: status.lastError,
      },
    })

    return NextResponse.json({
      status: {
        running: status.running,
        uptime: status.uptime,
        activeConnections: status.activeConnections,
        version: status.version,
        lastError: status.lastError,
      },
      connections: connections.map((conn) => ({
        name: conn.name,
        localId: conn.localId,
        remoteId: conn.remoteId,
        localAddr: conn.localAddr,
        remoteAddr: conn.remoteAddr,
        state: conn.state,
        established: conn.established,
      })),
    })
  } catch (error) {
    console.error('Get VPN status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - VPN control actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, connectionName } = body

    let result

    switch (action) {
      case 'reload':
        result = await reloadStrongSwan()
        break

      case 'restart':
        result = await restartStrongSwan()
        break

      case 'terminate':
        if (!connectionName) {
          return NextResponse.json(
            { error: 'Connection name is required' },
            { status: 400 }
          )
        }
        result = await terminateConnection(connectionName)
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    // Log audit
    await db.auditLog.create({
      data: {
        action: action.toUpperCase() + '_VPN',
        category: 'VPN_INTEGRATION',
        actorType: 'ADMIN',
        targetType: 'VPN_SERVICE',
        details: JSON.stringify({ connectionName }),
        status: result.success ? 'SUCCESS' : 'FAILURE',
        errorMessage: result.success ? null : result.message,
      },
    })

    return NextResponse.json({
      success: result.success,
      message: result.message,
    })
  } catch (error) {
    console.error('VPN action error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
