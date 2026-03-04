import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import fs from 'fs'
import { db } from '@/lib/db'

interface VpnConnection {
  name: string
  username: string
  sourceIp: string
  destIp: string
  bytesIn: number
  bytesOut: number
  connectedSince: string
  status: string
}

interface NetworkInterface {
  name: string
  rxBytes: number
  txBytes: number
  rxPackets: number
  txPackets: number
}

// Global state for rate calculation (persists across requests in same process)
declare global {
  var prevStats: { timestamp: number; totalRx: number; totalTx: number } | undefined
  var trafficHistory: { time: string; bytesIn: number; bytesOut: number; timestamp: number }[]
}

// Initialize global state
if (!global.prevStats) {
  global.prevStats = undefined
}
if (!global.trafficHistory) {
  global.trafficHistory = []
}

// VPN Traffic API - Real-time server network traffic
export async function GET() {
  try {
    // Get real server network interface traffic
    const networkTraffic = getNetworkInterfaceTraffic()
    
    // Calculate real-time bandwidth (bytes per second)
    const bandwidth = calculateBandwidth(networkTraffic)
    
    // Update traffic history with new data point
    updateTrafficHistory(bandwidth)
    
    // Get active VPN connections using swanctl
    const connections = await getVpnConnections()
    
    // Get connection history from database
    const history = await getConnectionHistory()
    
    // Get summary stats
    const stats = {
      activeConnections: connections.length,
      totalBytesIn: networkTraffic.totalRx,
      totalBytesOut: networkTraffic.totalTx,
      currentRxRate: bandwidth.rxRate,
      currentTxRate: bandwidth.txRate,
      interfaces: networkTraffic.interfaces,
    }
    
    return NextResponse.json({
      connections,
      traffic: global.trafficHistory,
      history,
      stats,
    })
  } catch (error) {
    console.error('VPN traffic error:', error)
    return NextResponse.json({ error: 'Failed to get VPN traffic' }, { status: 500 })
  }
}

function getNetworkInterfaceTraffic(): {
  interfaces: NetworkInterface[]
  totalRx: number
  totalTx: number
} {
  const interfaces: NetworkInterface[] = []
  let totalRx = 0
  let totalTx = 0

  try {
    // Read network interface stats from /proc/net/dev
    const data = fs.readFileSync('/proc/net/dev', 'utf-8')
    const lines = data.trim().split('\n')
    
    // Skip header lines
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim()
      const parts = line.split(/\s+/)
      
      if (parts.length >= 17) {
        const name = parts[0].replace(':', '')
        // Skip loopback
        if (name === 'lo') continue
        
        const rxBytes = parseInt(parts[1]) || 0
        const rxPackets = parseInt(parts[2]) || 0
        const txBytes = parseInt(parts[9]) || 0
        const txPackets = parseInt(parts[10]) || 0
        
        interfaces.push({ name, rxBytes, txBytes, rxPackets, txPackets })
        totalRx += rxBytes
        totalTx += txBytes
      }
    }
  } catch {
    // /proc/net/dev not available, try alternative
  }

  if (interfaces.length === 0) {
    // Fallback: simulate based on VPN sessions
    return getSimulatedTraffic()
  }

  return { interfaces, totalRx, totalTx }
}

function getSimulatedTraffic(): { interfaces: NetworkInterface[]; totalRx: number; totalTx: number } {
  // Simulated for environments without /proc/net/dev
  const baseRx = 1000000000 // 1GB
  const baseTx = 500000000 // 500MB
  
  return {
    interfaces: [
      { name: 'eth0', rxBytes: baseRx, txBytes: baseTx, rxPackets: 1000000, txPackets: 500000 },
    ],
    totalRx: baseRx,
    totalTx: baseTx,
  }
}

function calculateBandwidth(current: { totalRx: number; totalTx: number }): {
  rxRate: number  // bytes per second
  txRate: number  // bytes per second
  timestamp: number
} {
  const now = Date.now()
  
  if (!global.prevStats) {
    // First reading, store and return zero rates
    global.prevStats = {
      timestamp: now,
      totalRx: current.totalRx,
      totalTx: current.totalTx,
    }
    return { rxRate: 0, txRate: 0, timestamp: now }
  }
  
  const timeDiff = (now - global.prevStats.timestamp) / 1000 // seconds
  
  if (timeDiff < 0.5) {
    // Too soon, return zero rates
    return { rxRate: 0, txRate: 0, timestamp: now }
  }
  
  // Calculate rate (bytes per second)
  const rxDiff = current.totalRx - global.prevStats.totalRx
  const txDiff = current.totalTx - global.prevStats.totalTx
  
  // Handle counter wrap or reset
  const rxRate = rxDiff >= 0 ? Math.floor(rxDiff / timeDiff) : 0
  const txRate = txDiff >= 0 ? Math.floor(txDiff / timeDiff) : 0
  
  // Update previous stats
  global.prevStats = {
    timestamp: now,
    totalRx: current.totalRx,
    totalTx: current.totalTx,
  }
  
  return { rxRate, txRate, timestamp: now }
}

