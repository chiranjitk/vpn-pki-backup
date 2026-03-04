import { NextRequest, NextResponse } from 'next/server'
<<<<<<< HEAD
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
=======
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
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
      select: {
        id: true,
        username: true,
        email: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
<<<<<<< HEAD
      },
=======
      }
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
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
<<<<<<< HEAD
    console.error('2FA status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
=======
    console.error('Failed to fetch 2FA status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  }
}
