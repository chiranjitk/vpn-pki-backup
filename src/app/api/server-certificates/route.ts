import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import {
  getPKIPaths,
  ensurePKIDirectories,
} from '@/lib/pki/config'
import { 
  ensureStrongSwanDirs, 
  deployServerCertificate as deployToStrongSwan,
  reloadStrongSwan,
  STRONGSWAN_PATHS,
} from '@/lib/pki/strongswan'

/**
 * Server Certificate Generation API
 * Uses strongSwan pki tool for certificate operations
 * 
 * Flow:
 * 1. Generate private key: pki --gen --type rsa --size 4096
 * 2. Extract public key: pki --pub --in <key>
 * 3. Issue certificate: pki --issue --cacert <ca> --cakey <cakey> --dn <dn> --san <san> --flag serverAuth
 */

// GET - List all server certificates
export async function GET() {
  try {
    const certificates = await db.serverCertificate.findMany({
      orderBy: { createdAt: 'desc' },
    })

    // Get available CAs for selection
    const cas = await db.certificateAuthority.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        subject: true,
        isDefault: true,
        isExternal: true,
      },
    })

    // Get stats
    const stats = await db.serverCertificate.groupBy({
      by: ['status'],
      _count: true,
    })

    return NextResponse.json({
      certificates: certificates.map((cert) => ({
        id: cert.id,
        hostname: cert.hostname,
        commonName: cert.commonName,
        subject: cert.subject,
        issuer: cert.issuer,
        serialNumber: cert.serialNumber,
        issueDate: cert.issueDate,
        expiryDate: cert.expiryDate,
        status: cert.status,
        isDeployed: cert.isDeployed,
        deployedAt: cert.deployedAt,
        createdAt: cert.createdAt,
      })),
      cas: cas,
      stats: {
        total: certificates.length,
        active: stats.find(s => s.status === 'ACTIVE')?._count || 0,
        expired: stats.find(s => s.status === 'EXPIRED')?._count || 0,
        deployed: certificates.filter(c => c.isDeployed).length,
      },
    })
  } catch (error) {
    console.error('Get server certificates error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Generate a new server certificate
export async function POST(request: NextRequest) {
  try {
    // Check if pki tool is available
    try {
      execSync('which pki', { encoding: 'utf-8' })
    } catch {
      return NextResponse.json(
        { error: 'strongSwan pki tool is not available. Please install strongswan-pki package.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { 
      hostname, 
      commonName,
      caId,           // CA to use for signing
      validityDays = 730,
      keySize = 4096,
      sanDomains = [],
      sanIPs = [],
      deploy = false,
    } = body

    if (!hostname && !commonName) {
      return NextResponse.json(
        { error: 'Hostname or Common Name is required' },
        { status: 400 }
      )
    }

    const cn = commonName || hostname

    // Get specified CA or default
    let ca
    if (caId) {
      ca = await db.certificateAuthority.findUnique({
        where: { id: caId, status: 'ACTIVE' },
      })
    } else {
      ca = await db.certificateAuthority.findFirst({
        where: {
          isDefault: true,
          status: 'ACTIVE',
        },
      })
    }

    if (!ca || !ca.keyPath || !ca.certificatePath) {
      return NextResponse.json(
        { error: 'No active Certificate Authority found. Please initialize CA first in PKI Management.' },
        { status: 400 }
      )
    }

    // For external CA, we can't sign certificates (MODE A)
    if (ca.isExternal) {
      return NextResponse.json(
        { error: 'Cannot sign certificates with External CA. Use External CA mode to generate CSR instead.' },
        { status: 400 }
      )
    }

    // Ensure CA files exist
    if (!fs.existsSync(ca.keyPath) || !fs.existsSync(ca.certificatePath)) {
      return NextResponse.json(
        { error: 'CA files not found. Please check CA configuration.' },
        { status: 400 }
      )
    }

    // Ensure directories exist
    ensurePKIDirectories()
    ensureStrongSwanDirs()

    const paths = getPKIPaths()

    // Generate unique filename
    const certName = `${cn.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`
    const keyPath = path.join(STRONGSWAN_PATHS.privateDir, `${certName}.key`)
    const certPath = path.join(STRONGSWAN_PATHS.x509Dir, `${certName}.pem`)

    // Get PKI configuration
    const config = await db.pkiConfiguration.findFirst()
    const days = validityDays || config?.defaultServerValidityDays || 730
    const size = keySize || config?.minKeySize || 4096

    console.log(`[PKI] Generating server certificate for: ${cn}`)
    console.log(`[PKI] Using CA: ${ca.name} (${ca.subject})`)

    // Step 1: Generate private key using pki tool
    // pki --gen --type rsa --size 4096 --outform pem > key.pem
    console.log('[PKI] Step 1: Generating private key...')
    execSync(
      `pki --gen --type rsa --size ${size} --outform pem`,
      { encoding: 'utf-8', stdio: ['pipe', fs.openSync(keyPath, 'w'), 'pipe'] }
    )
    fs.chmodSync(keyPath, 0o600)
    console.log(`[PKI] Private key saved to: ${keyPath}`)

    // Step 2: Extract public key and issue certificate in one go
    // pki --pub --in key.pem | pki --issue --cacert ca.pem --cakey ca-key.pem --dn "CN=xxx" --san xxx --flag serverAuth --lifetime 1826
    console.log('[PKI] Step 2: Generating and signing certificate...')
    
    // Build DN
    let dn = `CN=${cn}`
    
    // Build SAN arguments
    const sanArgs: string[] = []
    sanArgs.push(`--san ${cn}`)  // Primary CN as SAN
    for (const domain of sanDomains) {
      sanArgs.push(`--san ${domain}`)
    }
    for (const ip of sanIPs) {
      sanArgs.push(`--san ${ip}`)
    }

    // Issue certificate using pki tool
    const issueCmd = `pki --pub --in ${keyPath} | pki --issue ` +
      `--cacert ${ca.certificatePath} ` +
      `--cakey ${ca.keyPath} ` +
      `--dn "${dn}" ` +
      `${sanArgs.join(' ')} ` +
      `--flag serverAuth ` +
      `--lifetime ${days} ` +
      `--outform pem`
    
    console.log(`[PKI] Running: ${issueCmd}`)
    
    try {
      const certOutput = execSync(issueCmd, { encoding: 'utf-8' })
      fs.writeFileSync(certPath, certOutput, { mode: 0o644 })
      console.log(`[PKI] Certificate saved to: ${certPath}`)
    } catch (issueError) {
      console.error('[PKI] Certificate issuance failed:', issueError)
      throw new Error(`Failed to issue certificate: ${issueError}`)
    }

    // Get certificate details
    let certInfo: { subject: string; issuer: string; serialNumber: string; notBefore: Date; notAfter: Date }
    try {
      const printOutput = execSync(`pki --print --in ${certPath}`, { encoding: 'utf-8' })
      
      // Parse the output
      const subjectMatch = printOutput.match(/subject:\s*"([^"]+)"/)
      const issuerMatch = printOutput.match(/issuer:\s*"([^"]+)"/)
      const serialMatch = printOutput.match(/serial:\s*([a-fA-F0-9:]+)/)
      const notBeforeMatch = printOutput.match(/not before\s*([^,]+),/)
      const notAfterMatch = printOutput.match(/not after\s*([^,]+),/)
      
      certInfo = {
        subject: subjectMatch ? subjectMatch[1] : dn,
        issuer: issuerMatch ? issuerMatch[1] : ca.subject || '',
        serialNumber: serialMatch ? serialMatch[1].replace(/:/g, '') : '',
        notBefore: notBeforeMatch ? new Date(notBeforeMatch[1].trim()) : new Date(),
        notAfter: notAfterMatch ? new Date(notAfterMatch[1].trim()) : new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      }
      
      console.log('[PKI] Certificate info:', certInfo)
    } catch (printError) {
      console.error('[PKI] Failed to parse certificate:', printError)
      // Use fallback values
      certInfo = {
        subject: dn,
        issuer: ca.subject || '',
        serialNumber: '',
        notBefore: new Date(),
        notAfter: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      }
    }

    // Create certificate record in database
    const certificate = await db.serverCertificate.create({
      data: {
        hostname: hostname || cn,
        commonName: cn,
        subject: certInfo.subject,
        issuer: certInfo.issuer,
        serialNumber: certInfo.serialNumber || `server_${Date.now()}`,
        issueDate: certInfo.notBefore,
        expiryDate: certInfo.notAfter,
        status: 'ACTIVE',
        certificatePath: certPath,
        keyPath: keyPath,
        isDeployed: false,
      },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'GENERATE_SERVER_CERTIFICATE',
        category: 'CERTIFICATE_OPERATIONS',
        actorType: 'ADMIN',
        targetId: certificate.id,
        targetType: 'ServerCertificate',
        details: JSON.stringify({
          hostname: cn,
          caId: ca.id,
          caName: ca.name,
          serialNumber: certInfo.serialNumber,
          validityDays: days,
          keySize: size,
          san: [...sanDomains, ...sanIPs],
        }),
        status: 'SUCCESS',
      },
    })

    // Deploy if requested
    if (deploy) {
      try {
        // Deploy to strongSwan standard locations
        const deployResult = deployToStrongSwan(certPath, keyPath, 'vpn-server')
        
        if (deployResult.success) {
          await db.serverCertificate.update({
            where: { id: certificate.id },
            data: { isDeployed: true, deployedAt: new Date() },
          })

          // Reload strongSwan
          if (config?.autoReloadStrongswan) {
            await reloadStrongSwan()
          }

          await db.auditLog.create({
            data: {
              action: 'DEPLOY_SERVER_CERTIFICATE',
              category: 'VPN_INTEGRATION',
              actorType: 'ADMIN',
              targetId: certificate.id,
              targetType: 'ServerCertificate',
              details: JSON.stringify({ 
                hostname: cn,
                deployedTo: deployResult.certDest 
              }),
              status: 'SUCCESS',
            },
          })
          
          console.log(`[PKI] Server certificate deployed successfully`)
        }
      } catch (deployError) {
        console.error('[PKI] Failed to deploy server certificate:', deployError)
      }
    }

    return NextResponse.json({
      success: true,
      certificate: {
        id: certificate.id,
        serialNumber: certificate.serialNumber,
        commonName: certificate.commonName,
        subject: certificate.subject,
        issuer: certificate.issuer,
        issueDate: certificate.issueDate,
        expiryDate: certificate.expiryDate,
        status: certificate.status,
        isDeployed: certificate.isDeployed,
      },
      paths: {
        key: keyPath,
        cert: certPath,
      },
      download: {
        pem: `/api/server-certificates/${certificate.id}/download?format=pem`,
        key: `/api/server-certificates/${certificate.id}/download?format=key`,
      },
    })
  } catch (error) {
    console.error('Generate server certificate error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
