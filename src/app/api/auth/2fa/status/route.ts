import { NextRequest, NextResponse } from 'next/server'
import * as jwt from 'jsonwebtoken'
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

export async function GET(request: NextRequest) {
  try {
    const payload = verifyToken(request)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await db.adminUser.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        username: true,
        email: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      }
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
    console.error('Failed to fetch 2FA status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
