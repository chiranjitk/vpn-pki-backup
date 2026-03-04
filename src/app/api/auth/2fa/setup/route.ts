import { NextRequest, NextResponse } from 'next/server'
<<<<<<< HEAD
import { db } from '@/lib/db'
import * as jwt from 'jsonwebtoken'
import { authenticator } from '@/lib/totp'
import * as QRCode from 'qrcode'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export async function POST(request: NextRequest) {
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

    // Get user
    const user = await db.adminUser.findUnique({
      where: { id: decoded.id },
=======
import * as jwt from 'jsonwebtoken'
import { generateSecret, generateURI } from 'otplib'
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

    const user = await db.adminUser.findUnique({
      where: { id: payload.id },
      select: { id: true, username: true, email: true, twoFactorEnabled: true }
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

<<<<<<< HEAD
    // Generate new secret
    const secret = authenticator.generateSecret()
    const serviceName = 'VPN PKI Manager'
    const otpauth = authenticator.keyuri(user.email, serviceName, secret)

    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(otpauth)

    // Store secret temporarily (not enabled yet)
    await db.adminUser.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret },
    })

    return NextResponse.json({
      secret,
      qrCode: qrCodeDataUrl,
      message: 'Scan the QR code with your authenticator app',
    })
  } catch (error) {
    console.error('2FA setup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
=======
    if (user.twoFactorEnabled) {
      return NextResponse.json({ error: '2FA is already enabled' }, { status: 400 })
    }

    // Generate new secret
    const secret = generateSecret()

    // Store secret temporarily (will be confirmed on verify)
    await db.adminUser.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret }
    })

    // Generate otpauth URI
    const otpauth = generateURI({
      issuer: 'VPN PKI Manager',
      label: user.email || user.username,
      secret: secret,
    })

    // Generate QR code URL using Google Chart API
    const qrCodeDataUrl = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(otpauth)}&choe=UTF-8`

    return NextResponse.json({
      qrCode: qrCodeDataUrl,
      secret,
    })
  } catch (error) {
    console.error('Failed to setup 2FA:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  }
}
