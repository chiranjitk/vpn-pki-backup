/**
 * Send Certificate Email API
 * POST: Send PKCS#12 certificate to user via email
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getSmtpConfig,
  sendCertificateEmail,
  readPfxFile,
} from '@/lib/email/service'

// POST - Send certificate email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { certificateId } = body

    if (!certificateId) {
      return NextResponse.json(
        { error: 'Certificate ID is required' },
        { status: 400 }
      )
    }

    // Get SMTP configuration
    const smtpConfig = await getSmtpConfig()
    if (!smtpConfig) {
      return NextResponse.json(
        { error: 'SMTP is not configured or disabled' },
        { status: 400 }
      )
    }

    // Get certificate with user info
    const certificate = await db.certificate.findUnique({
      where: { id: certificateId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
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

    // Check if user has email
    if (!certificate.user.email) {
      return NextResponse.json(
        { error: 'User does not have an email address' },
        { status: 400 }
      )
    }

    // Check if certificate has PFX file
    if (!certificate.pfxPath) {
      return NextResponse.json(
        { error: 'Certificate does not have a PKCS#12 bundle. Please regenerate with PFX option enabled.' },
        { status: 400 }
      )
    }

    // Check if certificate is active
    if (certificate.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: `Cannot send email for certificate with status: ${certificate.status}` },
        { status: 400 }
      )
    }

    // Read PFX file
    const pfxBuffer = readPfxFile(certificate.pfxPath)
    if (!pfxBuffer) {
      return NextResponse.json(
        { error: 'PKCS#12 file not found on server' },
        { status: 404 }
      )
    }

    // Check if PFX password exists
    if (!certificate.pfxPassword) {
      return NextResponse.json(
        { error: 'Certificate PKCS#12 password not found' },
        { status: 400 }
      )
    }

    // Send email
    const result = await sendCertificateEmail(
      smtpConfig,
      {
        userName: certificate.user.fullName || certificate.user.username,
        userEmail: certificate.user.email,
        commonName: certificate.commonName,
        serialNumber: certificate.serialNumber,
        expiryDate: certificate.expiryDate,
        pfxPassword: certificate.pfxPassword,
      },
      pfxBuffer,
      certificate.pfxPassword
    )

    if (!result.success) {
      // Log failure
      await db.auditLog.create({
        data: {
          action: 'SEND_CERTIFICATE_EMAIL',
          category: 'CERTIFICATE_OPERATIONS',
          actorType: 'ADMIN',
          targetId: certificate.id,
          targetType: 'Certificate',
          details: JSON.stringify({
            certificateId,
            userEmail: certificate.user.email,
            error: result.error,
          }),
          status: 'FAILURE',
          errorMessage: result.error,
        },
      })

      return NextResponse.json(
        { error: `Failed to send email: ${result.error}` },
        { status: 500 }
      )
    }

    // Log success
    await db.auditLog.create({
      data: {
        action: 'SEND_CERTIFICATE_EMAIL',
        category: 'CERTIFICATE_OPERATIONS',
        actorType: 'ADMIN',
        targetId: certificate.id,
        targetType: 'Certificate',
        details: JSON.stringify({
          certificateId,
          userEmail: certificate.user.email,
          messageId: result.messageId,
        }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Certificate email sent successfully',
      messageId: result.messageId,
    })
  } catch (error) {
    console.error('Send certificate email error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
