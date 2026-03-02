import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as fs from 'fs'

// GET - Download certificate
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'pem'

    const certificate = await db.certificate.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            username: true,
            email: true,
          },
        },
      },
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
      case 'pfx':
        if (!certificate.pfxPath || !fs.existsSync(certificate.pfxPath)) {
          return NextResponse.json(
            { error: 'PKCS#12 bundle not available for this certificate' },
            { status: 404 }
          )
        }
        filePath = certificate.pfxPath
        contentType = 'application/x-pkcs12'
        filename = `${certificate.user.username}.pfx`
        break

      case 'key':
        const keyPath = certificate.certificatePath?.replace('.pem', '.key')
        if (!keyPath || !fs.existsSync(keyPath)) {
          return NextResponse.json(
            { error: 'Private key not available' },
            { status: 404 }
          )
        }
        filePath = keyPath
        contentType = 'application/x-pem-file'
        filename = `${certificate.user.username}.key`
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
        filename = `${certificate.user.username}.pem`
    }

    const fileContent = fs.readFileSync(filePath)

    // Log download
    await db.auditLog.create({
      data: {
        action: 'DOWNLOAD_CERTIFICATE',
        category: 'CERTIFICATE_OPERATIONS',
        actorType: 'ADMIN',
        targetId: certificate.id,
        targetType: 'Certificate',
        details: JSON.stringify({
          serialNumber: certificate.serialNumber,
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
    console.error('Download certificate error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Revoke certificate
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const reason = searchParams.get('reason') || 'UNSPECIFIED'

    const certificate = await db.certificate.findUnique({
      where: { id },
    })

    if (!certificate) {
      return NextResponse.json(
        { error: 'Certificate not found' },
        { status: 404 }
      )
    }

    if (certificate.status === 'REVOKED') {
      return NextResponse.json(
        { error: 'Certificate is already revoked' },
        { status: 400 }
      )
    }

    // Create revocation record
    const revocation = await db.revocation.create({
      data: {
        certificateId: id,
        reason: reason as any,
        revokedBy: 'admin',
        notes: 'Revoked via API',
      },
    })

    // Update certificate status
    await db.certificate.update({
      where: { id },
      data: { status: 'REVOKED' },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'REVOKE_CERTIFICATE',
        category: 'REVOCATION',
        actorType: 'ADMIN',
        targetId: id,
        targetType: 'Certificate',
        details: JSON.stringify({
          serialNumber: certificate.serialNumber,
          reason,
        }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({
      success: true,
      revocation: {
        id: revocation.id,
        reason: revocation.reason,
        revokedAt: revocation.revokedAt,
      },
    })
  } catch (error) {
    console.error('Revoke certificate error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