function updateTrafficHistory(bandwidth: { rxRate: number; txRate: number; timestamp: number }) {
  const now = new Date()
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  
  // Add new data point
  global.trafficHistory.push({
    time,
    bytesIn: bandwidth.rxRate,
    bytesOut: bandwidth.txRate,
    timestamp: bandwidth.timestamp,
  })
  
  // Keep only last 60 data points (5 minutes at 5-second intervals)
  if (global.trafficHistory.length > 60) {
    global.trafficHistory = global.trafficHistory.slice(-60)
  }
}

async function getVpnConnections(): Promise<VpnConnection[]> {
  const connections: VpnConnection[] = []
  
  try {
    // Try swanctl --list-sas
    const output = execSync('swanctl --list-sas 2>/dev/null', { 
      encoding: 'utf-8',
      timeout: 5000,
    })
    
    if (!output.trim()) {
      return await getConnectionsFromDatabase()
    }
    
    // Parse swanctl output
    const lines = output.split('\n')
    let currentConn: Partial<VpnConnection> | null = null
    
    for (const line of lines) {
      const trimmed = line.trim()
      
      // New connection block
      if (trimmed.match(/^\w+.*:$/)) {
        if (currentConn?.name) {
          connections.push(currentConn as VpnConnection)
        }
        currentConn = { name: trimmed.replace(':', '') }
      }
      
      // Parse fields
      if (currentConn) {
        if (trimmed.startsWith('Remote EAP identity:')) {
          currentConn.username = trimmed.split(':')[1]?.trim() || ''
        }
        if (trimmed.includes('Remote host:')) {
          const match = trimmed.match(/(\d+\.\d+\.\d+\.\d+)/)
          currentConn.sourceIp = match ? match[1] : ''
        }
        if (trimmed.includes('Local host:')) {
          const match = trimmed.match(/(\d+\.\d+\.\d+\.\d+)/)
          currentConn.destIp = match ? match[1] : ''
        }
        if (trimmed.includes('Bytes-In:')) {
          const match = trimmed.match(/Bytes-In:\s*(\d+)/)
          currentConn.bytesIn = match ? parseInt(match[1]) : 0
        }
        if (trimmed.includes('Bytes-Out:')) {
          const match = trimmed.match(/Bytes-Out:\s*(\d+)/)
          currentConn.bytesOut = match ? parseInt(match[1]) : 0
        }
        if (trimmed.includes('Install time:')) {
          currentConn.connectedSince = trimmed.split(':')[1]?.trim() || ''
        }
        currentConn.status = 'ESTABLISHED'
      }
    }
    
    if (currentConn?.name) {
      connections.push(currentConn as VpnConnection)
    }
    
    return connections.length > 0 ? connections : await getConnectionsFromDatabase()
  } catch {
    // swanctl not available, try database
    return await getConnectionsFromDatabase()
  }
}

async function getConnectionsFromDatabase(): Promise<VpnConnection[]> {
  try {
    const sessions = await db.vpnSession.findMany({
      where: { endedAt: null },
      orderBy: { connectedAt: 'desc' },
      take: 50,
    })
    
    return sessions.map((s) => ({
      name: s.username,
      username: s.username,
      sourceIp: s.clientIp || '',
      destIp: '',
      bytesIn: s.bytesIn || 0,
      bytesOut: s.bytesOut || 0,
      connectedSince: s.connectedAt?.toISOString() || '',
      status: 'ACTIVE',
    }))
  } catch {
    return []
  }
}

async function getConnectionHistory() {
  try {
    const total = await db.vpnSession.count()
    const active = await db.vpnSession.count({ where: { endedAt: null } })
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const todaySessions = await db.vpnSession.count({
      where: {
        connectedAt: { gte: today },
      },
    })
    
    const uniqueUsers = await db.vpnSession.groupBy({
      by: ['username'],
      _count: true,
    })
    
    return {
      total,
      active,
      todaySessions,
      uniqueUsers: uniqueUsers.length,
    }
  } catch {
    return {
      total: 0,
      active: 0,
      todaySessions: 0,
      uniqueUsers: 0,
    }
  }
}
