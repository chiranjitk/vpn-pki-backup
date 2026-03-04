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
    const { code } = body

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

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json({ error: '2FA is not enabled' }, { status: 400 })
    }

    // Verify the TOTP code
    const result = verifySync({
      secret: user.twoFactorSecret,
      token: code,
    })

    if (!result.valid) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
    }

    // Disable 2FA and clear secret
    await db.adminUser.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null
      }
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'DISABLE_2FA',
        category: 'AUTHENTICATION',
        actorId: user.id,
        actorType: 'ADMIN',
        targetId: user.id,
        targetType: 'AdminUser',
        status: 'SUCCESS',
      }
    })

    return NextResponse.json({
      success: true,
      message: '2FA disabled successfully'
    })
  } catch (error) {
    console.error('Failed to disable 2FA:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
