import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Get SMTP configuration
export async function GET() {
  try {
    const config = await db.smtpConfiguration.findFirst()

    // Don't return password
    if (config) {
      return NextResponse.json({
        config: {
          id: config.id,
          host: config.host,
          port: config.port,
          username: config.username,
          fromEmail: config.fromEmail,
          fromName: config.fromName,
          useTls: config.useTls,
          isEnabled: config.isEnabled,
        },
      })
    }

    return NextResponse.json({ config: null })
  } catch (error) {
    console.error('Get SMTP config error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Save SMTP configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { host, port, username, password, fromEmail, fromName, useTls, isEnabled } = body

    // Check if config exists
    const existing = await db.smtpConfiguration.findFirst()

    let config
    if (existing) {
      config = await db.smtpConfiguration.update({
        where: { id: existing.id },
        data: {
          host,
          port: port || 587,
          username: username || null,
          password: password || existing.password, // Keep existing if not provided
          fromEmail,
          fromName: fromName || 'VPN PKI Manager',
          useTls: useTls ?? true,
          isEnabled: isEnabled ?? false,
        },
      })
    } else {
      config = await db.smtpConfiguration.create({
        data: {
          host,
          port: port || 587,
          username: username || null,
          password: password || null,
          fromEmail,
          fromName: fromName || 'VPN PKI Manager',
          useTls: useTls ?? true,
          isEnabled: isEnabled ?? false,
        },
      })
    }

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'UPDATE_SMTP_CONFIG',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        details: JSON.stringify({ host, port, isEnabled }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({
      success: true,
      config: {
        id: config.id,
        host: config.host,
        port: config.port,
        username: config.username,
        fromEmail: config.fromEmail,
        fromName: config.fromName,
        useTls: config.useTls,
        isEnabled: config.isEnabled,
      },
    })
  } catch (error) {
    console.error('Save SMTP config error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
