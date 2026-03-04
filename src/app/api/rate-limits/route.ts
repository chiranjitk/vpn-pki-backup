import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { RateLimitScope, RateLimitAction } from '@prisma/client'

// GET - List all rate limit configurations
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const scope = searchParams.get('scope') as RateLimitScope | null
    const action = searchParams.get('action') as RateLimitAction | null
    const isEnabled = searchParams.get('isEnabled')
    const search = searchParams.get('search')

    const where: {
      scope?: RateLimitScope
      action?: RateLimitAction
      isEnabled?: boolean
      OR?: Array<{ name: { contains: string } }>
    } = {}

    if (scope && Object.values(RateLimitScope).includes(scope)) {
      where.scope = scope
    }
    if (action && Object.values(RateLimitAction).includes(action)) {
      where.action = action
    }
    if (isEnabled !== null) {
      where.isEnabled = isEnabled === 'true'
    }
    if (search) {
      where.OR = [{ name: { contains: search } }]
    }

    const configs = await db.rateLimitConfig.findMany({
      where,
      orderBy: [{ scope: 'asc' }, { createdAt: 'desc' }],
    })

    // Calculate summary statistics
    const summary = {
      total: configs.length,
      enabled: configs.filter((c) => c.isEnabled).length,
      disabled: configs.filter((c) => !c.isEnabled).length,
      totalRequests: configs.reduce((sum, c) => sum + c.totalRequests, 0),
      totalBlocked: configs.reduce((sum, c) => sum + c.totalBlocked, 0),
      byScope: {
        GLOBAL: configs.filter((c) => c.scope === 'GLOBAL').length,
        VPN: configs.filter((c) => c.scope === 'VPN').length,
        API: configs.filter((c) => c.scope === 'API').length,
        PER_USER: configs.filter((c) => c.scope === 'PER_USER').length,
        PER_IP: configs.filter((c) => c.scope === 'PER_IP').length,
      },
      byAction: {
        BLOCK: configs.filter((c) => c.action === 'BLOCK').length,
        THROTTLE: configs.filter((c) => c.action === 'THROTTLE').length,
        LOG_ONLY: configs.filter((c) => c.action === 'LOG_ONLY').length,
        CHALLENGE: configs.filter((c) => c.action === 'CHALLENGE').length,
      },
    }

    return NextResponse.json({ configs, summary })
  } catch (error) {
    console.error('Get rate limits error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new rate limit configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      scope,
      name,
      requestsPerSecond,
      requestsPerMinute,
      requestsPerHour,
      requestsPerDay,
      burstSize,
      burstWindow,
      maxConnections,
      maxConnectionsPerIp,
      action = 'BLOCK',
      blockDuration,
      whitelistIps,
      whitelistCountries,
      isEnabled = true,
    } = body

    // Validate required fields
    if (!scope || !name) {
      return NextResponse.json(
        { error: 'Scope and name are required' },
        { status: 400 }
      )
    }

    // Validate scope
    if (!Object.values(RateLimitScope).includes(scope)) {
      return NextResponse.json({ error: 'Invalid rate limit scope' }, { status: 400 })
    }

    // Validate action
    if (!Object.values(RateLimitAction).includes(action)) {
      return NextResponse.json({ error: 'Invalid rate limit action' }, { status: 400 })
    }

    // Validate that at least one limit is set
    const hasLimit =
      requestsPerSecond ||
      requestsPerMinute ||
      requestsPerHour ||
      requestsPerDay ||
      burstSize ||
      maxConnections ||
      maxConnectionsPerIp

    if (!hasLimit) {
      return NextResponse.json(
        { error: 'At least one rate limit must be specified' },
        { status: 400 }
      )
    }

    // Validate positive values
    if (requestsPerSecond !== undefined && requestsPerSecond < 1) {
      return NextResponse.json(
        { error: 'Requests per second must be at least 1' },
        { status: 400 }
      )
    }
    if (requestsPerMinute !== undefined && requestsPerMinute < 1) {
      return NextResponse.json(
        { error: 'Requests per minute must be at least 1' },
        { status: 400 }
      )
    }
    if (requestsPerHour !== undefined && requestsPerHour < 1) {
      return NextResponse.json(
        { error: 'Requests per hour must be at least 1' },
        { status: 400 }
      )
    }
    if (requestsPerDay !== undefined && requestsPerDay < 1) {
      return NextResponse.json(
        { error: 'Requests per day must be at least 1' },
        { status: 400 }
      )
    }
    if (burstSize !== undefined && burstSize < 1) {
      return NextResponse.json(
        { error: 'Burst size must be at least 1' },
        { status: 400 }
      )
    }
    if (maxConnections !== undefined && maxConnections < 1) {
      return NextResponse.json(
        { error: 'Max connections must be at least 1' },
        { status: 400 }
      )
    }
    if (maxConnectionsPerIp !== undefined && maxConnectionsPerIp < 1) {
      return NextResponse.json(
        { error: 'Max connections per IP must be at least 1' },
        { status: 400 }
      )
    }
    if (blockDuration !== undefined && blockDuration < 1) {
      return NextResponse.json(
        { error: 'Block duration must be at least 1 second' },
        { status: 400 }
      )
    }

    // Check for duplicate name within scope
    const existing = await db.rateLimitConfig.findFirst({
      where: { scope, name },
    })
    if (existing) {
      return NextResponse.json(
        {
          error: 'A rate limit configuration with this name already exists in this scope',
          existingConfig: existing,
        },
        { status: 409 }
      )
    }

    // Validate whitelist IPs format (JSON array)
    let whitelistIpsJson: string | null = null
    if (whitelistIps && Array.isArray(whitelistIps) && whitelistIps.length > 0) {
      whitelistIpsJson = JSON.stringify(whitelistIps)
    }

    // Validate whitelist countries format (JSON array)
    let whitelistCountriesJson: string | null = null
    if (whitelistCountries && Array.isArray(whitelistCountries) && whitelistCountries.length > 0) {
      whitelistCountriesJson = JSON.stringify(whitelistCountries)
    }

    // Create rate limit configuration
    const config = await db.rateLimitConfig.create({
      data: {
        scope,
        name,
        requestsPerSecond: requestsPerSecond || null,
        requestsPerMinute: requestsPerMinute || null,
        requestsPerHour: requestsPerHour || null,
        requestsPerDay: requestsPerDay || null,
        burstSize: burstSize || null,
        burstWindow: burstWindow || null,
        maxConnections: maxConnections || null,
        maxConnectionsPerIp: maxConnectionsPerIp || null,
        action,
        blockDuration: blockDuration || null,
        whitelistIps: whitelistIpsJson,
        whitelistCountries: whitelistCountriesJson,
        isEnabled,
      },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'CREATE_RATE_LIMIT_CONFIG',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetId: config.id,
        targetType: 'RateLimitConfig',
        details: JSON.stringify({
          scope,
          name,
          action,
          limits: {
            requestsPerSecond,
            requestsPerMinute,
            requestsPerHour,
            requestsPerDay,
            burstSize,
            maxConnections,
          },
        }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ success: true, config }, { status: 201 })
  } catch (error) {
    console.error('Create rate limit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
