import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

// GET - Fetch firewall status
export async function GET() {
  try {
    const status = await getFirewallStatus()
    return NextResponse.json(status)
  } catch (error) {
    console.error('Failed to get firewall status:', error)
    return NextResponse.json({
      enabled: false,
      installed: false,
      rules: [],
      stats: { sshBlocked: 0, appBlocked: 0, vpnBlocked: 0, scanBlocked: 0 },
      error: 'Failed to get firewall status',
    })
  }
}

async function getFirewallStatus() {
  let enabled = false
  let installed = false
  const rules: string[] = []
  const stats = { sshBlocked: 0, appBlocked: 0, vpnBlocked: 0, scanBlocked: 0 }

  try {
    // Check if nft command exists
    execSync('which nft', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
    
    // Check if our table exists
    const output = execSync('nft list table inet vpn_pki_filter 2>/dev/null', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    
    if (output) {
      installed = true
      enabled = true
      
      // Parse rules
      const lines = output.split('\n')
      lines.forEach(line => {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('table')) {
          rules.push(trimmed)
        }
      })
      
      // Try to get counter stats
      try {
        const meterOutput = execSync('nft list set inet vpn_pki_filter ssh_meter 2>/dev/null || echo ""', {
          encoding: 'utf-8',
        })
        stats.sshBlocked = (meterOutput.match(/elements/g) || []).length
      } catch {
        // Ignore
      }
    }
  } catch {
    // nft not available or table doesn't exist
    installed = false
    enabled = false
  }

  return {
    enabled,
    installed,
    rules,
    stats,
  }
}
