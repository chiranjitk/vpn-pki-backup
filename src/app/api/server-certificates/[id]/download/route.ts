import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as fs from 'fs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'pem'

    const certificate = await db.serverCertificate.findUnique({
      where: { id },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    let filePath: string | null = null
    let filename: string
    let contentType: string

    switch (format) {
      case 'pem':
        filePath = certificate.certificatePath
        filename = `${certificate.hostname}.pem`
        contentType = 'application/x-pem-file'
        break
      case 'key':
        filePath = certificate.keyPath
        filename = `${certificate.hostname}.key`
        contentType = 'application/x-pem-file'
        break
      default:
        return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const fileContent = fs.readFileSync(filePath)

    // Log download
    await db.auditLog.create({
      data: {
        action: 'DOWNLOAD_SERVER_CERTIFICATE',
        category: 'CERTIFICATE_OPERATIONS',
        actorType: 'ADMIN',
        targetId: id,
        targetType: 'ServerCertificate',
        details: JSON.stringify({ serialNumber: certificate.serialNumber, format }),
        status: 'SUCCESS',
      },
    })

    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileContent.length.toString(),
      },
    })
  } catch (error) {
    console.error('Download server certificate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
