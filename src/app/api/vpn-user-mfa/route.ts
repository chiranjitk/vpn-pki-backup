import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { MfaType } from '@prisma/client'

// GET - List all VPN user MFA configurations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const mfaEnabled = searchParams.get('mfaEnabled')
    const mfaType = searchParams.get('mfaType')

    const where: any = {}

    if (userId) {
      where.userId = userId
    }

    if (mfaEnabled !== null && mfaEnabled !== undefined && mfaEnabled !== 'all') {
      where.mfaEnabled = mfaEnabled === 'true'
    }

    if (mfaType && mfaType !== 'all') {
      where.mfaType = mfaType as MfaType
    }

    const mfaConfigs = await db.vpnUserMfa.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      mfaConfigs: mfaConfigs.map((config) => ({
        id: config.id,
        userId: config.userId,
        user: config.user,
        mfaEnabled: config.mfaEnabled,
        mfaType: config.mfaType,
        smsPhoneNumber: config.smsPhoneNumber ? maskPhoneNumber(config.smsPhoneNumber) : null,
        smsVerified: config.smsVerified,
        emailMfaEnabled: config.emailMfaEnabled,
        radiusMfaEnabled: config.radiusMfaEnabled,
        radiusMfaServer: config.radiusMfaServer,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
        // Don't expose sensitive data like secrets
        hasSecret: !!config.mfaSecret,
        hasBackupCodes: !!config.mfaBackupCodes,
      })),
    })
  } catch (error) {
    console.error('Get MFA configs error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create or update MFA configuration for a VPN user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userId,
      mfaEnabled,
      mfaType,
      smsPhoneNumber,
      smsVerified,
      emailMfaEnabled,
      radiusMfaEnabled,
      radiusMfaServer,
    } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await db.vpnUser.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'VPN user not found' },
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
    if (mfaType === 'SMS' && !smsPhoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required for SMS MFA' },
        { status: 400 }
      )
    }

    // Validate RADIUS-specific fields
    if (mfaType === 'RADIUS' && !radiusMfaServer) {
      return NextResponse.json(
        { error: 'RADIUS server is required for RADIUS MFA' },
        { status: 400 }
      )
    }

    // Validate EMAIL-specific fields
    if (mfaType === 'EMAIL' && !user.email) {
      return NextResponse.json(
        { error: 'User must have an email address for EMAIL MFA' },
        { status: 400 }
      )
    }

    // Check if MFA config already exists for this user
    const existingConfig = await db.vpnUserMfa.findUnique({
      where: { userId },
    })

    let mfaConfig

    if (existingConfig) {
      // Update existing config
      mfaConfig = await db.vpnUserMfa.update({
        where: { userId },
        data: {
          mfaEnabled: mfaEnabled ?? existingConfig.mfaEnabled,
          mfaType: mfaType ?? existingConfig.mfaType,
          smsPhoneNumber: smsPhoneNumber ?? existingConfig.smsPhoneNumber,
          smsVerified: smsVerified ?? existingConfig.smsVerified,
          emailMfaEnabled: emailMfaEnabled ?? existingConfig.emailMfaEnabled,
          radiusMfaEnabled: radiusMfaEnabled ?? existingConfig.radiusMfaEnabled,
          radiusMfaServer: radiusMfaServer ?? existingConfig.radiusMfaServer,
        },
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
    } else {
      // Create new config
      mfaConfig = await db.vpnUserMfa.create({
        data: {
          userId,
          mfaEnabled: mfaEnabled ?? false,
          mfaType: mfaType ?? 'TOTP',
          smsPhoneNumber,
          smsVerified: smsVerified ?? false,
          emailMfaEnabled: emailMfaEnabled ?? false,
          radiusMfaEnabled: radiusMfaEnabled ?? false,
          radiusMfaServer,
        },
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
    }

    // Log audit
    await db.auditLog.create({
      data: {
        action: existingConfig ? 'UPDATE_MFA_CONFIG' : 'CREATE_MFA_CONFIG',
        category: 'USER_MANAGEMENT',
        actorType: 'ADMIN',
        targetId: userId,
        targetType: 'VpnUserMfa',
        details: JSON.stringify({
          username: user.username,
          mfaType: mfaConfig.mfaType,
          mfaEnabled: mfaConfig.mfaEnabled,
        }),
        status: 'SUCCESS',
      },
    })

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
        hasSecret: !!mfaConfig.mfaSecret,
        hasBackupCodes: !!mfaConfig.mfaBackupCodes,
      },
    })
  } catch (error) {
    console.error('Create/Update MFA config error:', error)
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
