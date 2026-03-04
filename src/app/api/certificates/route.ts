import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { randomBytes } from 'crypto'
import {
  getPKIPaths,
  ensurePKIDirectories,
} from '@/lib/pki/config'
import { 
  ensureStrongSwanDirs,
  reloadStrongSwan,
  STRONGSWAN_PATHS,
} from '@/lib/pki/strongswan'

/**
 * Client Certificate Generation API
 * Uses strongSwan pki tool for certificate operations
 * 
 * Flow:
 * 1. Generate private key: pki --gen --type rsa --size 4096
 * 2. Extract public key: pki --pub --in <key>
 * 3. Issue certificate: pki --issue --cacert <ca> --cakey <cakey> --dn <dn> --flag clientAuth
 * 4. Export PKCS#12: openssl pkcs12 -export -inkey <key> -in <cert> -certfile <ca> -out <p12>
 */

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
      cas: cas,
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

// POST - Generate a new client certificate
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
      userId, 
      validityDays, 
      keySize, 
      generatePfx, 
      pfxPassword,
      caId,        // CA to use for signing
    } = body

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
          isExternal: false,
        },
      })
    }

    if (!ca || !ca.keyPath || !ca.certificatePath) {
      return NextResponse.json(
        { error: 'No active Certificate Authority found. Please initialize CA first in PKI Management.' },
        { status: 400 }
      )
    }

    // For external CA, we can't sign certificates
    if (ca.isExternal) {
      return NextResponse.json(
        { error: 'Cannot sign certificates with External CA. Use CSR export instead.' },
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

    // Common Name - use fullName or username (NOT email)
    const commonName = user.fullName || user.username

    // Generate unique filename using username and timestamp
    const certName = `${user.username}_${Date.now()}`
    const keyPath = path.join(STRONGSWAN_PATHS.privateDir, `${certName}.key`)
    const certPath = path.join(STRONGSWAN_PATHS.x509Dir, `${certName}.pem`)
    const pfxPath = path.join(STRONGSWAN_PATHS.swanctlDir, 'pkcs12', `${certName}.p12`)

    // Ensure pkcs12 directory exists
    const pkcs12Dir = path.join(STRONGSWAN_PATHS.swanctlDir, 'pkcs12')
    if (!fs.existsSync(pkcs12Dir)) {
      fs.mkdirSync(pkcs12Dir, { recursive: true, mode: 0o755 })
    }

    console.log(`[PKI] Generating client certificate for: ${commonName}`)
    console.log(`[PKI] Using CA: ${ca.name} (${ca.subject})`)

    // Step 1: Generate private key using pki tool
    console.log('[PKI] Step 1: Generating private key...')
    execSync(
      `pki --gen --type rsa --size ${size} --outform pem`,
      { encoding: 'utf-8', stdio: ['pipe', fs.openSync(keyPath, 'w'), 'pipe'] }
    )
    fs.chmodSync(keyPath, 0o600)
    console.log(`[PKI] Private key saved to: ${keyPath}`)

    // Step 2: Build DN with optional email
    let dn = `CN=${commonName}`
    if (user.email) {
      dn += `, E=${user.email}`
    }
    
    // Step 3: Issue client certificate using pki tool
    console.log('[PKI] Step 2: Generating and signing certificate...')
    
    const issueCmd = `pki --pub --in ${keyPath} | pki --issue ` +
      `--cacert ${ca.certificatePath} ` +
      `--cakey ${ca.keyPath} ` +
      `--dn "${dn}" ` +
      `--flag clientAuth ` +
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
    let serialNumber = ''
    let certSubject = dn
    let certIssuer = ca.subject || ''
    let notBefore = new Date()
    let notAfter = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    
    try {
      const printOutput = execSync(`pki --print --in ${certPath}`, { encoding: 'utf-8' })
      
      const subjectMatch = printOutput.match(/subject:\s*"([^"]+)"/)
      const issuerMatch = printOutput.match(/issuer:\s*"([^"]+)"/)
      const serialMatch = printOutput.match(/serial:\s*([a-fA-F0-9:]+)/)
      const notBeforeMatch = printOutput.match(/not before\s*([^,]+),/)
      const notAfterMatch = printOutput.match(/not after\s*([^,]+),/)
      
      if (subjectMatch) certSubject = subjectMatch[1]
      if (issuerMatch) certIssuer = issuerMatch[1]
      if (serialMatch) serialNumber = serialMatch[1].replace(/:/g, '')
      if (notBeforeMatch) notBefore = new Date(notBeforeMatch[1].trim())
      if (notAfterMatch) notAfter = new Date(notAfterMatch[1].trim())
      
      console.log('[PKI] Certificate info:', { serialNumber, certSubject, certIssuer })
    } catch (printError) {
      console.error('[PKI] Failed to parse certificate:', printError)
    }

    // Generate PKCS#12 bundle using openssl
    let pfxGenerated = false
    const pfxPass = pfxPassword || randomBytes(8).toString('base64')

    if (generatePfx !== false) {
      console.log('[PKI] Step 3: Generating PKCS#12 bundle...')
      
      try {
        const pkcs12Cmd = `openssl pkcs12 -export ` +
          `-inkey ${keyPath} ` +
          `-in ${certPath} ` +
          `-certfile ${ca.certificatePath} ` +
          `-out ${pfxPath} ` +
          `-passout pass:${pfxPass}`
        
        execSync(pkcs12Cmd, { encoding: 'utf-8' })
        pfxGenerated = true
        console.log(`[PKI] PKCS#12 saved to: ${pfxPath}`)
      } catch (pkcs12Error) {
        console.error('[PKI] PKCS#12 generation failed:', pkcs12Error)
        // Continue without PKCS#12
      }
    }

    // Create certificate record in database
    const certificate = await db.certificate.create({
      data: {
        userId,
        serialNumber: serialNumber || `client_${Date.now()}`,
        commonName: commonName,
        subject: certSubject,
        issuer: certIssuer,
        issueDate: notBefore,
        expiryDate: notAfter,
        status: 'ACTIVE',
        certificatePath: certPath,
        pfxPath: pfxGenerated ? pfxPath : null,
        pfxPassword: pfxGenerated ? pfxPass : null,
        keySize: size,
        signatureAlgorithm: 'SHA256',
        certificateType: 'CLIENT',
        ekus: 'clientAuth',
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
          commonName,
          caId: ca.id,
          caName: ca.name,
          serialNumber,
          validityDays: days,
          keySize: size,
          pfxGenerated,
        }),
        status: 'SUCCESS',
      },
    })

    // Auto-reload strongSwan if configured
    if (config?.autoReloadStrongswan) {
      try {
        await reloadStrongSwan()
      } catch (e) {
        console.error('[PKI] Failed to reload strongSwan:', e)
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
        keySize: certificate.keySize,
        pfxPassword: pfxGenerated ? pfxPass : null,
      },
      paths: {
        key: keyPath,
        cert: certPath,
        pfx: pfxGenerated ? pfxPath : null,
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
