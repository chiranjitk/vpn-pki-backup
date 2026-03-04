import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as fs from 'fs'

// DELETE - Permanently delete a certificate
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const certificate = await db.certificate.findUnique({
      where: { id },
      include: {
        revocation: true,
        user: {
          select: { username: true }
        }
      },
    })

    if (!certificate) {
      return NextResponse.json(
        { error: 'Certificate not found' },
        { status: 404 }
      )
    }

    // Only allow deletion of revoked or expired certificates
    if (certificate.status === 'ACTIVE') {
      return NextResponse.json(
        { error: 'Cannot delete active certificates. Revoke the certificate first.' },
        { status: 400 }
      )
    }

    // Delete certificate files
    if (certificate.certificatePath && fs.existsSync(certificate.certificatePath)) {
      fs.unlinkSync(certificate.certificatePath)
    }
    if (certificate.pfxPath && fs.existsSync(certificate.pfxPath)) {
      fs.unlinkSync(certificate.pfxPath)
    }
    // Try to delete key file
    const keyPath = certificate.certificatePath?.replace('.pem', '.key')
    if (keyPath && fs.existsSync(keyPath)) {
      fs.unlinkSync(keyPath)
    }

    // Delete revocation record if exists
    if (certificate.revocation) {
      await db.revocation.delete({
        where: { certificateId: id },
      })
    }

    // Delete certificate from database
    await db.certificate.delete({
      where: { id },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'DELETE_CERTIFICATE',
        category: 'CERTIFICATE_OPERATIONS',
        actorType: 'ADMIN',
        targetId: id,
        targetType: 'Certificate',
        details: JSON.stringify({
          serialNumber: certificate.serialNumber,
          commonName: certificate.commonName,
          username: certificate.user?.username,
        }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete certificate error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
