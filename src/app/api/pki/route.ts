import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as fs from 'fs'
import * as path from 'path'
import {
  generateRootCA,
  isOpenSSLAvailable,
  parseCertificate,
  generateCRL,
} from '@/lib/pki/openssl'
import {
  deployCACertificate,
  deployCRL,
  reloadStrongSwan,
  removeCACertificate,
  verifyDeployment,
  ensureStrongSwanDirs,
} from '@/lib/pki/strongswan'
import {
  getPKIPaths,
  ensurePKIDirectories,
  initializeCADatabase,
  createCAConfig,
  validatePKISetup,
  getPKIPathStatus,
} from '@/lib/pki/config'

// GET - Get PKI configuration and status
export async function GET() {
  try {
    const [
      config,
      ca,
      crlInfo,
      serverCerts,
      stats,
    ] = await Promise.all([
      db.pkiConfiguration.findFirst(),
      db.certificateAuthority.findFirst({
        where: { isDefault: true },
        include: { crlInfo: true },
      }),
      db.crlInfo.findFirst(),
      db.serverCertificate.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      db.certificate.groupBy({
        by: ['status'],
        _count: true,
      }),
    ])

    const opensslAvailable = isOpenSSLAvailable()
    const setupValidation = validatePKISetup()
    const pathStatus = getPKIPathStatus()
    const deploymentStatus = verifyDeployment()

    // Check if CA files exist
    let caFilesExist = false
    if (ca?.certificatePath && ca.keyPath) {
      caFilesExist = fs.existsSync(ca.certificatePath) && fs.existsSync(ca.keyPath)
    }

    // Check CRL status
    let crlFileExists = false
    if (crlInfo?.filePath) {
      crlFileExists = fs.existsSync(crlInfo.filePath)
    }

    return NextResponse.json({
      mode: config?.mode || 'MANAGED',
      openssl: {
        available: opensslAvailable,
        version: opensslAvailable ? 'Available' : 'Not found',
      },
      ca: ca ? {
        id: ca.id,
        name: ca.name,
        type: ca.type,
        status: ca.status,
        isExternal: ca.isExternal,
        subject: ca.subject,
        serialNumber: ca.serialNumber,
        issueDate: ca.issueDate,
        expiryDate: ca.expiryDate,
        keySize: ca.keySize,
        filesExist: caFilesExist,
        crlUrl: ca.crlUrl,
        isDefault: ca.isDefault,
        paths: {
          certificatePath: ca.certificatePath,
          keyPath: ca.keyPath,
          crlPath: ca.crlPath,
        },
      } : null,
      crl: crlInfo ? {
        version: crlInfo.version,
        thisUpdate: crlInfo.thisUpdate,
        nextUpdate: crlInfo.nextUpdate,
        revokedCount: crlInfo.revokedCount,
        fileExists: crlFileExists,
      } : null,
      serverCertificates: serverCerts.map((cert) => ({
        id: cert.id,
        hostname: cert.hostname,
        commonName: cert.commonName,
        expiryDate: cert.expiryDate,
        isDeployed: cert.isDeployed,
      })),
      settings: {
        minKeySize: config?.minKeySize || 4096,
        defaultClientValidityDays: config?.defaultClientValidityDays || 365,
        defaultServerValidityDays: config?.defaultServerValidityDays || 730,
        crlValidityDays: config?.crlValidityDays || 7,
        autoReloadStrongswan: config?.autoReloadStrongswan ?? true,
        swanctlConfigPath: config?.swanctlConfigPath || '/etc/swanctl',
      },
      stats: {
        active: stats.find(s => s.status === 'ACTIVE')?._count || 0,
        expired: stats.find(s => s.status === 'EXPIRED')?._count || 0,
        revoked: stats.find(s => s.status === 'REVOKED')?._count || 0,
      },
      validation: setupValidation,
      paths: pathStatus,
      deployment: deploymentStatus,
    })
  } catch (error) {
    console.error('Get PKI status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Initialize CA or regenerate CRL
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case 'init_ca':
        return await initializeCA(data)
      case 'regenerate_crl':
        return await regenerateCRL()
      case 'deploy_to_strongswan':
        return await deployToStrongSwan()
      case 'update_settings':
        return await updateSettings(data)
      case 'regenerate_ca':
        return await regenerateCA(data)
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('PKI action error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

async function initializeCA(data: {
  name: string
  country?: string
  organization?: string
  keySize?: number
  validityDays?: number
}) {
  // Check if CA already exists
  const existingCA = await db.certificateAuthority.findFirst({
    where: { isDefault: true },
  })

  if (existingCA) {
    return NextResponse.json(
      { error: 'A CA already exists. Delete it first to create a new one.' },
      { status: 400 }
    )
  }

  if (!isOpenSSLAvailable()) {
    return NextResponse.json(
      { error: 'OpenSSL is not available' },
      { status: 500 }
    )
  }

  // Get PKI paths
  const paths = getPKIPaths()

  // Ensure all directories exist (both PKI and strongSwan)
  ensurePKIDirectories()
  ensureStrongSwanDirs()

  // Generate CA
  await generateRootCA(paths.caKeyPath, paths.caCertPath, {
    name: data.name || 'VPN Root CA',
    commonName: data.name || '24online VPN Root CA',
    country: data.country || 'US',
    organization: data.organization || '24online',
    keySize: data.keySize || 4096,
    validityDays: data.validityDays || 3650, // 10 years
  })

  // Parse generated certificate
  const certInfo = await parseCertificate(paths.caCertPath)

  // Initialize CA database
  initializeCADatabase()
  createCAConfig()

  // Create database record
  const ca = await db.certificateAuthority.create({
    data: {
      name: data.name || '24online VPN Root CA',
      type: 'ROOT',
      status: 'ACTIVE',
      isDefault: true,
      isExternal: false,
      keyPath: paths.caKeyPath,
      certificatePath: paths.caCertPath,
      crlPath: paths.crlPath,
      subject: certInfo.subject,
      serialNumber: certInfo.serialNumber,
      issueDate: certInfo.notBefore,
      expiryDate: certInfo.notAfter,
      keySize: data.keySize || 4096,
      defaultValidityDays: 365,
      crlValidityDays: 7,
    },
  })

  // Generate initial CRL (empty, but must exist)
  try {
    await generateCRL(
      paths.caCertPath,
      paths.caKeyPath,
      paths.databasePath,
      paths.crlPath,
      7 // 7 days validity
    )
    console.log('[PKI] Initial CRL generated:', paths.crlPath)
  } catch (crlError) {
    console.error('[PKI] Failed to generate initial CRL:', crlError)
    // Continue - CRL is not critical for basic operation
  }

  // Create CRL info
  const now = new Date()
  const nextUpdate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  await db.crlInfo.create({
    data: {
      caId: ca.id,
      version: 1,
      thisUpdate: now,
      nextUpdate,
      revokedCount: 0,
      filePath: paths.crlPath,
    },
  })

  // Deploy CA certificate to strongSwan
  const caDeployResult = deployCACertificate(paths.caCertPath, 'ca')
  console.log('[PKI] CA deployment result:', caDeployResult)

  // Deploy CRL to strongSwan
  let crlDeployResult = null
  if (fs.existsSync(paths.crlPath)) {
    crlDeployResult = deployCRL(paths.crlPath, 'ca')
    console.log('[PKI] CRL deployment result:', crlDeployResult)
  }

  // Create or update PKI configuration
  await db.pkiConfiguration.upsert({
    where: { id: '1' },
    create: {
      mode: 'MANAGED',
      managedRootCaId: ca.id,
      minKeySize: data.keySize || 4096,
    },
    update: {
      mode: 'MANAGED',
      managedRootCaId: ca.id,
    },
  })

  // Log audit
  await db.auditLog.create({
    data: {
      action: 'INITIALIZE_CA',
      category: 'CA_OPERATIONS',
      actorType: 'ADMIN',
      targetId: ca.id,
      targetType: 'CertificateAuthority',
      details: JSON.stringify({
        name: ca.name,
        keySize: ca.keySize,
        subject: ca.subject,
        caDeployed: caDeployResult.success,
        crlDeployed: crlDeployResult?.success,
      }),
      status: 'SUCCESS',
    },
  })

  return NextResponse.json({
    success: true,
    ca: {
      id: ca.id,
      name: ca.name,
      subject: ca.subject,
      expiryDate: ca.expiryDate,
    },
    deployment: {
      ca: caDeployResult,
      crl: crlDeployResult,
    },
  })
}

async function regenerateCRL() {
  const ca = await db.certificateAuthority.findFirst({
    where: { isDefault: true, isExternal: false },
    include: { crlInfo: true },
  })

  if (!ca || !ca.keyPath || !ca.certificatePath) {
    return NextResponse.json(
      { error: 'No managed CA found' },
      { status: 400 }
    )
  }

  const paths = getPKIPaths()

  // Generate CRL using OpenSSL
  await generateCRL(
    ca.certificatePath,
    ca.keyPath,
    paths.databasePath,
    paths.crlPath,
    ca.crlValidityDays || 7
  )

  // Count revoked certificates
  const revokedCount = await db.revocation.count({
    where: {
      certificate: { status: 'REVOKED' },
    },
  })

  // Update CRL info
  const now = new Date()
  const nextUpdate = new Date(now.getTime() + (ca.crlValidityDays || 7) * 24 * 60 * 60 * 1000)

  await db.crlInfo.updateMany({
    where: { caId: ca.id },
    data: {
      version: { increment: 1 },
      thisUpdate: now,
      nextUpdate,
      revokedCount,
      filePath: paths.crlPath,
      generatedAt: now,
    },
  })

  // Deploy CRL to strongSwan
  const crlDeployResult = deployCRL(paths.crlPath, 'ca')

  // Log audit
  await db.auditLog.create({
    data: {
      action: 'REGENERATE_CRL',
      category: 'CRL_OPERATIONS',
      actorType: 'ADMIN',
      targetType: 'CrlInfo',
      details: JSON.stringify({ 
        revokedCount,
        deployed: crlDeployResult.success,
      }),
      status: 'SUCCESS',
    },
  })

  return NextResponse.json({
    success: true,
    crl: {
      thisUpdate: now,
      nextUpdate,
      revokedCount,
    },
    deployment: crlDeployResult,
  })
}

async function deployToStrongSwan() {
  const ca = await db.certificateAuthority.findFirst({
    where: { isDefault: true },
  })

  if (!ca || !ca.certificatePath) {
    return NextResponse.json(
      { error: 'No CA found' },
      { status: 400 }
    )
  }

  // Check CA files exist
  if (!fs.existsSync(ca.certificatePath)) {
    return NextResponse.json(
      { error: 'CA certificate file not found' },
      { status: 400 }
    )
  }

  // Ensure strongSwan directories exist
  ensureStrongSwanDirs()

  // Deploy CA certificate to x509ca directory
  const caDeployResult = deployCACertificate(ca.certificatePath, 'ca')

  if (!caDeployResult.success) {
    return NextResponse.json(
      { error: `Failed to deploy CA: ${caDeployResult.error}` },
      { status: 500 }
    )
  }

  // Deploy CRL if exists
  let crlDeployResult = null
  const paths = getPKIPaths()
  if (fs.existsSync(paths.crlPath)) {
    crlDeployResult = deployCRL(paths.crlPath, 'ca')
  }

  // Verify deployment
  const deploymentStatus = verifyDeployment()

  // Reload strongSwan
  const reloadResult = await reloadStrongSwan()

  // Log audit
  await db.auditLog.create({
    data: {
      action: 'DEPLOY_TO_STRONGSWAN',
      category: 'VPN_INTEGRATION',
      actorType: 'ADMIN',
      targetType: 'CertificateAuthority',
      targetId: ca.id,
      details: JSON.stringify({
        caDest: caDeployResult.destPath,
        crlDest: crlDeployResult?.destPath,
        reloadSuccess: reloadResult.success,
        deploymentStatus,
      }),
      status: reloadResult.success ? 'SUCCESS' : 'FAILURE',
      errorMessage: reloadResult.success ? null : reloadResult.message,
    },
  })

  return NextResponse.json({
    success: true,
    deployed: {
      caCertificate: caDeployResult.destPath,
      crl: crlDeployResult?.destPath,
    },
    verification: deploymentStatus,
    reload: reloadResult,
  })
}

async function updateSettings(data: {
  minKeySize?: number
  defaultClientValidityDays?: number
  defaultServerValidityDays?: number
  crlValidityDays?: number
  autoReloadStrongswan?: boolean
}) {
  const config = await db.pkiConfiguration.findFirst()

  if (config) {
    await db.pkiConfiguration.update({
      where: { id: config.id },
      data: {
        minKeySize: data.minKeySize,
        defaultClientValidityDays: data.defaultClientValidityDays,
        defaultServerValidityDays: data.defaultServerValidityDays,
        crlValidityDays: data.crlValidityDays,
        autoReloadStrongswan: data.autoReloadStrongswan,
      },
    })
  } else {
    await db.pkiConfiguration.create({
      data: {
        mode: 'MANAGED',
        minKeySize: data.minKeySize || 4096,
        defaultClientValidityDays: data.defaultClientValidityDays || 365,
        defaultServerValidityDays: data.defaultServerValidityDays || 730,
        crlValidityDays: data.crlValidityDays || 7,
        autoReloadStrongswan: data.autoReloadStrongswan ?? true,
      },
    })
  }

  return NextResponse.json({ success: true })
}

// DELETE - Delete CA certificate
export async function DELETE() {
  try {
    const ca = await db.certificateAuthority.findFirst({
      where: { isDefault: true },
    })

    if (!ca) {
      return NextResponse.json(
        { error: 'No CA found to delete' },
        { status: 404 }
      )
    }

    // Check for issued certificates
    const issuedCount = await db.certificate.count({
      where: { status: { not: 'REVOKED' } }
    })

    if (issuedCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete CA: ${issuedCount} active certificates exist. Revoke all certificates first.` },
        { status: 400 }
      )
    }

    // Delete CA files
    const paths = getPKIPaths()
    
    // Delete CA certificate file
    if (ca.certificatePath && fs.existsSync(ca.certificatePath)) {
      fs.unlinkSync(ca.certificatePath)
    }
    
    // Delete CA key file
    if (ca.keyPath && fs.existsSync(ca.keyPath)) {
      fs.unlinkSync(ca.keyPath)
    }
    
    // Delete CRL file
    if (ca.crlPath && fs.existsSync(ca.crlPath)) {
      fs.unlinkSync(ca.crlPath)
    }

    // Remove from strongSwan
    removeCACertificate('ca')

    // Delete CRL info
    await db.crlInfo.deleteMany({
      where: { caId: ca.id }
    })

    // Delete CA record
    await db.certificateAuthority.delete({
      where: { id: ca.id }
    })

    // Update PKI configuration
    await db.pkiConfiguration.updateMany({
      data: {
        managedRootCaId: null,
        managedIntermediateCaId: null,
      }
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'DELETE_CA',
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
      message: 'CA deleted successfully',
    })
  } catch (error) {
    console.error('Delete CA error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// Regenerate CA (delete old and create new)
async function regenerateCA(data: {
  name: string
  country?: string
  organization?: string
  keySize?: number
  validityDays?: number
}) {
  // Delete existing CA first
  const ca = await db.certificateAuthority.findFirst({
    where: { isDefault: true },
  })

  if (ca) {
    // Delete CA files
    if (ca.certificatePath && fs.existsSync(ca.certificatePath)) {
      fs.unlinkSync(ca.certificatePath)
    }
    if (ca.keyPath && fs.existsSync(ca.keyPath)) {
      fs.unlinkSync(ca.keyPath)
    }
    if (ca.crlPath && fs.existsSync(ca.crlPath)) {
      fs.unlinkSync(ca.crlPath)
    }

    // Delete CRL info
    await db.crlInfo.deleteMany({
      where: { caId: ca.id }
    })

    // Delete CA record
    await db.certificateAuthority.delete({
      where: { id: ca.id }
    })

    // Remove from strongSwan
    removeCACertificate('ca')
  }

  // Now initialize new CA
  return await initializeCA(data)
}
