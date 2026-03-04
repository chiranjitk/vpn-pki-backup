import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as fs from 'fs'
import * as path from 'path'
import {
  ensureStrongSwanDirs,
  deployCACertificate,
  deployCRL,
  reloadStrongSwan,
  STRONGSWAN_PATHS,
} from '@/lib/pki/strongswan'
import {
  getPKIPaths,
  ensurePKIDirectories,
} from '@/lib/pki/config'

/**
 * External CA Import API
 * MODE A: External Customer CA Integration
 * 
 * Features:
 * - Upload Root CA (PEM)
 * - Upload Intermediate CA (optional)
 * - Upload/Configure CRL (file or URL)
 * - No certificate signing done by system
 */

// POST - Import External CA
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...data } = body

    if (action === 'import_external_ca') {
      return await importExternalCA(data)
    }

    if (action === 'fetch_crl') {
      return await fetchCRL()
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('External CA error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

async function importExternalCA(data: {
  name: string
  certificatePem: string
  intermediatePem?: string
  crlUrl?: string
  crlPem?: string
}) {
  const { name, certificatePem, intermediatePem, crlUrl, crlPem } = data

  // Validate required fields
  if (!name || !certificatePem) {
    return NextResponse.json(
      { error: 'Name and CA certificate are required' },
      { status: 400 }
    )
  }

  // Validate PEM format
  if (!certificatePem.includes('-----BEGIN CERTIFICATE-----') || 
      !certificatePem.includes('-----END CERTIFICATE-----')) {
    return NextResponse.json(
      { error: 'Invalid CA certificate format. Must be PEM format.' },
      { status: 400 }
    )
  }

  // Check for existing CA
  const existingCA = await db.certificateAuthority.findFirst({
    where: { isDefault: true },
  })

  if (existingCA) {
    return NextResponse.json(
      { error: 'A CA already exists. Delete it first to import a new one.' },
      { status: 400 }
    )
  }

  // Ensure directories exist
  ensurePKIDirectories()
  ensureStrongSwanDirs()

  const paths = getPKIPaths()

  // Save CA certificate
  const caCertPath = path.join(STRONGSWAN_PATHS.x509caDir, 'ca.pem')
  fs.writeFileSync(caCertPath, certificatePem, { mode: 0o644 })

  // Parse certificate info using openssl
  let subject = ''
  let serialNumber = ''
  let issueDate = new Date()
  let expiryDate = new Date()
  let keySize = 4096

  try {
    const { execSync } = await import('child_process')
    
    // Write temp file for parsing
    const tempPath = `/tmp/ca_temp_${Date.now()}.pem`
    fs.writeFileSync(tempPath, certificatePem)
    
    const output = execSync(`openssl x509 -in ${tempPath} -noout -subject -serial -dates -text`, { encoding: 'utf-8' })
    fs.unlinkSync(tempPath)
    
    const subjectMatch = output.match(/subject=([^\n]+)/)
    const serialMatch = output.match(/serial=([^\n]+)/)
    const notBeforeMatch = output.match(/notBefore=(.+)/)
    const notAfterMatch = output.match(/notAfter=(.+)/)
    const keySizeMatch = output.match(/Public-Key: \((\d+) bit\)/)
    
    if (subjectMatch) subject = subjectMatch[1].trim()
    if (serialMatch) serialNumber = serialMatch[1].trim()
    if (notBeforeMatch) issueDate = new Date(notBeforeMatch[1])
    if (notAfterMatch) expiryDate = new Date(notAfterMatch[1])
    if (keySizeMatch) keySize = parseInt(keySizeMatch[1])
  } catch (parseError) {
    console.error('[PKI] Failed to parse certificate:', parseError)
    subject = `CN=${name}`
    serialNumber = `ext_${Date.now()}`
  }

  // Save intermediate CA if provided
  let intermediatePath = null
  if (intermediatePem && intermediatePem.includes('-----BEGIN CERTIFICATE-----')) {
    intermediatePath = path.join(STRONGSWAN_PATHS.x509caDir, 'intermediate.pem')
    fs.writeFileSync(intermediatePath, intermediatePem, { mode: 0o644 })
  }

  // Save CRL if provided
  let crlPath = null
  if (crlPem && crlPem.includes('-----BEGIN X509 CRL-----')) {
    crlPath = path.join(STRONGSWAN_PATHS.crlDir, 'ca.crl.pem')
    fs.writeFileSync(crlPath, crlPem, { mode: 0o644 })
  }

  // Create CA record in database
  const ca = await db.certificateAuthority.create({
    data: {
      name: name,
      type: 'ROOT',
      status: 'ACTIVE',
      isDefault: true,
      isExternal: true,
      certificatePath: caCertPath,
      keyPath: null, // No key for external CA
      crlPath: crlPath,
      crlUrl: crlUrl || null,
      subject: subject,
      serialNumber: serialNumber,
      issueDate: issueDate,
      expiryDate: expiryDate,
      keySize: keySize,
      defaultValidityDays: 365,
      crlValidityDays: 7,
    },
  })

  // Update PKI configuration
  await db.pkiConfiguration.upsert({
    where: { id: '1' },
    create: {
      mode: 'EXTERNAL',
      managedRootCaId: null,
    },
    update: {
      mode: 'EXTERNAL',
    },
  })

  // Deploy to strongSwan
  const deployResult = deployCACertificate(caCertPath, 'ca')

  // Deploy CRL if exists
  let crlDeployResult = null
  if (crlPath && fs.existsSync(crlPath)) {
    crlDeployResult = deployCRL(crlPath, 'ca')
  }

  // Log audit
  await db.auditLog.create({
    data: {
      action: 'IMPORT_EXTERNAL_CA',
      category: 'CA_OPERATIONS',
      actorType: 'ADMIN',
      targetId: ca.id,
      targetType: 'CertificateAuthority',
      details: JSON.stringify({
        name: ca.name,
        subject: ca.subject,
        hasIntermediate: !!intermediatePath,
        crlUrl: crlUrl,
        hasCrlPem: !!crlPem,
      }),
      status: 'SUCCESS',
    },
  })

  // Reload strongSwan
  try {
    await reloadStrongSwan()
  } catch (e) {
    console.error('[PKI] Failed to reload strongSwan:', e)
  }

  return NextResponse.json({
    success: true,
    ca: {
      id: ca.id,
      name: ca.name,
      subject: ca.subject,
      isExternal: ca.isExternal,
      crlUrl: ca.crlUrl,
    },
    deployment: {
      ca: deployResult,
      crl: crlDeployResult,
    },
  })
}

async function fetchCRL() {
  const ca = await db.certificateAuthority.findFirst({
    where: { isDefault: true, isExternal: true },
  })

  if (!ca || !ca.crlUrl) {
    return NextResponse.json(
      { error: 'No external CA with CRL URL found' },
      { status: 400 }
    )
  }

  try {
    const { execSync } = await import('child_process')
    
    const crlPath = path.join(STRONGSWAN_PATHS.crlDir, 'ca.crl.pem')
    
    // Fetch CRL using curl
    execSync(`curl -sSL "${ca.crlUrl}" -o ${crlPath}`, { encoding: 'utf-8' })
    
    // Update CA record
    await db.certificateAuthority.update({
      where: { id: ca.id },
      data: {
        crlPath: crlPath,
        crlLastFetch: new Date(),
      },
    })

    // Deploy CRL
    const deployResult = deployCRL(crlPath, 'ca')

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'FETCH_EXTERNAL_CRL',
        category: 'CRL_OPERATIONS',
        actorType: 'SYSTEM',
        targetType: 'CertificateAuthority',
        targetId: ca.id,
        details: JSON.stringify({ crlUrl: ca.crlUrl }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({
      success: true,
      crlPath: crlPath,
      deployment: deployResult,
    })
  } catch (error) {
    console.error('[PKI] Failed to fetch CRL:', error)
    return NextResponse.json(
      { error: 'Failed to fetch CRL from URL' },
      { status: 500 }
    )
  }
}

// DELETE - Remove External CA
export async function DELETE() {
  try {
    const ca = await db.certificateAuthority.findFirst({
      where: { isDefault: true, isExternal: true },
    })

    if (!ca) {
      return NextResponse.json(
        { error: 'No external CA found' },
        { status: 404 }
      )
    }

    // Delete CA files
    if (ca.certificatePath && fs.existsSync(ca.certificatePath)) {
      fs.unlinkSync(ca.certificatePath)
    }
    
    if (ca.crlPath && fs.existsSync(ca.crlPath)) {
      fs.unlinkSync(ca.crlPath)
    }

    // Delete CRL info
    await db.crlInfo.deleteMany({
      where: { caId: ca.id },
    })

    // Delete CA record
    await db.certificateAuthority.delete({
      where: { id: ca.id },
    })

    // Update PKI configuration
    await db.pkiConfiguration.updateMany({
      data: {
        mode: 'MANAGED',
      },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'DELETE_EXTERNAL_CA',
        category: 'CA_OPERATIONS',
        actorType: 'ADMIN',
        targetId: ca.id,
        targetType: 'CertificateAuthority',
        details: JSON.stringify({
          name: ca.name,
          subject: ca.subject,
        }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'External CA removed successfully',
    })
  } catch (error) {
    console.error('Delete external CA error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
