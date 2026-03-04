import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as jwt from 'jsonwebtoken'
import { authenticator } from '@/lib/totp'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, password } = body

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
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify 2FA code if enabled
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!code) {
        return NextResponse.json({ error: 'Verification code is required' }, { status: 400 })
      }

      const isValid = authenticator.check(code, user.twoFactorSecret)
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
      }
    }

    // Disable 2FA
    await db.adminUser.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: '2FA_DISABLED',
        category: 'AUTHENTICATION',
        actorId: user.id,
        actorType: 'ADMIN',
        targetId: user.id,
        targetType: 'AdminUser',
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication disabled successfully',
    })
  } catch (error) {
    console.error('2FA disable error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
