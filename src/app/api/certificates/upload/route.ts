import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { randomBytes } from 'crypto'
import {
  ensurePKIDirectories,
} from '@/lib/pki/config'
import {
  ensureStrongSwanDirs,
  reloadStrongSwan,
  STRONGSWAN_PATHS,
} from '@/lib/pki/strongswan'

/**
 * Certificate Upload API for VPN PKI Management Platform
 * 
 * This API handles uploading signed certificates from external CAs (MODE A).
 * 
 * Flow:
 * 1. Validate PEM format
 * 2. Parse certificate info using openssl x509
 * 3. If csrId provided, match cert with CSR
 * 4. Store certificate in appropriate directory
 * 5. Create/update database record
 * 6. If private key available, generate PKCS#12 bundle
 * 7. Log to audit
 * 8. Return certificate details
 * 
 * Storage paths:
 * - Server certs: /etc/swanctl/x509/
 * - Client certs: /etc/swanctl/x509/
 * - Private keys: /etc/swanctl/private/
 * - PKCS#12: /etc/swanctl/pkcs12/
 */

// PKCS#12 directory path
const PKCS12_DIR = '/etc/swanctl/pkcs12'

/**
 * Ensure PKCS#12 directory exists
 */
function ensurePKCS12Directory(): void {
  if (!fs.existsSync(PKCS12_DIR)) {
    fs.mkdirSync(PKCS12_DIR, { recursive: true, mode: 0o755 })
  }
}

/**
 * Validate PEM certificate format
 */
function validatePEMFormat(pem: string): { valid: boolean; error?: string } {
  if (!pem || typeof pem !== 'string') {
    return { valid: false, error: 'Certificate PEM is required' }
  }

  const trimmed = pem.trim()
  
  if (!trimmed.includes('-----BEGIN CERTIFICATE-----') ||
      !trimmed.includes('-----END CERTIFICATE-----')) {
    return { valid: false, error: 'Invalid PEM format - missing certificate headers' }
  }

  return { valid: true }
}

/**
 * Validate certificate chain PEM format
 */
function validateChainPEMFormat(pem: string): { valid: boolean; error?: string } {
  if (!pem || typeof pem !== 'string') {
    return { valid: true } // Chain is optional
  }

  const trimmed = pem.trim()
  
  // Check for at least one certificate in the chain
  if (!trimmed.includes('-----BEGIN CERTIFICATE-----')) {
    return { valid: false, error: 'Invalid chain PEM format - missing certificate headers' }
  }

  return { valid: true }
}

/**
 * Parse certificate using openssl x509
 */
