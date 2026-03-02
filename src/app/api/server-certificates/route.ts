import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as fs from 'fs'
import * as path from 'path'
import {
  generateServerCertificate,
  parseCertificate,
  getCertificateSerial,
  isOpenSSLAvailable,
  generateCSR,
} from '@/lib/pki/openssl'
import {
  getPKIPaths,
  ensurePKIDirectories,
} from '@/lib/pki/config'
import { reloadStrongSwan } from '@/lib/pki/strongswan'

// GET - List all server certificates
export async function GET() {
  try {
    const certificates = await db.serverCertificate.findMany({
      orderBy: { createdAt: 'desc' },
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
    if (!isOpenSSLAvailable()) {
      return NextResponse.json(
        { error: 'OpenSSL is not available on this server' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { 
      hostname, 
      commonName,
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

    // Get PKI configuration
    const config = await db.pkiConfiguration.findFirst()
    const days = validityDays || config?.defaultServerValidityDays || 730
    const size = keySize || config?.minKeySize || 4096

    // Get PKI paths
    const paths = getPKIPaths()

    // Get CA (managed mode)
    const ca = await db.certificateAuthority.findFirst({
      where: {
        isDefault: true,
        status: 'ACTIVE',
        isExternal: false,
      },
    })

    if (!ca || !ca.keyPath || !ca.certificatePath) {
      return NextResponse.json(
        { error: 'No active Certificate Authority found. Please initialize CA first in PKI Management.' },
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

    // Generate unique filename
    const certName = `server_${cn.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`
    const keyPath = path.join(paths.clientKeysPath, `${certName}.key`)
    const certPath = path.join(paths.clientCertsPath, `${certName}.pem`)

    // Build SAN list
    const sanList: string[] = []
    if (cn) sanList.push(`DNS:${cn}`)
    for (const domain of sanDomains) {
      sanList.push(`DNS:${domain}`)
    }
    for (const ip of sanIPs) {
      sanList.push(`IP:${ip}`)
    }

    // Generate server certificate
    await generateServerCertificate(
      ca.keyPath,
      ca.certificatePath,
      keyPath,
      certPath,
      {
        commonName: cn,
        keySize: size,
        validityDays: days,
        san: sanList.length > 0 ? sanList : undefined,
      }
    )

    // Get certificate details
    const certInfo = await parseCertificate(certPath)
    const serialNumber = await getCertificateSerial(certPath)

    // Create certificate record in database
    const certificate = await db.serverCertificate.create({
      data: {
        hostname: hostname || cn,
        commonName: cn,
        subject: certInfo.subject,
        issuer: certInfo.issuer,
        serialNumber,
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
          serialNumber,
          validityDays: days,
          keySize: size,
          san: sanList,
        }),
        status: 'SUCCESS',
      },
    })

    // Deploy if requested
    if (deploy) {
      try {
        const destCert = path.join(paths.clientCertsPath, 'vpn-server.pem')
        const destKey = path.join(paths.clientKeysPath, 'vpn-server.key')
        
        fs.copyFileSync(certPath, destCert)
        fs.copyFileSync(keyPath, destKey)
        
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
            details: JSON.stringify({ hostname: cn }),
            status: 'SUCCESS',
          },
        })
      } catch (deployError) {
        console.error('Failed to deploy server certificate:', deployError)
      }
    }

    return NextResponse.json({
      certificate: {
        id: certificate.id,
        serialNumber: certificate.serialNumber,
        commonName: certificate.commonName,
        issueDate: certificate.issueDate,
        expiryDate: certificate.expiryDate,
        status: certificate.status,
        isDeployed: certificate.isDeployed,
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
