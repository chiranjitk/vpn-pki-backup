import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { compare } from 'bcryptjs'
import * as jwt from 'jsonwebtoken'
<<<<<<< HEAD
import { authenticator } from '@/lib/totp'
=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
<<<<<<< HEAD
    const { username, password, twoFactorCode, twoFactorRequired } = body
=======
    const { username, password } = body
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    // Find admin user
    const user = await db.adminUser.findUnique({
      where: { username },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    if (user.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Account is disabled or locked' },
        { status: 403 }
      )
    }

    // Verify password
    const isValid = await compare(password, user.passwordHash)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

<<<<<<< HEAD
    // Check if 2FA is enabled for this user
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      // If this is the first login step, return that 2FA is required
      if (!twoFactorCode && !twoFactorRequired) {
        return NextResponse.json({
          twoFactorRequired: true,
          message: 'Two-factor authentication code required',
          tempToken: jwt.sign(
            { id: user.id, username: user.username, role: user.role, twoFactorPending: true },
            JWT_SECRET,
            { expiresIn: '5m' } // Short-lived token for 2FA verification
          ),
        })
      }

      // Verify 2FA code
      if (twoFactorCode) {
        const isValidCode = authenticator.check(twoFactorCode, user.twoFactorSecret)
        if (!isValidCode) {
          return NextResponse.json(
            { error: 'Invalid two-factor authentication code' },
            { status: 401 }
          )
        }
      }
    }

=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
    // Update last login
    await db.adminUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    )

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'LOGIN',
        category: 'AUTHENTICATION',
        actorId: user.id,
        actorType: 'ADMIN',
        targetId: user.id,
        targetType: 'AdminUser',
        status: 'SUCCESS',
<<<<<<< HEAD
        details: user.twoFactorEnabled ? 'with 2FA' : undefined,
=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
      },
    })

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
<<<<<<< HEAD
        twoFactorEnabled: user.twoFactorEnabled,
=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
      },
      token,
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
