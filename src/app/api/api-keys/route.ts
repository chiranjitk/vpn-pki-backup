import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { randomBytes } from 'crypto'

// Generate a secure API key
function generateApiKey(): string {
  const prefix = 'vpn'
  const key = randomBytes(32).toString('base64url')
  return `${prefix}_${key}`
}

// GET - List all API keys
export async function GET() {
  try {
    const keys = await db.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        permissions: true,
        isEnabled: true,
        lastUsedAt: true,
        expiresAt: true,
        createdBy: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ keys })
  } catch (error) {
    console.error('Get API keys error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new API key
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, permissions = 'read', expiresInDays } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Generate API key
    const apiKey = generateApiKey()
    const prefix = apiKey.substring(0, 12)

    // Calculate expiry
    let expiresAt: Date | null = null
    if (expiresInDays) {
      expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + expiresInDays)
    }

    // Create key in database
    const key = await db.apiKey.create({
      data: {
        name,
        key: apiKey,
        prefix,
        permissions: Array.isArray(permissions) ? permissions.join(',') : permissions,
        expiresAt,
        createdBy: 'admin',
      },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'CREATE_API_KEY',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetId: key.id,
        targetType: 'ApiKey',
        details: JSON.stringify({ name, permissions, prefix }),
        status: 'SUCCESS',
      },
    })

    // Return the full key only once (on creation)
    return NextResponse.json({
      success: true,
      key: {
        id: key.id,
        name: key.name,
        key: apiKey, // Full key - only shown once!
        prefix: key.prefix,
        permissions: key.permissions,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
      },
      warning: 'Store this API key securely. It will not be shown again.',
    })
  } catch (error) {
    console.error('Create API key error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
