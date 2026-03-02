import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as fs from 'fs'

// GET - Download CA certificate or CRL
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'ca'

    if (type === 'ca') {
      // Get CA certificate
      const ca = await db.certificateAuthority.findFirst({
        where: { isDefault: true, status: 'ACTIVE' }
      })

      if (!ca || !ca.certificatePath) {
        return NextResponse.json(
          { error: 'CA certificate not found' },
          { status: 404 }
        )
      }

      if (!fs.existsSync(ca.certificatePath)) {
        return NextResponse.json(
          { error: 'CA certificate file not found' },
          { status: 404 }
        )
      }

      const fileContent = fs.readFileSync(ca.certificatePath)
      const filename = `${ca.name.replace(/\s+/g, '_')}.pem`

      return new NextResponse(fileContent, {
        headers: {
          'Content-Type': 'application/x-pem-file',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': fileContent.length.toString(),
        },
      })
    }

    if (type === 'crl') {
      // Get CRL
      const crlInfo = await db.crlInfo.findFirst()

      if (!crlInfo || !crlInfo.filePath) {
        return NextResponse.json(
          { error: 'CRL not found. Generate it first.' },
          { status: 404 }
        )
      }

      if (!fs.existsSync(crlInfo.filePath)) {
        return NextResponse.json(
          { error: 'CRL file not found' },
          { status: 404 }
        )
      }

      const fileContent = fs.readFileSync(crlInfo.filePath)

      return new NextResponse(fileContent, {
        headers: {
          'Content-Type': 'application/x-pem-file',
          'Content-Disposition': 'attachment; filename="ca.crl.pem"',
          'Content-Length': fileContent.length.toString(),
        },
      })
    }

    if (type === 'key') {
      // Get CA private key (restricted access)
      const ca = await db.certificateAuthority.findFirst({
        where: { isDefault: true, status: 'ACTIVE' }
      })

      if (!ca || !ca.keyPath) {
        return NextResponse.json(
          { error: 'CA key not found' },
          { status: 404 }
        )
      }

      if (!fs.existsSync(ca.keyPath)) {
        return NextResponse.json(
          { error: 'CA key file not found' },
          { status: 404 }
        )
      }

      const fileContent = fs.readFileSync(ca.keyPath)
      const filename = `${ca.name.replace(/\s+/g, '_')}.key`

      // Log audit for key download
      await db.auditLog.create({
        data: {
          action: 'DOWNLOAD_CA_KEY',
          category: 'CA_OPERATIONS',
          actorType: 'ADMIN',
          targetType: 'CertificateAuthority',
          details: JSON.stringify({ caId: ca.id, caName: ca.name }),
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

    return NextResponse.json(
      { error: 'Invalid download type' },
      { status: 400 }
    )
  } catch (error) {
    console.error('PKI download error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
