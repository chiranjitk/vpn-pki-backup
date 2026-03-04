import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as fs from 'fs'
import * as path from 'path'
import { getPKIPaths } from '@/lib/pki/config'
import { reloadStrongSwan } from '@/lib/pki/strongswan'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const certificate = await db.serverCertificate.findUnique({
      where: { id },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    if (!certificate.certificatePath || !certificate.keyPath) {
      return NextResponse.json({ error: 'Certificate files not found' }, { status: 400 })
    }

    if (!fs.existsSync(certificate.certificatePath) || !fs.existsSync(certificate.keyPath)) {
      return NextResponse.json({ error: 'Certificate files do not exist' }, { status: 400 })
    }

    // Get PKI paths
    const paths = getPKIPaths()

    // Deploy to strongSwan paths
    const destCert = path.join(paths.clientCertsPath, 'vpn-server.pem')
    const destKey = path.join(paths.clientKeysPath, 'vpn-server.key')

    // Backup existing if exists
    if (fs.existsSync(destCert)) {
      fs.copyFileSync(destCert, `${destCert}.backup`)
    }
    if (fs.existsSync(destKey)) {
      fs.copyFileSync(destKey, `${destKey}.backup`)
    }

    // Deploy new certificate
    fs.copyFileSync(certificate.certificatePath, destCert)
    fs.copyFileSync(certificate.keyPath, destKey)

    // Mark previous deployed certificate as not deployed
    await db.serverCertificate.updateMany({
      where: { isDeployed: true, id: { not: id } },
      data: { isDeployed: false },
    })

    // Mark this certificate as deployed
    await db.serverCertificate.update({
      where: { id },
      data: { isDeployed: true, deployedAt: new Date() },
    })

    // Get config for auto-reload
    const config = await db.pkiConfiguration.findFirst()

    // Reload strongSwan
    if (config?.autoReloadStrongswan) {
      try {
        await reloadStrongSwan()
      } catch (e) {
        console.error('Failed to reload strongSwan:', e)
      }
    }

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'DEPLOY_SERVER_CERTIFICATE',
        category: 'VPN_INTEGRATION',
        actorType: 'ADMIN',
        targetId: id,
        targetType: 'ServerCertificate',
        details: JSON.stringify({
          hostname: certificate.hostname,
          serialNumber: certificate.serialNumber,
        }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({
      success: true,
      message: `Certificate for ${certificate.hostname} deployed successfully`,
      deployedAt: new Date(),
    })
  } catch (error) {
    console.error('Deploy server certificate error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
