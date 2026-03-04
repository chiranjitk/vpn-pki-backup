import { NextRequest, NextResponse } from 'next/server'
<<<<<<< HEAD
import { db } from '@/lib/db'
import * as jwt from 'jsonwebtoken'
import { authenticator } from '@/lib/totp'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, enableTwoFactor } = body

    if (!code) {
      return NextResponse.json({ error: 'Verification code is required' }, { status: 400 })
    }

    // Get token from Authorization header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify token
    let decoded: { id: string; username: string; role: string }
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string; role: string }
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Get user
    const user = await db.adminUser.findUnique({
      where: { id: decoded.id },
=======
import * as jwt from 'jsonwebtoken'
import { verifySync } from 'otplib'
import { db } from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

interface JwtPayload {
  id: string
  username: string
  role: string
  iat: number
  exp: number
}

function verifyToken(request: NextRequest): JwtPayload | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = verifyToken(request)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { code, enableTwoFactor } = body

    if (!code || code.length !== 6) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
    }

    const user = await db.adminUser.findUnique({
      where: { id: payload.id },
      select: { id: true, username: true, twoFactorEnabled: true, twoFactorSecret: true }
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

<<<<<<< HEAD
    // Check if 2FA is already enabled or we're enabling it
    const secret = user.twoFactorSecret
    if (!secret) {
      return NextResponse.json({ error: '2FA not set up. Please set up 2FA first.' }, { status: 400 })
    }

    // Verify the code
    const isValid = authenticator.check(code, secret)

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
    }

    // If this is to enable 2FA
    if (enableTwoFactor) {
      await db.adminUser.update({
        where: { id: user.id },
        data: { twoFactorEnabled: true },
=======
    if (!user.twoFactorSecret) {
      return NextResponse.json({ error: 'No 2FA setup in progress' }, { status: 400 })
    }

    // Verify the TOTP code
    const result = verifySync({
      secret: user.twoFactorSecret,
      token: code,
    })

    if (!result.valid) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
    }

    // Enable 2FA if requested
    if (enableTwoFactor) {
      await db.adminUser.update({
        where: { id: user.id },
        data: { twoFactorEnabled: true }
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
      })

      // Log audit
      await db.auditLog.create({
        data: {
<<<<<<< HEAD
          action: '2FA_ENABLED',
=======
          action: 'ENABLE_2FA',
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
          category: 'AUTHENTICATION',
          actorId: user.id,
          actorType: 'ADMIN',
          targetId: user.id,
          targetType: 'AdminUser',
          status: 'SUCCESS',
<<<<<<< HEAD
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Two-factor authentication enabled successfully',
      })
    }

    // Otherwise, just return success (for verification during login)
    return NextResponse.json({
      success: true,
      message: 'Code verified successfully',
    })
  } catch (error) {
    console.error('2FA verify error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
=======
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: enableTwoFactor ? '2FA enabled successfully' : 'Code verified successfully'
    })
  } catch (error) {
    console.error('Failed to verify 2FA:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  }
}
