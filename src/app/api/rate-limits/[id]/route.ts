import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { RateLimitScope, RateLimitAction } from '@prisma/client'

// GET - Get a single rate limit configuration
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const config = await db.rateLimitConfig.findUnique({
      where: { id },
    })

    if (!config) {
      return NextResponse.json({ error: 'Rate limit configuration not found' }, { status: 404 })
    }

    // Parse JSON fields for easier frontend consumption
    const response = {
      ...config,
      whitelistIps: config.whitelistIps ? JSON.parse(config.whitelistIps) : [],
      whitelistCountries: config.whitelistCountries
        ? JSON.parse(config.whitelistCountries)
        : [],
    }

    return NextResponse.json({ config: response })
  } catch (error) {
    console.error('Get rate limit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update a rate limit configuration
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
      action,
      blockDuration,
      whitelistIps,
      whitelistCountries,
      isEnabled,
    } = body

    // Check if config exists
    const existing = await db.rateLimitConfig.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Rate limit configuration not found' }, { status: 404 })
    }

    // Validate scope if provided
    if (scope && !Object.values(RateLimitScope).includes(scope)) {
      return NextResponse.json({ error: 'Invalid rate limit scope' }, { status: 400 })
    }

    // Validate action if provided
    if (action && !Object.values(RateLimitAction).includes(action)) {
      return NextResponse.json({ error: 'Invalid rate limit action' }, { status: 400 })
    }

    // Check for duplicate name within scope (excluding current config)
    if (name || scope) {
      const targetScope = scope || existing.scope
      const targetName = name || existing.name
      const duplicate = await db.rateLimitConfig.findFirst({
        where: {
          scope: targetScope,
          name: targetName,
          NOT: { id },
        },
      })
      if (duplicate) {
        return NextResponse.json(
          {
            error: 'A rate limit configuration with this name already exists in this scope',
          },
          { status: 409 }
        )
      }
    }

    // Validate positive values if provided
    if (requestsPerSecond !== undefined && requestsPerSecond !== null && requestsPerSecond < 1) {
      return NextResponse.json(
        { error: 'Requests per second must be at least 1' },
        { status: 400 }
      )
    }
    if (requestsPerMinute !== undefined && requestsPerMinute !== null && requestsPerMinute < 1) {
      return NextResponse.json(
        { error: 'Requests per minute must be at least 1' },
        { status: 400 }
      )
    }
    if (requestsPerHour !== undefined && requestsPerHour !== null && requestsPerHour < 1) {
      return NextResponse.json(
        { error: 'Requests per hour must be at least 1' },
        { status: 400 }
      )
    }
    if (requestsPerDay !== undefined && requestsPerDay !== null && requestsPerDay < 1) {
      return NextResponse.json(
        { error: 'Requests per day must be at least 1' },
        { status: 400 }
      )
    }
    if (burstSize !== undefined && burstSize !== null && burstSize < 1) {
      return NextResponse.json({ error: 'Burst size must be at least 1' }, { status: 400 })
    }
    if (maxConnections !== undefined && maxConnections !== null && maxConnections < 1) {
      return NextResponse.json({ error: 'Max connections must be at least 1' }, { status: 400 })
    }
    if (maxConnectionsPerIp !== undefined && maxConnectionsPerIp !== null && maxConnectionsPerIp < 1) {
      return NextResponse.json(
        { error: 'Max connections per IP must be at least 1' },
        { status: 400 }
      )
    }
    if (blockDuration !== undefined && blockDuration !== null && blockDuration < 1) {
      return NextResponse.json(
        { error: 'Block duration must be at least 1 second' },
        { status: 400 }
      )
    }

    // Process whitelist IPs
    let whitelistIpsJson: string | null = existing.whitelistIps
    if (whitelistIps !== undefined) {
      if (Array.isArray(whitelistIps) && whitelistIps.length > 0) {
        whitelistIpsJson = JSON.stringify(whitelistIps)
      } else {
        whitelistIpsJson = null
      }
    }

    // Process whitelist countries
    let whitelistCountriesJson: string | null = existing.whitelistCountries
    if (whitelistCountries !== undefined) {
      if (Array.isArray(whitelistCountries) && whitelistCountries.length > 0) {
        whitelistCountriesJson = JSON.stringify(whitelistCountries)
      } else {
        whitelistCountriesJson = null
      }
    }

    // Build update data
    const updateData: {
      scope?: RateLimitScope
      name?: string
      requestsPerSecond?: number | null
      requestsPerMinute?: number | null
      requestsPerHour?: number | null
      requestsPerDay?: number | null
      burstSize?: number | null
      burstWindow?: number | null
      maxConnections?: number | null
      maxConnectionsPerIp?: number | null
      action?: RateLimitAction
      blockDuration?: number | null
      whitelistIps?: string | null
      whitelistCountries?: string | null
      isEnabled?: boolean
    } = {}

    if (scope !== undefined) updateData.scope = scope
    if (name !== undefined) updateData.name = name
    if (requestsPerSecond !== undefined) updateData.requestsPerSecond = requestsPerSecond || null
    if (requestsPerMinute !== undefined) updateData.requestsPerMinute = requestsPerMinute || null
    if (requestsPerHour !== undefined) updateData.requestsPerHour = requestsPerHour || null
    if (requestsPerDay !== undefined) updateData.requestsPerDay = requestsPerDay || null
    if (burstSize !== undefined) updateData.burstSize = burstSize || null
    if (burstWindow !== undefined) updateData.burstWindow = burstWindow || null
    if (maxConnections !== undefined) updateData.maxConnections = maxConnections || null
    if (maxConnectionsPerIp !== undefined) updateData.maxConnectionsPerIp = maxConnectionsPerIp || null
    if (action !== undefined) updateData.action = action
    if (blockDuration !== undefined) updateData.blockDuration = blockDuration || null
    if (whitelistIps !== undefined) updateData.whitelistIps = whitelistIpsJson
    if (whitelistCountries !== undefined) updateData.whitelistCountries = whitelistCountriesJson
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled

    // Update configuration
    const updated = await db.rateLimitConfig.update({
      where: { id },
      data: updateData,
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'UPDATE_RATE_LIMIT_CONFIG',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetId: id,
        targetType: 'RateLimitConfig',
        details: JSON.stringify({
          previous: {
            scope: existing.scope,
            name: existing.name,
            action: existing.action,
            isEnabled: existing.isEnabled,
          },
          current: {
            scope: updated.scope,
            name: updated.name,
            action: updated.action,
            isEnabled: updated.isEnabled,
          },
        }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ success: true, config: updated })
  } catch (error) {
    console.error('Update rate limit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete a rate limit configuration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if config exists
    const existing = await db.rateLimitConfig.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Rate limit configuration not found' }, { status: 404 })
    }

    // Delete configuration
    await db.rateLimitConfig.delete({ where: { id } })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'DELETE_RATE_LIMIT_CONFIG',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetId: id,
        targetType: 'RateLimitConfig',
        details: JSON.stringify({
          scope: existing.scope,
          name: existing.name,
          action: existing.action,
        }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete rate limit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
