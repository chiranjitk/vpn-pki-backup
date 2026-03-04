import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
<<<<<<< HEAD
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'

const execAsync = promisify(exec)

// Enhanced OCSP Configuration interface
interface OcspConfig {
  isEnabled: boolean
  responderUrl: string
  port: number
  responseValiditySeconds: number
  nextUpdateIntervalSeconds: number
  hashAlgorithm: string
  ocspCertPath: string
  ocspKeyPath: string
  caId?: string
  autoGenerateSigningCert: boolean
}

// Default configuration
const defaultConfig: OcspConfig = {
  isEnabled: false,
  responderUrl: 'http://localhost:3033',
  port: 3033,
  responseValiditySeconds: 3600,
  nextUpdateIntervalSeconds: 3600,
  hashAlgorithm: 'SHA256',
  ocspCertPath: '/etc/swanctl/ocsp.crt',
  ocspKeyPath: '/etc/swanctl/ocsp.key',
  autoGenerateSigningCert: false,
}

// Safe exec wrapper
async function safeExec(command: string, timeout = 30000): Promise<{ stdout: string; stderr: string } | null> {
  try {
    return await execAsync(command, { timeout })
  } catch {
    return null
  }
}

// Get OCSP configuration
export async function GET() {
  try {
    // Try to get config from database
    const configRecord = await db.systemSetting.findUnique({
      where: { key: 'ocsp_config' },
    })

    if (configRecord) {
      const config = JSON.parse(configRecord.value) as OcspConfig
      return NextResponse.json({ config: { ...defaultConfig, ...config } })
    }

    // Return default config
    return NextResponse.json({ config: defaultConfig })
  } catch (error) {
    console.error('Error fetching OCSP config:', error)
    return NextResponse.json(
      { error: 'Failed to fetch OCSP configuration' },
      { status: 500 }
    )
  }
}

// Save OCSP configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...rest } = body

    // Handle special actions
    if (action === 'upload_signing_cert') {
      return await handleUploadSigningCert(rest)
    }

    if (action === 'auto_generate_cert') {
      return await handleAutoGenerateCert(rest)
    }

    // Standard configuration save
    const configData: Partial<OcspConfig> = rest

    // Merge with defaults
    const config: OcspConfig = {
      ...defaultConfig,
      ...configData,
    }

    // Save to database
    await db.systemSetting.upsert({
      where: { key: 'ocsp_config' },
      create: {
        key: 'ocsp_config',
        value: JSON.stringify(config),
        category: 'ocsp',
        description: 'OCSP Responder Configuration',
      },
      update: {
        value: JSON.stringify(config),
      },
    })

    // Log audit
    try {
      await db.auditLog.create({
        data: {
          action: 'OCSP_CONFIG_UPDATED',
          category: 'SYSTEM_CONFIG',
          actorType: 'ADMIN',
          targetType: 'SystemSetting',
          status: 'SUCCESS',
          details: JSON.stringify({ 
            isEnabled: config.isEnabled,
            port: config.port,
            hashAlgorithm: config.hashAlgorithm,
          }),
        },
      })
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({
      success: true,
      message: 'OCSP configuration saved',
      config,
    })
  } catch (error) {
    console.error('Error saving OCSP config:', error)
    return NextResponse.json(
      { error: 'Failed to save OCSP configuration' },
      { status: 500 }
    )
  }
}

