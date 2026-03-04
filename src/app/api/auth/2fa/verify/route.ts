import { NextRequest, NextResponse } from 'next/server'
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
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

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
      })

      // Log audit
      await db.auditLog.create({
        data: {
          action: 'ENABLE_2FA',
          category: 'AUTHENTICATION',
          actorId: user.id,
          actorType: 'ADMIN',
          targetId: user.id,
          targetType: 'AdminUser',
          status: 'SUCCESS',
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
  }
}
