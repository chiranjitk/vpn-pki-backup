import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as fs from 'fs'

// GET - Download server certificate
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
      return NextResponse.json(
        { error: 'Certificate not found' },
        { status: 404 }
      )
    }

    let filePath: string
    let contentType: string
    let filename: string

    switch (format) {
      case 'key':
        if (!certificate.keyPath || !fs.existsSync(certificate.keyPath)) {
          return NextResponse.json(
            { error: 'Private key not available' },
            { status: 404 }
          )
        }
        filePath = certificate.keyPath
        contentType = 'application/x-pem-file'
        filename = `${certificate.hostname}.key`
        break

      case 'pem':
      default:
        if (!certificate.certificatePath || !fs.existsSync(certificate.certificatePath)) {
          return NextResponse.json(
            { error: 'Certificate file not found' },
            { status: 404 }
          )
        }
        filePath = certificate.certificatePath
        contentType = 'application/x-pem-file'
        filename = `${certificate.hostname}.pem`
    }

    const fileContent = fs.readFileSync(filePath)

    // Log download
    await db.auditLog.create({
      data: {
        action: 'DOWNLOAD_SERVER_CERTIFICATE',
        category: 'CERTIFICATE_OPERATIONS',
        actorType: 'ADMIN',
        targetId: certificate.id,
        targetType: 'ServerCertificate',
        details: JSON.stringify({
          hostname: certificate.hostname,
          format,
        }),
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete server certificate
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const certificate = await db.serverCertificate.findUnique({
      where: { id },
    })

    if (!certificate) {
      return NextResponse.json(
        { error: 'Certificate not found' },
        { status: 404 }
      )
    }

    // Prevent deletion of deployed certificates
    if (certificate.isDeployed) {
      return NextResponse.json(
        { error: 'Cannot delete a deployed certificate. Please deploy another certificate first.' },
        { status: 400 }
      )
    }

    // Delete certificate files
    if (certificate.certificatePath && fs.existsSync(certificate.certificatePath)) {
      fs.unlinkSync(certificate.certificatePath)
    }
    if (certificate.keyPath && fs.existsSync(certificate.keyPath)) {
      fs.unlinkSync(certificate.keyPath)
    }
    if (certificate.csrPath && fs.existsSync(certificate.csrPath)) {
      fs.unlinkSync(certificate.csrPath)
    }

    // Delete from database
    await db.serverCertificate.delete({
      where: { id },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'DELETE_SERVER_CERTIFICATE',
        category: 'CERTIFICATE_OPERATIONS',
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete server certificate error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
