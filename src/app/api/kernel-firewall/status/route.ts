import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Helper function to safely execute commands
async function safeExec(command: string): Promise<{ stdout: string; stderr: string } | null> {
  try {
    return await execAsync(command, { timeout: 10000 })
  } catch {
    return null
  }
}

// GET - Check firewall status
export async function GET() {
  try {
    // Get database stats
    const totalRules = await db.kernelFirewallRule.count()
    const enabledRules = await db.kernelFirewallRule.count({ where: { isEnabled: true } })
    const appliedRules = await db.kernelFirewallRule.count({ where: { isApplied: true } })
    const systemRules = await db.kernelFirewallRule.count({ where: { isSystemRule: true } })

    const stats = await db.kernelFirewallRule.aggregate({
      _sum: { packetsMatched: true, bytesMatched: true },
    })

    // Check iptables status
    const iptablesCheck = await safeExec('which iptables')
    const hasIptables = iptablesCheck !== null

    let iptablesStatus = 'unknown'
    let chainStatus: Record<string, { policy: string; rules: number }> = {}
    let nftablesStatus = 'unknown'

    if (hasIptables) {
      // Check if iptables is running
      const filterOutput = await safeExec('iptables -t filter -L -n')
      if (filterOutput) {
        iptablesStatus = 'active'

        // Parse chain status
        const lines = filterOutput.stdout.split('\n')
        let currentChain = ''

        for (const line of lines) {
          if (line.startsWith('Chain ')) {
            const match = line.match(/Chain (\w+) \(policy (\w+)\)/)
            if (match) {
              currentChain = match[1]
              chainStatus[currentChain] = {
                policy: match[2],
                rules: 0,
              }
            }
          } else if (currentChain && line.trim() && !line.startsWith('target')) {
            if (chainStatus[currentChain]) {
              chainStatus[currentChain].rules++
            }
          }
        }
      } else {
        iptablesStatus = 'inactive'
      }

      // Check nftables
      const nftCheck = await safeExec('which nft')
      if (nftCheck) {
        const nftOutput = await safeExec('nft list ruleset')
        nftablesStatus = nftOutput ? 'active' : 'inactive'
      }
    }

    // Get rules by chain
    const rulesByChain = await db.kernelFirewallRule.groupBy({
      by: ['chain'],
      _count: true,
      where: { isEnabled: true },
    })

    // Get rules by table
    const rulesByTable = await db.kernelFirewallRule.groupBy({
      by: ['table'],
      _count: true,
      where: { isEnabled: true },
    })

    // Get last applied rule
    const lastApplied = await db.kernelFirewallRule.findFirst({
      where: { isApplied: true },
      orderBy: { appliedAt: 'desc' },
      select: {
        name: true,
        appliedAt: true,
      },
    })

    return NextResponse.json({
      firewall: {
        iptables: iptablesStatus,
        nftables: nftablesStatus,
        hasIptables,
        chainStatus,
      },
      database: {
        totalRules,
        enabledRules,
        appliedRules,
        unappliedRules: enabledRules - appliedRules,
        systemRules,
        totalPacketsMatched: stats._sum.packetsMatched || 0,
        totalBytesMatched: stats._sum.bytesMatched || 0,
      },
      breakdown: {
        byChain: rulesByChain.map(r => ({ chain: r.chain, count: r._count })),
        byTable: rulesByTable.map(r => ({ table: r.table, count: r._count })),
      },
      lastApplied,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Get kernel firewall status error:', error)
    return NextResponse.json({
      firewall: {
        iptables: 'unknown',
        nftables: 'unknown',
        hasIptables: false,
        chainStatus: {},
      },
      database: {
        totalRules: 0,
        enabledRules: 0,
        appliedRules: 0,
        unappliedRules: 0,
        systemRules: 0,
        totalPacketsMatched: 0,
        totalBytesMatched: 0,
      },
      breakdown: {
        byChain: [],
        byTable: [],
      },
      lastApplied: null,
      timestamp: new Date().toISOString(),
      error: 'Failed to get status',
    })
  }
}
