import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { MfaType } from '@prisma/client'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET - Get specific MFA configuration by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const mfaConfig = await db.vpnUserMfa.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
            phone: true,
            status: true,
          },
        },
      },
    })

    if (!mfaConfig) {
      return NextResponse.json(
        { error: 'MFA configuration not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      mfaConfig: {
        id: mfaConfig.id,
        userId: mfaConfig.userId,
        user: mfaConfig.user,
        mfaEnabled: mfaConfig.mfaEnabled,
        mfaType: mfaConfig.mfaType,
        smsPhoneNumber: mfaConfig.smsPhoneNumber ? maskPhoneNumber(mfaConfig.smsPhoneNumber) : null,
        smsVerified: mfaConfig.smsVerified,
        emailMfaEnabled: mfaConfig.emailMfaEnabled,
        radiusMfaEnabled: mfaConfig.radiusMfaEnabled,
        radiusMfaServer: mfaConfig.radiusMfaServer,
        createdAt: mfaConfig.createdAt,
        updatedAt: mfaConfig.updatedAt,
        // Don't expose sensitive data
        hasSecret: !!mfaConfig.mfaSecret,
        hasBackupCodes: !!mfaConfig.mfaBackupCodes,
        backupCodesCount: mfaConfig.mfaBackupCodes 
          ? JSON.parse(mfaConfig.mfaBackupCodes).length 
          : 0,
      },
    })
  } catch (error) {
    console.error('Get MFA config error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update MFA configuration
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      mfaEnabled,
      mfaType,
      smsPhoneNumber,
      smsVerified,
      emailMfaEnabled,
      radiusMfaEnabled,
      radiusMfaServer,
      regenerateBackupCodes,
    } = body

    // Check if MFA config exists
    const existingConfig = await db.vpnUserMfa.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    })

    if (!existingConfig) {
      return NextResponse.json(
        { error: 'MFA configuration not found' },
        { status: 404 }
      )
    }

    // Validate MFA type
    const validMfaTypes: MfaType[] = ['TOTP', 'SMS', 'EMAIL', 'RADIUS', 'PUSH']
    if (mfaType && !validMfaTypes.includes(mfaType)) {
      return NextResponse.json(
        { error: 'Invalid MFA type. Valid types are: TOTP, SMS, EMAIL, RADIUS, PUSH' },
        { status: 400 }
      )
    }

    // Validate SMS-specific fields
    if (mfaType === 'SMS' && !smsPhoneNumber && !existingConfig.smsPhoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required for SMS MFA' },
        { status: 400 }
      )
    }

    // Validate RADIUS-specific fields
    if (mfaType === 'RADIUS' && !radiusMfaServer && !existingConfig.radiusMfaServer) {
      return NextResponse.json(
        { error: 'RADIUS server is required for RADIUS MFA' },
        { status: 400 }
      )
    }

    // Validate EMAIL-specific fields
    if (mfaType === 'EMAIL' && !existingConfig.user.email) {
      return NextResponse.json(
        { error: 'User must have an email address for EMAIL MFA' },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData: any = {}

    if (mfaEnabled !== undefined) updateData.mfaEnabled = mfaEnabled
    if (mfaType !== undefined) updateData.mfaType = mfaType
    if (smsPhoneNumber !== undefined) updateData.smsPhoneNumber = smsPhoneNumber
    if (smsVerified !== undefined) updateData.smsVerified = smsVerified
    if (emailMfaEnabled !== undefined) updateData.emailMfaEnabled = emailMfaEnabled
    if (radiusMfaEnabled !== undefined) updateData.radiusMfaEnabled = radiusMfaEnabled
    if (radiusMfaServer !== undefined) updateData.radiusMfaServer = radiusMfaServer

    // Handle backup codes regeneration
    if (regenerateBackupCodes) {
      const backupCodes = generateBackupCodes()
      updateData.mfaBackupCodes = JSON.stringify(backupCodes)
    }

    // Update MFA config
    const mfaConfig = await db.vpnUserMfa.update({
      where: { id },
      data: updateData,
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

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'UPDATE_MFA_CONFIG',
        category: 'USER_MANAGEMENT',
        actorType: 'ADMIN',
        targetId: mfaConfig.userId,
        targetType: 'VpnUserMfa',
        details: JSON.stringify({
          username: mfaConfig.user.username,
          mfaType: mfaConfig.mfaType,
          mfaEnabled: mfaConfig.mfaEnabled,
          regeneratedBackupCodes: regenerateBackupCodes,
        }),
        status: 'SUCCESS',
      },
    })

    const response: any = {
      mfaConfig: {
        id: mfaConfig.id,
        userId: mfaConfig.userId,
        user: mfaConfig.user,
        mfaEnabled: mfaConfig.mfaEnabled,
        mfaType: mfaConfig.mfaType,
        smsPhoneNumber: mfaConfig.smsPhoneNumber ? maskPhoneNumber(mfaConfig.smsPhoneNumber) : null,
        smsVerified: mfaConfig.smsVerified,
        emailMfaEnabled: mfaConfig.emailMfaEnabled,
        radiusMfaEnabled: mfaConfig.radiusMfaEnabled,
        radiusMfaServer: mfaConfig.radiusMfaServer,
        createdAt: mfaConfig.createdAt,
        updatedAt: mfaConfig.updatedAt,
        hasSecret: !!mfaConfig.mfaSecret,
        hasBackupCodes: !!mfaConfig.mfaBackupCodes,
      },
    }

    // Include new backup codes if regenerated
    if (regenerateBackupCodes && mfaConfig.mfaBackupCodes) {
      response.backupCodes = JSON.parse(mfaConfig.mfaBackupCodes)
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Update MFA config error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete MFA configuration
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Check if MFA config exists
    const existingConfig = await db.vpnUserMfa.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    })

    if (!existingConfig) {
      return NextResponse.json(
        { error: 'MFA configuration not found' },
        { status: 404 }
      )
    }

    // Delete MFA config
    await db.vpnUserMfa.delete({
      where: { id },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'DELETE_MFA_CONFIG',
        category: 'USER_MANAGEMENT',
        actorType: 'ADMIN',
        targetId: existingConfig.userId,
        targetType: 'VpnUserMfa',
        details: JSON.stringify({
          username: existingConfig.user.username,
        }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'MFA configuration deleted successfully',
    })
  } catch (error) {
    console.error('Delete MFA config error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to mask phone number
function maskPhoneNumber(phone: string): string {
  if (phone.length <= 4) return phone
  const visiblePart = phone.slice(-4)
  const maskedPart = '*'.repeat(phone.length - 4)
  return maskedPart + visiblePart
}

// Helper function to generate backup codes
function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    codes.push(code)
  }
  return codes
}
