import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticator } from '@/lib/totp'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST - Verify MFA code for a user
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    const { code, mfaType } = body

    if (!code) {
      return NextResponse.json(
        { error: 'Verification code is required' },
        { status: 400 }
      )
    }

    // Get MFA config
    const mfaConfig = await db.vpnUserMfa.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
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

    // Check if user is active
    if (mfaConfig.user.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'User account is not active' },
        { status: 403 }
      )
    }

    // Check if MFA is enabled
    if (!mfaConfig.mfaEnabled) {
      return NextResponse.json(
        { error: 'MFA is not enabled for this user' },
        { status: 400 }
      )
    }

    const verificationType = mfaType || mfaConfig.mfaType
    let isValid = false
    let verificationMethod = ''

    // Verify based on MFA type
    switch (verificationType) {
      case 'TOTP':
        isValid = await verifyTotpCode(code, mfaConfig.mfaSecret)
        verificationMethod = 'TOTP'
        break

      case 'SMS':
        isValid = await verifySmsCode(code, mfaConfig)
        verificationMethod = 'SMS'
        break

      case 'EMAIL':
        isValid = await verifyEmailCode(code, mfaConfig)
        verificationMethod = 'EMAIL'
        break

      case 'RADIUS':
        isValid = await verifyRadiusCode(code, mfaConfig)
        verificationMethod = 'RADIUS'
        break

      default:
        return NextResponse.json(
          { error: 'Unsupported MFA type' },
          { status: 400 }
        )
    }

    // Check backup codes if primary verification failed
    if (!isValid && mfaConfig.mfaBackupCodes) {
      const backupCodes = JSON.parse(mfaConfig.mfaBackupCodes)
      const codeIndex = backupCodes.indexOf(code.toUpperCase())
      
      if (codeIndex !== -1) {
        isValid = true
        verificationMethod = 'BACKUP_CODE'
        
        // Remove used backup code
        backupCodes.splice(codeIndex, 1)
        await db.vpnUserMfa.update({
          where: { id },
          data: {
            mfaBackupCodes: backupCodes.length > 0 ? JSON.stringify(backupCodes) : null,
          },
        })
      }
    }

    if (!isValid) {
      // Log failed verification attempt
      await db.auditLog.create({
        data: {
          action: 'MFA_VERIFICATION_FAILED',
          category: 'AUTHENTICATION',
          actorType: 'API',
          targetId: mfaConfig.userId,
          targetType: 'VpnUser',
          details: JSON.stringify({
            username: mfaConfig.user.username,
            mfaType: verificationType,
          }),
          status: 'FAILURE',
        },
      })

      return NextResponse.json(
        { error: 'Invalid verification code', success: false },
        { status: 400 }
      )
    }

    // Log successful verification
    await db.auditLog.create({
      data: {
        action: 'MFA_VERIFICATION_SUCCESS',
        category: 'AUTHENTICATION',
        actorType: 'API',
        targetId: mfaConfig.userId,
        targetType: 'VpnUser',
        details: JSON.stringify({
          username: mfaConfig.user.username,
          verificationMethod,
        }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'MFA code verified successfully',
      verificationMethod,
      user: {
        id: mfaConfig.user.id,
        username: mfaConfig.user.username,
        email: mfaConfig.user.email,
      },
    })
  } catch (error) {
    console.error('MFA verify error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Verify TOTP code
async function verifyTotpCode(code: string, secret: string | null): Promise<boolean> {
  if (!secret) {
    return false
  }

  try {
    return authenticator.check(code, secret)
  } catch (error) {
    console.error('TOTP verification error:', error)
    return false
  }
}

// Verify SMS code (placeholder - would integrate with SMS provider)
async function verifySmsCode(code: string, mfaConfig: any): Promise<boolean> {
  // In a real implementation, this would:
  // 1. Check if the code matches the most recent SMS sent
  // 2. Check if the code hasn't expired
  // 3. Check if the code hasn't been used already
  
  // For now, we'll use TOTP-based verification with the secret
  // This allows SMS codes to be time-based like TOTP
  if (!mfaConfig.mfaSecret) {
    return false
  }

  try {
    return authenticator.check(code, mfaConfig.mfaSecret)
  } catch (error) {
    console.error('SMS verification error:', error)
    return false
  }
}

// Verify Email code (placeholder - would integrate with email provider)
async function verifyEmailCode(code: string, mfaConfig: any): Promise<boolean> {
  // In a real implementation, this would:
  // 1. Check if the code matches the most recent email sent
  // 2. Check if the code hasn't expired
  // 3. Check if the code hasn't been used already
  
  // For now, we'll use TOTP-based verification with the secret
  // This allows email codes to be time-based like TOTP
  if (!mfaConfig.mfaSecret) {
    return false
  }

  try {
    return authenticator.check(code, mfaConfig.mfaSecret)
  } catch (error) {
    console.error('Email verification error:', error)
    return false
  }
}

// Verify RADIUS code (placeholder - would integrate with RADIUS server)
async function verifyRadiusCode(code: string, mfaConfig: any): Promise<boolean> {
  // In a real implementation, this would:
  // 1. Connect to the configured RADIUS server
  // 2. Send the authentication request
  // 3. Return the result
  
  // For now, we'll use TOTP-based verification with the secret
  // This allows RADIUS integration to fall back to TOTP
  if (!mfaConfig.mfaSecret) {
    return false
  }

  try {
    return authenticator.check(code, mfaConfig.mfaSecret)
  } catch (error) {
    console.error('RADIUS verification error:', error)
    return false
  }
}
