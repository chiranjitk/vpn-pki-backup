import { NextRequest, NextResponse } from 'next/server'
<<<<<<< HEAD
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
    const { code } = body

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
=======
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
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
    await db.adminUser.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
<<<<<<< HEAD
        twoFactorSecret: null,
      },
=======
        twoFactorSecret: null
      }
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
    })

    // Log audit
    await db.auditLog.create({
      data: {
<<<<<<< HEAD
        action: '2FA_DISABLED',
=======
        action: 'DISABLE_2FA',
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
        category: 'AUTHENTICATION',
        actorId: user.id,
        actorType: 'ADMIN',
        targetId: user.id,
        targetType: 'AdminUser',
        status: 'SUCCESS',
<<<<<<< HEAD
      },
=======
      }
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
    })

    return NextResponse.json({
      success: true,
<<<<<<< HEAD
      message: 'Two-factor authentication disabled successfully',
    })
  } catch (error) {
    console.error('2FA disable error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
=======
      message: '2FA disabled successfully'
    })
  } catch (error) {
    console.error('Failed to disable 2FA:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  }
}