function parseCertificate(certPath: string): {
  serialNumber: string
  subject: string
  issuer: string
  notBefore: Date
  notAfter: Date
  commonName: string
  san: string[]
  keyUsage: string[]
  extendedKeyUsage: string[]
  fingerprint: string
} {
  try {
    // Get certificate details in text format
    const textOutput = execSync(
      `openssl x509 -in ${certPath} -noout -text -nameopt RFC2253`,
      { encoding: 'utf-8' }
    )

    // Get certificate in PEM format for fingerprint
    const pemOutput = execSync(
      `openssl x509 -in ${certPath} -noout -fingerprint -sha256`,
      { encoding: 'utf-8' }
    )

    // Parse subject
    const subjectMatch = textOutput.match(/Subject:\s*(.+)/)
    const subject = subjectMatch ? subjectMatch[1].trim() : ''

    // Parse issuer
    const issuerMatch = textOutput.match(/Issuer:\s*(.+)/)
    const issuer = issuerMatch ? issuerMatch[1].trim() : ''

    // Parse serial number
    const serialMatch = textOutput.match(/Serial Number:\s*([a-fA-F0-9:\s]+)/i)
    let serialNumber = serialMatch ? serialMatch[1].trim().replace(/\s/g, '') : ''
    
    // Alternative: get serial from hex dump
    if (!serialNumber) {
      const serialHex = execSync(
        `openssl x509 -in ${certPath} -noout -serial`,
        { encoding: 'utf-8' }
      )
      const serialHexMatch = serialHex.match(/serial=([A-Fa-f0-9]+)/)
      serialNumber = serialHexMatch ? serialHexMatch[1] : ''
    }

    // Parse dates
    const notBeforeMatch = textOutput.match(/Not Before\s*:\s*(.+)/i)
    const notAfterMatch = textOutput.match(/Not After\s*:\s*(.+)/i)
    const notBefore = notBeforeMatch ? new Date(notBeforeMatch[1].trim()) : new Date()
    const notAfter = notAfterMatch ? new Date(notAfterMatch[1].trim()) : new Date()

    // Parse Common Name
    const cnMatch = subject.match(/CN\s*=\s*([^,\/]+)/i)
    const commonName = cnMatch ? cnMatch[1].trim() : ''

    // Parse SANs
    const san: string[] = []
    const sanMatch = textOutput.match(/Subject Alternative Name:\s*\n\s+(.+)/i)
    if (sanMatch) {
      const sanList = sanMatch[1].split(',').map(s => s.trim())
      san.push(...sanList)
    }

    // Parse Key Usage
    const keyUsage: string[] = []
    const keyUsageMatch = textOutput.match(/Key Usage:\s*\n\s+(.+)/i)
    if (keyUsageMatch) {
      keyUsage.push(...keyUsageMatch[1].split(',').map(s => s.trim()))
    }

    // Parse Extended Key Usage
    const extendedKeyUsage: string[] = []
    const ekuMatch = textOutput.match(/Extended Key Usage:\s*\n\s+(.+)/i)
    if (ekuMatch) {
      extendedKeyUsage.push(...ekuMatch[1].split(',').map(s => s.trim()))
    }

    // Parse fingerprint
    const fingerprintMatch = pemOutput.match(/sha256 Fingerprint=([A-Fa-f0-9:]+)/i)
    const fingerprint = fingerprintMatch ? fingerprintMatch[1] : ''

    return {
      serialNumber,
      subject,
      issuer,
      notBefore,
      notAfter,
      commonName,
      san,
      keyUsage,
      extendedKeyUsage,
      fingerprint,
    }
  } catch (error) {
    console.error('[Upload] Failed to parse certificate:', error)
    throw new Error(`Failed to parse certificate: ${error}`)
  }
}

/**
 * Verify certificate matches CSR
 */
function verifyCertMatchesCSR(
  certPath: string,
  csrPath: string
): { matches: boolean; error?: string } {
  try {
    // Get modulus from certificate
    const certModulus = execSync(
      `openssl x509 -in ${certPath} -noout -modulus`,
      { encoding: 'utf-8' }
    ).trim()

    // Get modulus from CSR
    const csrModulus = execSync(
      `openssl req -in ${csrPath} -noout -modulus`,
      { encoding: 'utf-8' }
    ).trim()

    if (certModulus === csrModulus) {
      return { matches: true }
    }

    return { matches: false, error: 'Certificate public key does not match CSR' }
  } catch (error) {
    console.error('[Upload] Failed to verify cert/CSR match:', error)
    return { matches: false, error: `Verification failed: ${error}` }
  }
}

/**
 * Generate PKCS#12 bundle
 */
function generatePKCS12(
  certPath: string,
  keyPath: string,
  chainPath: string | undefined,
  outputPath: string,
  password: string
): { success: boolean; error?: string } {
  try {
    // Build command with optional chain
    let cmd = `openssl pkcs12 -export -inkey ${keyPath} -in ${certPath}`
    
    if (chainPath && fs.existsSync(chainPath)) {
      cmd += ` -certfile ${chainPath}`
    }
    
    cmd += ` -out ${outputPath} -passout pass:${password}`

    execSync(cmd, { encoding: 'utf-8' })
    fs.chmodSync(outputPath, 0o644)

    return { success: true }
  } catch (error) {
    console.error('[Upload] Failed to generate PKCS#12:', error)
    return { success: false, error: `PKCS#12 generation failed: ${error}` }
  }
}

