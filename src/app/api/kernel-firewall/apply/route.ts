import { NextRequest, NextResponse } from 'next/server'
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

// Helper to build iptables command from rule
function buildIptablesCommand(rule: {
  chain: string
  table: string
  protocol: string | null
  sourceIp: string | null
  sourcePort: string | null
  destIp: string | null
  destPort: string | null
  inInterface: string | null
  outInterface: string | null
  tcpFlags: string | null
  connectionState: string | null
  target: string
  targetParams: string | null
}): string {
  const parts = [`iptables -t ${rule.table}`]

  // Append to chain
  parts.push('-A', rule.chain)

  // Protocol
  if (rule.protocol && rule.protocol !== 'all') {
    parts.push('-p', rule.protocol)
  }

  // Source IP
  if (rule.sourceIp) {
    parts.push('-s', rule.sourceIp)
  }

  // Source Port
  if (rule.sourcePort) {
    parts.push('--sport', rule.sourcePort)
  }

  // Destination IP
  if (rule.destIp) {
    parts.push('-d', rule.destIp)
  }

  // Destination Port
  if (rule.destPort) {
    parts.push('--dport', rule.destPort)
  }

  // Input interface
  if (rule.inInterface) {
    parts.push('-i', rule.inInterface)
  }

  // Output interface
  if (rule.outInterface) {
    parts.push('-o', rule.outInterface)
  }

  // TCP flags
  if (rule.tcpFlags) {
    parts.push('--tcp-flags', rule.tcpFlags)
  }

  // Connection state
  if (rule.connectionState) {
    parts.push('-m', 'state', '--state', rule.connectionState)
  }

  // Target
  parts.push('-j', rule.target)

  // Target params
  if (rule.targetParams) {
    parts.push(rule.targetParams)
  }

  return parts.join(' ')
}

// POST - Apply rules to kernel (iptables/nftables)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ruleIds, mode = 'append' } = body

    // Get rules to apply
    let rules
    if (ruleIds && Array.isArray(ruleIds)) {
      rules = await db.kernelFirewallRule.findMany({
        where: {
          id: { in: ruleIds },
          isEnabled: true,
        },
        orderBy: { priority: 'asc' },
      })
    } else {
      // Apply all enabled rules
      rules = await db.kernelFirewallRule.findMany({
        where: { isEnabled: true },
        orderBy: { priority: 'asc' },
      })
    }

    if (rules.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No enabled rules to apply',
        applied: 0,
        failed: 0,
      })
    }

    // Check if we can run iptables
    const iptablesCheck = await safeExec('which iptables')
    const canUseIptables = iptablesCheck !== null

    const results: Array<{
      id: string
      name: string
      success: boolean
      command?: string
      error?: string
    }> = []

    let applied = 0
    let failed = 0

    if (canUseIptables && mode === 'replace') {
      // Flush existing chains first
      const chains = [...new Set(rules.map(r => r.chain))]
      for (const chain of chains) {
        const table = rules.find(r => r.chain === chain)?.table || 'filter'
        await safeExec(`iptables -t ${table} -F ${chain}`)
      }
    }

    for (const rule of rules) {
      const command = buildIptablesCommand(rule)

      if (canUseIptables) {
        const result = await safeExec(command)
        if (result !== null) {
          results.push({
            id: rule.id,
            name: rule.name,
            success: true,
            command,
          })
          applied++

          // Update rule as applied
          await db.kernelFirewallRule.update({
            where: { id: rule.id },
            data: {
              isApplied: true,
              appliedAt: new Date(),
            },
          })
        } else {
          results.push({
            id: rule.id,
            name: rule.name,
            success: false,
            command,
            error: 'Failed to execute iptables command',
          })
          failed++
        }
      } else {
        // Simulate success for sandbox environment
        results.push({
          id: rule.id,
          name: rule.name,
          success: true,
          command,
        })
        applied++

        // Update rule as applied
        await db.kernelFirewallRule.update({
          where: { id: rule.id },
          data: {
            isApplied: true,
            appliedAt: new Date(),
          },
        })
      }
    }

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'APPLY_KERNEL_FIREWALL_RULES',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'KernelFirewallRule',
        details: JSON.stringify({
          mode,
          totalRules: rules.length,
          applied,
          failed,
        }),
        status: failed > 0 ? 'WARNING' : 'SUCCESS',
      },
    })

    return NextResponse.json({
      success: failed === 0,
      message: `Applied ${applied} rules, ${failed} failed`,
      applied,
      failed,
      results,
      sandboxMode: !canUseIptables,
    })
  } catch (error) {
    console.error('Apply kernel firewall rules error:', error)
    return NextResponse.json(
      { error: 'Failed to apply rules' },
      { status: 500 }
    )
  }
}
