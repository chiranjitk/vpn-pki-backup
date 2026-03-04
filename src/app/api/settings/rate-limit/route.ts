<<<<<<< HEAD
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
=======
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { RATE_LIMIT_CONFIGS } from '@/lib/middleware/rate-limit'

// GET - Fetch rate limit settings
export async function GET() {
  try {
    // Get settings from database
    const setting = await db.systemSetting.findUnique({
      where: { key: 'rate_limit_settings' },
    })

    if (setting) {
      const parsed = JSON.parse(setting.value)
      return NextResponse.json(parsed)
    }

    // Return default settings
    return NextResponse.json({
      enabled: true,
      settings: {
        login: { windowMs: RATE_LIMIT_CONFIGS.login.windowMs, maxRequests: RATE_LIMIT_CONFIGS.login.maxRequests },
        certificate: { windowMs: RATE_LIMIT_CONFIGS.certificate.windowMs, maxRequests: RATE_LIMIT_CONFIGS.certificate.maxRequests },
        api: { windowMs: RATE_LIMIT_CONFIGS.api.windowMs, maxRequests: RATE_LIMIT_CONFIGS.api.maxRequests },
        passwordReset: { windowMs: RATE_LIMIT_CONFIGS.passwordReset.windowMs, maxRequests: RATE_LIMIT_CONFIGS.passwordReset.maxRequests },
        vpn: { windowMs: RATE_LIMIT_CONFIGS.vpn.windowMs, maxRequests: RATE_LIMIT_CONFIGS.vpn.maxRequests },
      },
    })
  } catch (error) {
    console.error('Failed to fetch rate limit settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  }
}

// POST - Save rate limit settings
<<<<<<< HEAD
export async function POST(request: NextRequest) {
=======
export async function POST(request: Request) {
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  try {
    const body = await request.json()
    const { enabled, settings } = body

<<<<<<< HEAD
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
=======
    // Save to database
    await db.systemSetting.upsert({
      where: { key: 'rate_limit_settings' },
      create: {
        key: 'rate_limit_settings',
        value: JSON.stringify({ enabled, settings }),
        category: 'security',
        description: 'Rate limiting configuration',
      },
      update: {
        value: JSON.stringify({ enabled, settings }),
      },
    })

    // Update runtime configuration
    if (settings) {
      // Update each category
      for (const [category, config] of Object.entries(settings)) {
        if (RATE_LIMIT_CONFIGS[category]) {
          RATE_LIMIT_CONFIGS[category].windowMs = (config as { windowMs: number }).windowMs
          RATE_LIMIT_CONFIGS[category].maxRequests = (config as { maxRequests: number }).maxRequests
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Rate limit settings saved' })
  } catch (error) {
    console.error('Failed to save rate limit settings:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  }
}