/**
 * POST - Upload a signed certificate
 * 
 * Body: {
 *   type: 'server' | 'client',
 *   csrId?: string,       // If from CSR (database ID)
 *   certificatePem: string,  // Signed cert in PEM
 *   chainPem?: string,       // Optional chain
 *   userId?: string,         // For client certs
 *   hostname?: string,       // For server certs
 *   privateKeyPem?: string,  // If uploading key separately
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Check if OpenSSL is available
    try {
      execSync('which openssl', { encoding: 'utf-8' })
    } catch {
      return NextResponse.json(
        { error: 'OpenSSL is not available. Please install OpenSSL.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const {
      type,
      csrId,
      certificatePem,
      chainPem,
      userId,
      hostname,
      privateKeyPem,
    } = body

    // Validate required fields
    if (!type || !['server', 'client'].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be either "server" or "client"' },
        { status: 400 }
      )
    }

    if (!certificatePem) {
      return NextResponse.json(
        { error: 'Certificate PEM is required' },
        { status: 400 }
      )
    }

    // Validate PEM formats
    const certValidation = validatePEMFormat(certificatePem)
    if (!certValidation.valid) {
      return NextResponse.json(
        { error: certValidation.error },
        { status: 400 }
      )
    }

    if (chainPem) {
      const chainValidation = validateChainPEMFormat(chainPem)
      if (!chainValidation.valid) {
        return NextResponse.json(
          { error: chainValidation.error },
          { status: 400 }
        )
      }
    }

    // Ensure directories exist
    ensurePKIDirectories()
    ensureStrongSwanDirs()
    ensurePKCS12Directory()

    // Generate unique filename
    const timestamp = Date.now()
    const certName = `${type}_${timestamp}`
    const certPath = path.join(STRONGSWAN_PATHS.x509Dir, `${certName}.pem`)
    const chainPath = chainPem ? path.join(STRONGSWAN_PATHS.x509Dir, `${certName}_chain.pem`) : undefined

    // Write certificate to temp file first for parsing
    const tempCertPath = path.join('/tmp', `cert_${timestamp}.pem`)
    fs.writeFileSync(tempCertPath, certificatePem.trim(), { mode: 0o644 })

    // Parse certificate
    console.log('[Upload] Parsing certificate...')
    let certInfo: ReturnType<typeof parseCertificate>
    try {
      certInfo = parseCertificate(tempCertPath)
      console.log('[Upload] Certificate parsed:', {
        serial: certInfo.serialNumber,
        subject: certInfo.subject,
        cn: certInfo.commonName,
      })
    } catch (parseError) {
      fs.unlinkSync(tempCertPath)
      return NextResponse.json(
        { error: `Failed to parse certificate: ${parseError}` },
        { status: 400 }
      )
    }

    // Determine common name and build cert name
    const commonName = certInfo.commonName || `${type}_cert_${timestamp}`
    const finalCertName = `${type}_${commonName.replace(/[^a-zA-Z0-9.-]/g, '_')}_${timestamp}`
    const finalCertPath = path.join(STRONGSWAN_PATHS.x509Dir, `${finalCertName}.pem`)

    // Variables for database operations
    let keyPath: string | undefined
    let pfxPath: string | undefined
    let pfxPassword: string | undefined
    let csrPath: string | undefined

    // Handle CSR matching if provided
    if (csrId) {
      console.log('[Upload] Processing CSR match for:', csrId)
      
      if (type === 'server') {
        const serverCsr = await db.serverCertificate.findUnique({
          where: { id: csrId },
        })

        if (!serverCsr) {
          fs.unlinkSync(tempCertPath)
          return NextResponse.json(
            { error: 'Server CSR not found' },
            { status: 404 }
          )
        }

        if (serverCsr.status !== 'PENDING') {
          fs.unlinkSync(tempCertPath)
          return NextResponse.json(
            { error: 'CSR is not in PENDING status' },
            { status: 400 }
          )
        }

        // Verify certificate matches CSR
        if (serverCsr.csrPath && fs.existsSync(serverCsr.csrPath)) {
          csrPath = serverCsr.csrPath
          const verifyResult = verifyCertMatchesCSR(tempCertPath, serverCsr.csrPath)
          if (!verifyResult.matches) {
            fs.unlinkSync(tempCertPath)
            return NextResponse.json(
              { error: verifyResult.error || 'Certificate does not match CSR' },
              { status: 400 }
            )
          }
          console.log('[Upload] Certificate verified against CSR')
        }

        // Use existing key path if available
        if (serverCsr.keyPath && fs.existsSync(serverCsr.keyPath)) {
          keyPath = serverCsr.keyPath
        }
      } else {
        const clientCsr = await db.certificate.findUnique({
          where: { id: csrId },
          include: { user: true },
        })

        if (!clientCsr) {
          fs.unlinkSync(tempCertPath)
          return NextResponse.json(
            { error: 'Client CSR not found' },
            { status: 404 }
          )
        }

        if (clientCsr.status !== 'PENDING') {
          fs.unlinkSync(tempCertPath)
          return NextResponse.json(
            { error: 'CSR is not in PENDING status' },
            { status: 400 }
          )
        }

        // Verify certificate matches CSR
        if (clientCsr.csrPath && fs.existsSync(clientCsr.csrPath)) {
          csrPath = clientCsr.csrPath
          const verifyResult = verifyCertMatchesCSR(tempCertPath, clientCsr.csrPath)
          if (!verifyResult.matches) {
            fs.unlinkSync(tempCertPath)
            return NextResponse.json(
              { error: verifyResult.error || 'Certificate does not match CSR' },
              { status: 400 }
            )
          }
          console.log('[Upload] Certificate verified against CSR')
        }

        // Use existing key path if available
        if (clientCsr.keyPath && fs.existsSync(clientCsr.keyPath)) {
          keyPath = clientCsr.keyPath
        }
      }
    }

    // Handle private key if provided separately
    if (privateKeyPem && !keyPath) {
      const tempKeyPath = path.join('/tmp', `key_${timestamp}.pem`)
      fs.writeFileSync(tempKeyPath, privateKeyPem.trim(), { mode: 0o600 })
      
      // Validate key
      try {
        execSync(`openssl rsa -in ${tempKeyPath} -check -noout 2>/dev/null || openssl pkey -in ${tempKeyPath} -check -noout 2>/dev/null`)
        keyPath = path.join(STRONGSWAN_PATHS.privateDir, `${finalCertName}.key`)
        fs.copyFileSync(tempKeyPath, keyPath)
        fs.chmodSync(keyPath, 0o600)
        console.log('[Upload] Private key saved to:', keyPath)
      } catch {
        fs.unlinkSync(tempKeyPath)
        fs.unlinkSync(tempCertPath)
        return NextResponse.json(
          { error: 'Invalid private key format' },
          { status: 400 }
        )
      }
      fs.unlinkSync(tempKeyPath)
    }

    // Move certificate to final location
    fs.copyFileSync(tempCertPath, finalCertPath)
    fs.chmodSync(finalCertPath, 0o644)
    fs.unlinkSync(tempCertPath)
    console.log('[Upload] Certificate saved to:', finalCertPath)

    // Write chain if provided
    if (chainPem && chainPath) {
      fs.writeFileSync(chainPath, chainPem.trim(), { mode: 0o644 })
      console.log('[Upload] Certificate chain saved to:', chainPath)
    }

    // Generate PKCS#12 if we have both cert and key
    if (keyPath && fs.existsSync(keyPath)) {
      pfxPassword = randomBytes(8).toString('base64')
      pfxPath = path.join(PKCS12_DIR, `${finalCertName}.p12`)
      
      const pfxResult = generatePKCS12(
        finalCertPath,
        keyPath,
        chainPath,
        pfxPath,
        pfxPassword
      )
      
      if (pfxResult.success) {
        console.log('[Upload] PKCS#12 bundle saved to:', pfxPath)
      } else {
        console.error('[Upload] Failed to generate PKCS#12:', pfxResult.error)
        pfxPath = undefined
        pfxPassword = undefined
      }
    }

    // Get PKI configuration
    const config = await db.pkiConfiguration.findFirst()

    // Determine certificate status
    let status: 'ACTIVE' | 'EXPIRED' = 'ACTIVE'
    if (certInfo.notAfter < new Date()) {
      status = 'EXPIRED'
    }

    // Create/update database record
    let dbRecord: any
    let action: string
    let targetType: string

    if (type === 'server') {
      // Update existing CSR record or create new one
      if (csrId) {
        dbRecord = await db.serverCertificate.update({
          where: { id: csrId },
          data: {
            commonName,
            subject: certInfo.subject,
            issuer: certInfo.issuer,
            serialNumber: certInfo.serialNumber || `server_${timestamp}`,
            issueDate: certInfo.notBefore,
            expiryDate: certInfo.notAfter,
            status,
            certificatePath: finalCertPath,
            keyPath,
            csrPath,
            isDeployed: false,
            deployedAt: null,
          },
        })
        action = 'UPLOAD_SERVER_CERTIFICATE_FROM_CSR'
      } else {
        dbRecord = await db.serverCertificate.create({
          data: {
            hostname: hostname || commonName,
            commonName,
            subject: certInfo.subject,
            issuer: certInfo.issuer,
            serialNumber: certInfo.serialNumber || `server_${timestamp}`,
            issueDate: certInfo.notBefore,
            expiryDate: certInfo.notAfter,
            status,
            certificatePath: finalCertPath,
            keyPath,
            csrPath,
            isDeployed: false,
          },
        })
        action = 'UPLOAD_SERVER_CERTIFICATE'
      }
      targetType = 'ServerCertificate'
    } else {
      // For client certificates, we need a user
      let finalUserId = userId

      // If updating from CSR, get user from the CSR record
      if (csrId) {
        const clientCsr = await db.certificate.findUnique({
          where: { id: csrId },
        })
        if (clientCsr) {
          finalUserId = clientCsr.userId
        }
      }

      if (!finalUserId) {
        return NextResponse.json(
          { error: 'User ID is required for client certificates' },
          { status: 400 }
        )
      }

      // Verify user exists
      const user = await db.vpnUser.findUnique({
        where: { id: finalUserId },
      })

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }

      // Determine EKUs
      const ekus = certInfo.extendedKeyUsage.length > 0
        ? certInfo.extendedKeyUsage.join(', ')
        : 'clientAuth'

      // Update existing CSR record or create new one
      if (csrId) {
        dbRecord = await db.certificate.update({
          where: { id: csrId },
          data: {
            commonName,
            subject: certInfo.subject,
            issuer: certInfo.issuer,
            serialNumber: certInfo.serialNumber || `client_${timestamp}`,
            issueDate: certInfo.notBefore,
            expiryDate: certInfo.notAfter,
            status,
            certificatePath: finalCertPath,
            keyPath,
            csrPath,
            pfxPath,
            pfxPassword,
            san: certInfo.san.length > 0 ? certInfo.san.join(',') : null,
            ekus,
          },
        })
        action = 'UPLOAD_CLIENT_CERTIFICATE_FROM_CSR'
      } else {
        dbRecord = await db.certificate.create({
          data: {
            userId: finalUserId,
            commonName,
            subject: certInfo.subject,
            issuer: certInfo.issuer,
            serialNumber: certInfo.serialNumber || `client_${timestamp}`,
            issueDate: certInfo.notBefore,
            expiryDate: certInfo.notAfter,
            status,
            certificatePath: finalCertPath,
            keyPath,
            csrPath,
            pfxPath,
            pfxPassword,
            keySize: 4096, // Default, actual size from key
            signatureAlgorithm: 'SHA256',
            certificateType: 'CLIENT',
            san: certInfo.san.length > 0 ? certInfo.san.join(',') : null,
            ekus,
          },
        })
        action = 'UPLOAD_CLIENT_CERTIFICATE'
      }
      targetType = 'Certificate'
    }

    // Log audit
    await db.auditLog.create({
      data: {
        action,
        category: 'CERTIFICATE_OPERATIONS',
        actorType: 'ADMIN',
        targetId: dbRecord.id,
        targetType,
        details: JSON.stringify({
          type,
          csrId,
          commonName,
          serialNumber: certInfo.serialNumber,
          subject: certInfo.subject,
          issuer: certInfo.issuer,
          issueDate: certInfo.notBefore,
          expiryDate: certInfo.notAfter,
          status,
          certificatePath: finalCertPath,
          keyPath,
          pfxPath,
          hasChain: !!chainPem,
        }),
        status: 'SUCCESS',
      },
    })

    // Auto-reload strongSwan if configured
    if (config?.autoReloadStrongswan) {
      try {
        await reloadStrongSwan()
        console.log('[Upload] strongSwan reloaded')
      } catch (e) {
        console.error('[Upload] Failed to reload strongSwan:', e)
      }
    }

    console.log(`[Upload] Successfully uploaded ${type} certificate: ${certInfo.serialNumber}`)

    return NextResponse.json({
      success: true,
      certificate: {
        id: dbRecord.id,
        type,
        serialNumber: certInfo.serialNumber,
        commonName,
        subject: certInfo.subject,
        issuer: certInfo.issuer,
        issueDate: certInfo.notBefore,
        expiryDate: certInfo.notAfter,
        status,
        san: certInfo.san,
        keyUsage: certInfo.keyUsage,
        extendedKeyUsage: certInfo.extendedKeyUsage,
        fingerprint: certInfo.fingerprint,
        pfxPassword,
      },
      paths: {
        certificate: finalCertPath,
        key: keyPath,
        chain: chainPath,
        pkcs12: pfxPath,
      },
      download: {
        pem: `/api/certificates/${dbRecord.id}/download?format=pem`,
        pfx: pfxPath ? `/api/certificates/${dbRecord.id}/download?format=pfx` : null,
        key: keyPath ? `/api/certificates/${dbRecord.id}/download?format=key` : null,
      },
    })
  } catch (error) {
    console.error('[Upload] Certificate upload error:', error)
    
    // Log failed attempt
    try {
      await db.auditLog.create({
        data: {
          action: 'UPLOAD_CERTIFICATE_FAILED',
          category: 'CERTIFICATE_OPERATIONS',
          actorType: 'ADMIN',
          details: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
          status: 'FAILURE',
        },
      })
    } catch (logError) {
      console.error('[Upload] Failed to log audit:', logError)
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET - Get upload status and requirements
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const csrId = searchParams.get('csrId')
    const type = searchParams.get('type')

    // If csrId provided, get CSR details for matching
    if (csrId && type) {
      if (type === 'server') {
        const csr = await db.serverCertificate.findUnique({
          where: { id: csrId },
        })

        if (!csr) {
          return NextResponse.json(
            { error: 'CSR not found' },
            { status: 404 }
          )
        }

        return NextResponse.json({
          csr: {
            id: csr.id,
            type: 'server',
            hostname: csr.hostname,
            commonName: csr.commonName,
            subject: csr.subject,
            status: csr.status,
            hasKey: csr.keyPath && fs.existsSync(csr.keyPath),
            csrPath: csr.csrPath,
          },
        })
      } else {
        const csr = await db.certificate.findUnique({
          where: { id: csrId },
          include: {
            user: {
              select: { id: true, username: true, email: true, fullName: true },
            },
          },
        })

        if (!csr) {
          return NextResponse.json(
            { error: 'CSR not found' },
            { status: 404 }
          )
        }

        return NextResponse.json({
          csr: {
            id: csr.id,
            type: 'client',
            commonName: csr.commonName,
            subject: csr.subject,
            status: csr.status,
            hasKey: csr.keyPath && fs.existsSync(csr.keyPath),
            csrPath: csr.csrPath,
            user: csr.user,
          },
        })
      }
    }

    // Return upload requirements
    return NextResponse.json({
      requirements: {
        type: {
          required: true,
          options: ['server', 'client'],
          description: 'Certificate type - server or client',
        },
        certificatePem: {
          required: true,
          description: 'Signed certificate in PEM format',
        },
        chainPem: {
          required: false,
          description: 'Optional certificate chain in PEM format',
        },
        csrId: {
          required: false,
          description: 'If uploading signed cert from a CSR, provide the CSR database ID',
        },
        userId: {
          required: false,
          description: 'For client certificates without CSR, the user ID',
        },
        hostname: {
          required: false,
          description: 'For server certificates without CSR, the server hostname',
        },
        privateKeyPem: {
          required: false,
          description: 'Private key if not already stored with CSR',
        },
      },
      storage: {
        certificates: STRONGSWAN_PATHS.x509Dir,
        privateKeys: STRONGSWAN_PATHS.privateDir,
        pkcs12: PKCS12_DIR,
      },
    })
  } catch (error) {
    console.error('[Upload] Get upload info error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