// Handle uploading signing certificate
async function handleUploadSigningCert(body: {
  certPem: string
  keyPem: string
  ocspCertPath?: string
  ocspKeyPath?: string
}): Promise<NextResponse> {
  const { certPem, keyPem, ocspCertPath, ocspKeyPath } = body

  if (!certPem || !keyPem) {
    return NextResponse.json(
      { error: 'Certificate and key are required' },
      { status: 400 }
    )
  }

  const certPath = ocspCertPath || '/etc/swanctl/ocsp.crt'
  const keyPath = ocspKeyPath || '/etc/swanctl/ocsp.key'

  try {
    // Ensure directory exists
    const certDir = path.dirname(certPath)
    const keyDir = path.dirname(keyPath)
    
    try {
      await fs.mkdir(certDir, { recursive: true })
    } catch {
      // Directory might already exist
    }

    try {
      await fs.mkdir(keyDir, { recursive: true })
    } catch {
      // Directory might already exist
    }

    // Write certificate
    await fs.writeFile(certPath, certPem, { mode: 0o644 })

    // Write private key with restricted permissions
    await fs.writeFile(keyPath, keyPem, { mode: 0o600 })

    // Validate certificate
    const validateResult = await safeExec(`openssl x509 -in "${certPath}" -noout -text 2>&1`)
    if (!validateResult) {
      // Clean up on validation failure
      await fs.unlink(certPath).catch(() => {})
      await fs.unlink(keyPath).catch(() => {})
      return NextResponse.json(
        { error: 'Invalid certificate format' },
        { status: 400 }
      )
    }

    // Check for OCSP Signing EKU
    if (!validateResult.stdout.includes('OCSP Signing')) {
      console.warn('Certificate does not have OCSP Signing EKU')
    }

    // Update config with new paths
    const configRecord = await db.systemSetting.findUnique({
      where: { key: 'ocsp_config' },
    })

    const currentConfig = configRecord 
      ? { ...defaultConfig, ...JSON.parse(configRecord.value) } as OcspConfig
      : defaultConfig

    await db.systemSetting.upsert({
      where: { key: 'ocsp_config' },
      create: {
        key: 'ocsp_config',
        value: JSON.stringify({
          ...currentConfig,
          ocspCertPath: certPath,
          ocspKeyPath: keyPath,
        }),
        category: 'ocsp',
        description: 'OCSP Responder Configuration',
      },
      update: {
        value: JSON.stringify({
          ...currentConfig,
          ocspCertPath: certPath,
          ocspKeyPath: keyPath,
        }),
      },
    })

    // Log audit
    try {
      await db.auditLog.create({
        data: {
          action: 'OCSP_SIGNING_CERT_UPLOADED',
          category: 'PKI_MANAGEMENT',
          actorType: 'ADMIN',
          targetType: 'Certificate',
          status: 'SUCCESS',
          details: JSON.stringify({ 
            certPath,
            keyPath,
          }),
        },
      })
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({
      success: true,
      message: 'OCSP signing certificate uploaded successfully',
      ocspCertPath: certPath,
      ocspKeyPath: keyPath,
    })
  } catch (error) {
    console.error('Error uploading OCSP certificate:', error)
    return NextResponse.json(
      { error: 'Failed to upload OCSP signing certificate' },
      { status: 500 }
    )
  }
}

// Handle auto-generating OCSP signing certificate
async function handleAutoGenerateCert(body: {
  caId: string
}): Promise<NextResponse> {
  const { caId } = body

  if (!caId) {
    return NextResponse.json(
      { error: 'CA ID is required' },
      { status: 400 }
    )
  }

  try {
    // Get CA information
    const ca = await db.certificateAuthority.findUnique({
      where: { id: caId },
    })

    if (!ca) {
      return NextResponse.json(
        { error: 'CA not found' },
        { status: 404 }
      )
    }

    if (ca.isExternal) {
      return NextResponse.json(
        { error: 'Cannot generate OCSP certificate for external CA' },
        { status: 400 }
      )
    }

    if (!ca.certificatePath || !ca.keyPath) {
      return NextResponse.json(
        { error: 'CA certificate or key path not configured' },
        { status: 400 }
      )
    }

    const ocspCertPath = '/etc/swanctl/ocsp.crt'
    const ocspKeyPath = '/etc/swanctl/ocsp.key'
    const ocspCsrPath = '/tmp/ocsp.csr'
    const ocspConfigPath = '/tmp/ocsp.cnf'

    try {
      await fs.mkdir('/etc/swanctl', { recursive: true })
    } catch {
      // Directory might already exist
    }

    // Generate OCSP signing key
    const keyGenResult = await safeExec(
      `openssl genrsa -out "${ocspKeyPath}" 4096 2>&1`,
      60000
    )
    if (!keyGenResult) {
      return NextResponse.json(
        { error: 'Failed to generate OCSP signing key' },
        { status: 500 }
      )
    }
    await fs.chmod(ocspKeyPath, 0o600)

    // Create OpenSSL config for OCSP certificate
    const ocspConfig = `
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = OCSP Signer
O = OCSP Responder

[v3_req]
basicConstraints = CA:FALSE
keyUsage = critical, digitalSignature, keyCertSign
extendedKeyUsage = OCSP Signing
subjectKeyIdentifier = hash

[ocsp_ext]
basicConstraints = CA:FALSE
keyUsage = critical, digitalSignature
extendedKeyUsage = OCSP Signing
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
`
    await fs.writeFile(ocspConfigPath, ocspConfig)

    // Generate CSR
    const csrResult = await safeExec(
      `openssl req -new -key "${ocspKeyPath}" -out "${ocspCsrPath}" -config "${ocspConfigPath}" 2>&1`,
      60000
    )
    if (!csrResult) {
      await fs.unlink(ocspKeyPath).catch(() => {})
      return NextResponse.json(
        { error: 'Failed to generate OCSP CSR' },
        { status: 500 }
      )
    }

    // Sign with CA
    const signResult = await safeExec(
      `openssl x509 -req -in "${ocspCsrPath}" -CA "${ca.certificatePath}" -CAkey "${ca.keyPath}" ` +
      `-CAcreateserial -out "${ocspCertPath}" -days 365 ` +
      `-extfile "${ocspConfigPath}" -extensions ocsp_ext 2>&1`,
      60000
    )
    if (!signResult) {
      await fs.unlink(ocspKeyPath).catch(() => {})
      await fs.unlink(ocspCsrPath).catch(() => {})
      return NextResponse.json(
        { error: 'Failed to sign OCSP certificate with CA' },
        { status: 500 }
      )
    }

    // Cleanup temp files
    await fs.unlink(ocspCsrPath).catch(() => {})
    await fs.unlink(ocspConfigPath).catch(() => {})

    // Update config with new paths
    const configRecord = await db.systemSetting.findUnique({
      where: { key: 'ocsp_config' },
    })

    const currentConfig = configRecord
      ? { ...defaultConfig, ...JSON.parse(configRecord.value) } as OcspConfig
      : defaultConfig

    await db.systemSetting.upsert({
      where: { key: 'ocsp_config' },
      create: {
        key: 'ocsp_config',
        value: JSON.stringify({
          ...currentConfig,
          ocspCertPath,
          ocspKeyPath,
          caId,
        }),
        category: 'ocsp',
        description: 'OCSP Responder Configuration',
      },
      update: {
        value: JSON.stringify({
          ...currentConfig,
          ocspCertPath,
          ocspKeyPath,
          caId,
        }),
      },
    })

    // Log audit
    try {
      await db.auditLog.create({
        data: {
          action: 'OCSP_SIGNING_CERT_GENERATED',
          category: 'PKI_MANAGEMENT',
          actorType: 'ADMIN',
          targetType: 'Certificate',
          targetId: caId,
          status: 'SUCCESS',
          details: JSON.stringify({
            ocspCertPath,
            ocspKeyPath,
            caName: ca.name,
          }),
        },
      })
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({
      success: true,
      message: 'OCSP signing certificate generated successfully',
      ocspCertPath,
      ocspKeyPath,
    })
  } catch (error) {
    console.error('Error generating OCSP certificate:', error)
    return NextResponse.json(
      { error: 'Failed to generate OCSP signing certificate' },
      { status: 500 }
    )
=======

export async function GET() {
  try {
    // Return OCSP configuration from system settings
    const settings = await db.systemSetting.findMany({
      where: { category: 'ocsp' }
    })
    
    const config = {
      isEnabled: true,
      responderUrl: 'http://localhost:3033',
      port: 3033,
      responseValiditySeconds: 3600,
      ocspCertPath: '/etc/swanctl/ocsp.crt',
      ocspKeyPath: '/etc/swanctl/ocsp.key',
      caCertPath: '/etc/swanctl/x509ca/intermediate.crt',
    }
    
    for (const setting of settings) {
      if (setting.key in config) {
        (config as Record<string, unknown>)[setting.key] = setting.value
      }
    }
    
    return NextResponse.json({ config })
  } catch (error) {
    console.error('Failed to get OCSP config:', error)
    return NextResponse.json({ error: 'Failed to get OCSP configuration' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Save OCSP configuration
    for (const [key, value] of Object.entries(body)) {
      await db.systemSetting.upsert({
        where: { key: `ocsp_${key}` },
        create: {
          key: `ocsp_${key}`,
          value: String(value),
          category: 'ocsp',
        },
        update: {
          value: String(value),
        }
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save OCSP config:', error)
    return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  }
}
