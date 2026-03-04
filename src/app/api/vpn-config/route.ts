import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { 
  writeSwanctlConf, 
  ensureStrongSwanDirs,
  STRONGSWAN_PATHS 
} from '@/lib/pki/strongswan'
import * as fs from 'fs'
import * as path from 'path'

// GET - Get VPN configuration
export async function GET() {
  try {
    let config = await db.vpnConfiguration.findFirst()
    
    // Create default config if not exists
    if (!config) {
      config = await db.vpnConfiguration.create({
        data: {}
      })
    }
    
    // Get additional info
    const ca = await db.certificateAuthority.findFirst({
      where: { isDefault: true, status: 'ACTIVE' }
    })
    
    const serverCerts = await db.serverCertificate.findMany({
      where: { status: 'ACTIVE', isDeployed: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    
    return NextResponse.json({ 
      config,
      ca: ca ? {
        id: ca.id,
        name: ca.name,
        subject: ca.subject,
      } : null,
      serverCertificates: serverCerts,
    })
  } catch (error) {
    console.error('Get VPN config error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update VPN configuration
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    
    let config = await db.vpnConfiguration.findFirst()
    
    if (!config) {
      config = await db.vpnConfiguration.create({
        data: body
      })
    } else {
      config = await db.vpnConfiguration.update({
        where: { id: config.id },
        data: body
      })
    }
    
    // Log audit
    await db.auditLog.create({
      data: {
        action: 'UPDATE_VPN_CONFIG',
        category: 'VPN_INTEGRATION',
        actorType: 'ADMIN',
        targetType: 'VpnConfiguration',
        details: JSON.stringify(body),
        status: 'SUCCESS',
      },
    })
    
    return NextResponse.json({ config })
  } catch (error) {
    console.error('Update VPN config error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Generate and apply swanctl.conf
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body
    
    if (action === 'apply') {
      const config = await db.vpnConfiguration.findFirst()
      
      if (!config) {
        return NextResponse.json(
          { error: 'VPN configuration not found' },
          { status: 404 }
        )
      }
      
      // Get CA info
      const ca = await db.certificateAuthority.findFirst({
        where: { isDefault: true, status: 'ACTIVE' }
      })
      
      // Get active server certificate
      const serverCert = await db.serverCertificate.findFirst({
        where: { status: 'ACTIVE', isDeployed: true },
        orderBy: { createdAt: 'desc' }
      })
      
      // Generate swanctl.conf content
      const swanctlContent = generateSwanctlConf(config, ca, serverCert)
      
      // Ensure directories exist
      ensureStrongSwanDirs()
      
      // Write to file
      writeSwanctlConf(swanctlContent)
      
      // Log audit
      await db.auditLog.create({
        data: {
          action: 'APPLY_VPN_CONFIG',
          category: 'VPN_INTEGRATION',
          actorType: 'ADMIN',
          targetType: 'VpnConfiguration',
          details: 'Generated and applied swanctl.conf',
          status: 'SUCCESS',
        },
      })
      
      return NextResponse.json({ 
        success: true, 
        message: 'Configuration applied successfully',
        content: swanctlContent 
      })
    }
    
    if (action === 'preview') {
      const config = await db.vpnConfiguration.findFirst()
      
      if (!config) {
        return NextResponse.json(
          { error: 'VPN configuration not found' },
          { status: 404 }
        )
      }
      
      const ca = await db.certificateAuthority.findFirst({
        where: { isDefault: true, status: 'ACTIVE' }
      })
      
      const serverCert = await db.serverCertificate.findFirst({
        where: { status: 'ACTIVE', isDeployed: true },
        orderBy: { createdAt: 'desc' }
      })
      
      const swanctlContent = generateSwanctlConf(config, ca, serverCert)
      
      return NextResponse.json({ content: swanctlContent })
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Apply VPN config error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Generate swanctl.conf content for IKEv2 EAP-TLS
 * 
 * IMPORTANT: For strongSwan 6.0.1 IKEv2 with certificate authentication:
 * - CA certificates go in /etc/swanctl/x509ca/
 * - Server certificate goes in /etc/swanctl/x509/
 * - Private keys go in /etc/swanctl/private/
 * - CRL goes in /etc/swanctl/x509crl/
 */
function generateSwanctlConf(config: any, ca: any, serverCert: any): string {
  const lines: string[] = []
  
  lines.push('# swanctl.conf - Generated by 24online VPN PKI Management Platform')
  lines.push('# For strongSwan 6.0.1 with IKEv2 Certificate Authentication')
  lines.push(`# Generated at: ${new Date().toISOString()}`)
  lines.push('')
  
  // Determine server certificate file
  const serverCertFile = serverCert?.certificatePath 
    ? path.basename(serverCert.certificatePath)
    : config.localCert || 'vpn-server.pem'
  
  const serverKeyFile = serverCert?.keyPath
    ? path.basename(serverCert.keyPath)
    : serverCertFile.replace('.pem', '.key')
  
  // Connections section
  lines.push('connections {')
  lines.push('')
  lines.push(`  ${config.connectionName} {`)
  lines.push('')
  
  // Version - IKEv2
  lines.push(`    version = ${config.ikeVersion}`)
  lines.push('')
  
  // IKE Proposals
  lines.push(`    proposals = ${config.ikeProposals}`)
  lines.push('')
  
  // Additional options
  lines.push(`    mobike = ${config.mobike ? 'yes' : 'no'}`)
  lines.push(`    reauth_time = ${config.reauthTime || 0}`)
  lines.push(`    fragmentation = ${config.fragmentation ? 'yes' : 'no'}`)
  lines.push('')
  
  // Server hostnames if configured
  if (config.serverHostnames) {
    lines.push(`    local_addrs = ${config.serverHostnames}`)
    lines.push('')
  }
  
  // Local section (server side)
  lines.push('    local {')
  lines.push('      auth = pubkey')
  lines.push(`      certs = ${serverCertFile}`)
  lines.push(`      id = @${config.localId || serverCert?.commonName || 'vpn.server'}`)
  lines.push('    }')
  lines.push('')
  
  // Remote section (client side)
  lines.push('    remote {')
  lines.push('      auth = pubkey')
  // Reference the CA certificate for client verification
  // The CA must be in /etc/swanctl/x509ca/
  if (ca?.certificatePath) {
    const caCertFile = path.basename(ca.certificatePath)
    lines.push(`      cacerts = ${caCertFile}`)
  }
  lines.push('      id = %any')
  lines.push('    }')
  lines.push('')
  
  // Children section (IPsec tunnels)
  lines.push('    children {')
  lines.push('      net {')
  lines.push(`        local_ts = ${config.localTrafficSelector || '0.0.0.0/0'}`)
  lines.push(`        remote_ts = dynamic`)
  lines.push(`        esp_proposals = ${config.espProposals}`)
  lines.push('        mode = tunnel')
  lines.push(`        start_action = ${config.startAction || 'none'}`)
  lines.push('        dpd_action = restart')
  lines.push('        close_action = none')
  lines.push('      }')
  lines.push('    }')
  lines.push('')
  
  // Pools
  lines.push(`    pools = ${config.poolName}`)
  lines.push('')
  
  lines.push('  }')
  lines.push('')
  lines.push('}')
  lines.push('')
  
  // Pools section
  lines.push('pools {')
  lines.push(`  ${config.poolName} {`)
  lines.push(`    addrs = ${config.poolAddressRange}`)
  lines.push(`    dns = ${config.dnsServers}`)
  lines.push('  }')
  lines.push('}')
  lines.push('')

  // Secrets section
  lines.push('secrets {')
  lines.push('  private-server {')
  lines.push(`    file = ${serverKeyFile}`)
  lines.push('  }')
  lines.push('}')
  
  return lines.join('\n')
}
