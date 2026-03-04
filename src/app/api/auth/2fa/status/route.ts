import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export async function GET(request: NextRequest) {
  try {
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

    // Get user's 2FA status
    const user = await db.adminUser.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        username: true,
        email: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      twoFactorEnabled: user.twoFactorEnabled,
      hasSecret: !!user.twoFactorSecret,
      email: user.email,
    })
  } catch (error) {
    console.error('2FA status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
