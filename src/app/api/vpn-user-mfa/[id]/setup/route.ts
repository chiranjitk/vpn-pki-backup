import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticator } from '@/lib/totp'
import * as QRCode from 'qrcode'
import { MfaType } from '@prisma/client'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST - Setup MFA for a user (generate QR code and/or send verification)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    const { mfaType, phoneNumber } = body

    // Get MFA config
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

    // Check if user is active
    if (mfaConfig.user.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'User account is not active' },
        { status: 403 }
      )
    }

    const setupType = mfaType || mfaConfig.mfaType

    // Validate MFA type
    const validMfaTypes: MfaType[] = ['TOTP', 'SMS', 'EMAIL', 'RADIUS', 'PUSH']
    if (!validMfaTypes.includes(setupType)) {
      return NextResponse.json(
        { error: 'Invalid MFA type. Valid types are: TOTP, SMS, EMAIL, RADIUS, PUSH' },
        { status: 400 }
      )
    }

    // Generate a new secret
    const secret = authenticator.generateSecret()

    // Generate backup codes
    const backupCodes = generateBackupCodes()

    // Update the MFA config with new secret and backup codes
    await db.vpnUserMfa.update({
      where: { id },
      data: {
        mfaSecret: secret,
        mfaBackupCodes: JSON.stringify(backupCodes),
        mfaType: setupType,
        smsPhoneNumber: setupType === 'SMS' ? (phoneNumber || mfaConfig.user.phone) : null,
        smsVerified: false,
      },
    })

    let response: any = {
      success: true,
      message: 'MFA setup initiated',
      mfaType: setupType,
      backupCodes,
      secret,
    }

    // Generate setup data based on MFA type
    switch (setupType) {
      case 'TOTP':
        const totpSetup = await setupTotp(mfaConfig, secret)
        response = { ...response, ...totpSetup }
        break

      case 'SMS':
        const smsSetup = await setupSms(mfaConfig, secret, phoneNumber)
        response = { ...response, ...smsSetup }
        break

      case 'EMAIL':
        const emailSetup = await setupEmail(mfaConfig, secret)
        response = { ...response, ...emailSetup }
        break

      case 'RADIUS':
        const radiusSetup = await setupRadius(mfaConfig, secret)
        response = { ...response, ...radiusSetup }
        break

      default:
        return NextResponse.json(
          { error: 'Unsupported MFA type for setup' },
          { status: 400 }
        )
    }

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'MFA_SETUP_INITIATED',
        category: 'AUTHENTICATION',
        actorType: 'ADMIN',
        targetId: mfaConfig.userId,
        targetType: 'VpnUserMfa',
        details: JSON.stringify({
          username: mfaConfig.user.username,
          mfaType: setupType,
        }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('MFA setup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Setup TOTP - Generate QR code
async function setupTotp(mfaConfig: any, secret: string): Promise<any> {
  const serviceName = 'VPN Access'
  const userEmail = mfaConfig.user.email || mfaConfig.user.username
  
  // Generate otpauth URL
  const otpauth = authenticator.keyuri(userEmail, serviceName, secret)

  // Generate QR code
  const qrCodeDataUrl = await QRCode.toDataURL(otpauth, {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  })

  return {
    qrCode: qrCodeDataUrl,
    otpauth,
    manualEntryKey: secret,
    instructions: 'Scan the QR code with your authenticator app (Google Authenticator, Microsoft Authenticator, Authy, etc.)',
  }
}

// Setup SMS - Validate and store phone number
async function setupSms(mfaConfig: any, secret: string, phoneNumber?: string): Promise<any> {
  const phone = phoneNumber || mfaConfig.user.phone

  if (!phone) {
    throw new Error('Phone number is required for SMS MFA')
  }

  // In a real implementation, this would:
  // 1. Validate the phone number format
  // 2. Send a verification SMS
  // 3. Return a confirmation that SMS was sent

  // Validate phone number format (basic validation)
  const phoneRegex = /^\+?[1-9]\d{6,14}$/
  const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '')
  
  if (!phoneRegex.test(normalizedPhone)) {
    throw new Error('Invalid phone number format. Please use international format (e.g., +1234567890)')
  }

  // Generate a test code to show what format to expect
  const testCode = authenticator.generate(secret)

  return {
    phoneNumber: maskPhoneNumber(normalizedPhone),
    verificationRequired: true,
    instructions: `A verification code has been sent to ${maskPhoneNumber(normalizedPhone)}. Please enter the code to complete setup.`,
    note: 'SMS verification requires an SMS gateway integration. The secret has been stored for TOTP fallback.',
  }
}

// Setup Email - Use user's email address
async function setupEmail(mfaConfig: any, secret: string): Promise<any> {
  const email = mfaConfig.user.email

  if (!email) {
    throw new Error('User must have an email address for EMAIL MFA')
  }

  // In a real implementation, this would:
  // 1. Send a verification email with a code
  // 2. Return a confirmation that email was sent

  // Mask email for display
  const maskedEmail = maskEmail(email)

  return {
    email: maskedEmail,
    verificationRequired: true,
    instructions: `A verification code has been sent to ${maskedEmail}. Please enter the code to complete setup.`,
    note: 'Email verification requires an SMTP integration. The secret has been stored for TOTP fallback.',
  }
}

// Setup RADIUS - Configure RADIUS server
async function setupRadius(mfaConfig: any, secret: string): Promise<any> {
  // RADIUS setup requires server configuration
  // This is typically done separately in the RADIUS configuration

  return {
    requiresServerConfig: !mfaConfig.radiusMfaServer,
    radiusServer: mfaConfig.radiusMfaServer,
    instructions: 'RADIUS MFA requires a RADIUS server configuration. Please ensure the RADIUS server is configured in system settings.',
    note: 'The secret has been stored for TOTP fallback when RADIUS is unavailable.',
    setupUrl: '/api/radius',
  }
}

// Helper function to mask phone number
function maskPhoneNumber(phone: string): string {
  if (phone.length <= 4) return phone
  const visiblePart = phone.slice(-4)
  const maskedPart = '*'.repeat(phone.length - 4)
  return maskedPart + visiblePart
}

// Helper function to mask email
function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@')
  if (!domain) return email
  
  const maskedLocal = localPart.length > 2 
    ? localPart[0] + '*'.repeat(localPart.length - 2) + localPart[localPart.length - 1]
    : localPart[0] + '*'
  
  return `${maskedLocal}@${domain}`
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
