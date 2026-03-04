import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// GET - Get firewall status
export async function GET() {
  try {
    // Check if nftables/iptables is available
    let installed = false
    let enabled = false
    let rules: string[] = []

    try {
      // Check if nftables is installed
      await execAsync('which nft')
      installed = true

      // Check if firewall rules are active
      const { stdout } = await execAsync('sudo nft list ruleset 2>/dev/null || echo ""')
      if (stdout.trim()) {
        enabled = true
        rules = stdout.split('\n').filter(line => line.includes('vpn-pki'))
      }
    } catch {
      // nftables not available, check iptables
      try {
        await execAsync('which iptables')
        installed = true
        
        const { stdout } = await execAsync('sudo iptables -L -n 2>/dev/null || echo ""')
        if (stdout.includes('VPN-PKI')) {
          enabled = true
          rules = ['iptables rules configured']
        }
      } catch {
        installed = false
      }
    }

    // Get saved config
    const config = await db.systemSetting.findFirst({
      where: { key: 'firewall-config' },
    })

    return NextResponse.json({
      installed,
      enabled,
      rules,
      stats: {
        sshBlocked: 0,
        appBlocked: 0,
        vpnBlocked: 0,
        scanBlocked: 0,
      },
      config: config ? JSON.parse(config.value) : {
        sshPort: '22',
        appPort: '3000',
        sshRate: '4',
        appRate: '150',
        vpnRate: '100',
      },
    })
  } catch (error) {
    console.error('Failed to get firewall status:', error)
    return NextResponse.json({
      installed: false,
      enabled: false,
      rules: [],
      stats: {
        sshBlocked: 0,
        appBlocked: 0,
        vpnBlocked: 0,
        scanBlocked: 0,
      },
    })
  }
}

// POST - Save firewall configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sshPort, appPort, sshRate, appRate, vpnRate } = body

    // Save configuration
    await db.systemSetting.upsert({
      where: { key: 'firewall-config' },
      create: {
        key: 'firewall-config',
        value: JSON.stringify({ sshPort, appPort, sshRate, appRate, vpnRate }),
        category: 'firewall',
        description: 'Firewall configuration settings',
      },
      update: {
        value: JSON.stringify({ sshPort, appPort, sshRate, appRate, vpnRate }),
      },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'UPDATE_FIREWALL_CONFIG',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'SystemSetting',
        details: JSON.stringify({ sshPort, appPort }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save firewall config:', error)
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    )
  }
}
