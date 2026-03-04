import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Get rate limit settings
export async function GET() {
  try {
    const settings = await db.systemSetting.findMany({
      where: { category: 'rate-limit' },
    })

    const enabled = settings.find(s => s.key === 'rate-limit-enabled')
    const config = settings.find(s => s.key === 'rate-limit-config')

    return NextResponse.json({
      enabled: enabled?.value === 'true',
      settings: config ? JSON.parse(config.value) : null,
    })
  } catch (error) {
    console.error('Failed to fetch rate limit settings:', error)
    return NextResponse.json({
      enabled: true,
      settings: null,
    })
  }
}

// POST - Save rate limit settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { enabled, settings } = body

    // Save enabled status
    await db.systemSetting.upsert({
      where: { key: 'rate-limit-enabled' },
      create: {
        key: 'rate-limit-enabled',
        value: String(enabled),
        category: 'rate-limit',
        description: 'Enable/disable rate limiting',
      },
      update: {
        value: String(enabled),
      },
    })

    // Save config
    if (settings) {
      await db.systemSetting.upsert({
        where: { key: 'rate-limit-config' },
        create: {
          key: 'rate-limit-config',
          value: JSON.stringify(settings),
          category: 'rate-limit',
          description: 'Rate limit configuration',
        },
        update: {
          value: JSON.stringify(settings),
        },
      })
    }

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'UPDATE_RATE_LIMIT_SETTINGS',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'SystemSetting',
        details: JSON.stringify({ enabled }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save rate limit settings:', error)
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    )
  }
}
