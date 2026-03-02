import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as fs from 'fs'
import * as path from 'path'
import {
  generateClientCertificate,
  createPKCS12,
  parseCertificate,
  getCertificateSerial,
  isOpenSSLAvailable,
} from '@/lib/pki/openssl'
import {
  getPKIPaths,
  ensurePKIDirectories,
  initializeCADatabase,
  createCAConfig,
} from '@/lib/pki/config'
import { deployCRL, reloadStrongSwan } from '@/lib/pki/strongswan'
import { randomBytes } from 'crypto'

// GET - List all certificates or download user certificates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const userId = searchParams.get('userId')
    const search = searchParams.get('search')
    const download = searchParams.get('download')

    // Handle download mode for user certificates
    if (download && userId) {
      const certificate = await db.certificate.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
        },
        include: {
          user: {
            select: { username: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      if (!certificate) {
        return NextResponse.json(
          { error: 'No active certificate found for this user' },
          { status: 404 }
        )
      }

      if (!certificate.certificatePath || !fs.existsSync(certificate.certificatePath)) {
        return NextResponse.json(
          { error: 'Certificate file not found' },
          { status: 404 }
        )
      }

      const fileContent = fs.readFileSync(certificate.certificatePath)
      const filename = `${certificate.user.username}.pem`

      // Log download
      await db.auditLog.create({
        data: {
          action: 'DOWNLOAD_CERTIFICATE',
          category: 'CERTIFICATE_OPERATIONS',
          actorType: 'ADMIN',
          targetId: certificate.id,
          targetType: 'Certificate',
          details: JSON.stringify({ serialNumber: certificate.serialNumber, format: 'pem' }),
          status: 'SUCCESS',
        },
      })

      return new NextResponse(fileContent, {
        headers: {
          'Content-Type': 'application/x-pem-file',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': fileContent.length.toString(),
        },
      })
    }

    const where: any = {}

    if (status !== 'all') {
      where.status = status
    }

    if (userId) {
      where.userId = userId
    }

    if (search) {
      where.OR = [
        { serialNumber: { contains: search } },
        { commonName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const certificates = await db.certificate.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
          },
        },
        revocation: {
          select: {
            id: true,
            reason: true,
            revokedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Get stats
    const stats = await db.certificate.groupBy({
      by: ['status'],
      _count: true,
    })

    return NextResponse.json({
      certificates: certificates.map((cert) => ({
        id: cert.id,
        serialNumber: cert.serialNumber,
        commonName: cert.commonName,
        subject: cert.subject,
        issuer: cert.issuer,
        issueDate: cert.issueDate,
        expiryDate: cert.expiryDate,
        status: cert.status,
        keySize: cert.keySize,
        signatureAlgorithm: cert.signatureAlgorithm,
        certificateType: cert.certificateType,
        pfxPassword: cert.pfxPassword,
        user: cert.user,
        revocation: cert.revocation,
        createdAt: cert.createdAt,
      })),
      stats: {
        total: certificates.length,
        active: stats.find(s => s.status === 'ACTIVE')?._count || 0,
        expired: stats.find(s => s.status === 'EXPIRED')?._count || 0,
        revoked: stats.find(s => s.status === 'REVOKED')?._count || 0,
        pending: stats.find(s => s.status === 'PENDING')?._count || 0,
      },
    })
  } catch (error) {
    console.error('Get certificates error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Generate a new certificate
export async function POST(request: NextRequest) {
  try {
    // Check if OpenSSL is available
    if (!isOpenSSLAvailable()) {
      return NextResponse.json(
        { error: 'OpenSSL is not available on this server' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { userId, validityDays, keySize, generatePfx, pfxPassword } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get user
    const user = await db.vpnUser.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get PKI configuration
    const config = await db.pkiConfiguration.findFirst()
    const days = validityDays || config?.defaultClientValidityDays || 365
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

    // Generate unique filename using username and timestamp
    const certName = `${user.username}_${Date.now()}`
    const keyPath = path.join(paths.clientKeysPath, `${certName}.key`)
    const certPath = path.join(paths.clientCertsPath, `${certName}.pem`)
    const pfxPath = path.join(paths.clientPkcs12Path, `${certName}.p12`)

    // Generate certificate
    // IMPORTANT: Common Name (CN) should be user's name or username, NOT email
    // Email goes in the emailAddress field for proper X.509 certificate structure
    const commonName = user.fullName || user.username
    
    await generateClientCertificate(
      ca.keyPath,
      ca.certificatePath,
      keyPath,
      certPath,
      {
        commonName: commonName,
        emailAddress: user.email || '',
        organization: '24online VPN',
        keySize: size,
        validityDays: days,
      }
    )

    // Get certificate details
    const certInfo = await parseCertificate(certPath)
    const serialNumber = await getCertificateSerial(certPath)

    // Generate PKCS#12 bundle
    let pfxGenerated = false
    const pfxPass = pfxPassword || randomBytes(8).toString('base64')

    if (generatePfx !== false) {
      await createPKCS12({
        certificatePath: certPath,
        keyPath: keyPath,
        outputPath: pfxPath,
        password: pfxPass,
        friendlyName: user.username,
        caChainPath: ca.certificatePath,
      })
      pfxGenerated = true
    }

    // Create certificate record in database
    const certificate = await db.certificate.create({
      data: {
        userId,
        serialNumber,
        commonName: commonName,
        subject: certInfo.subject,
        issuer: certInfo.issuer,
        issueDate: certInfo.notBefore,
        expiryDate: certInfo.notAfter,
        status: 'ACTIVE',
        certificatePath: certPath,
        pfxPath: pfxGenerated ? pfxPath : null,
        pfxPassword: pfxGenerated ? pfxPass : null,
        keySize: size,
        signatureAlgorithm: certInfo.signatureAlgorithm,
        certificateType: 'CLIENT',
        ekus: certInfo.extendedKeyUsage.join(','),
      },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'GENERATE_CERTIFICATE',
        category: 'CERTIFICATE_OPERATIONS',
        actorType: 'ADMIN',
        targetId: certificate.id,
        targetType: 'Certificate',
        details: JSON.stringify({
          username: user.username,
          serialNumber,
          validityDays: days,
          keySize: size,
        }),
        status: 'SUCCESS',
      },
    })

    // Auto-reload strongSwan if configured
    if (config?.autoReloadStrongswan) {
      try {
        await reloadStrongSwan()
      } catch (e) {
        console.error('Failed to reload strongSwan:', e)
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
        keySize: certificate.keySize,
        pfxPassword: pfxGenerated ? pfxPass : null,
      },
      download: {
        pem: `/api/certificates/${certificate.id}/download?format=pem`,
        pfx: pfxGenerated ? `/api/certificates/${certificate.id}/download?format=pfx` : null,
        key: `/api/certificates/${certificate.id}/download?format=key`,
      },
    })
  } catch (error) {
    console.error('Generate certificate error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
