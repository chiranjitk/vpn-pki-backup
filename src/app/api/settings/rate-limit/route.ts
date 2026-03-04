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
  }
}

// POST - Save rate limit settings
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { enabled, settings } = body

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
  }
}
