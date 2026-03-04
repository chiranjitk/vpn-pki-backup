import { NextRequest, NextResponse } from 'next/server'
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
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

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
  }
}
