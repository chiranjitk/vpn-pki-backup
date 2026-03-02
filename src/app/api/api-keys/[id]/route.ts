import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Get a single API key
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const key = await db.apiKey.findUnique({
      where: { id },
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
        updatedAt: true,
      },
    })

    if (!key) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    return NextResponse.json({ key })
  } catch (error) {
    console.error('Get API key error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update an API key
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, permissions, isEnabled } = body

    const key = await db.apiKey.findUnique({ where: { id } })
    if (!key) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    const updatedKey = await db.apiKey.update({
      where: { id },
      data: {
        name: name || key.name,
        permissions: permissions || key.permissions,
        isEnabled: isEnabled !== undefined ? isEnabled : key.isEnabled,
      },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'UPDATE_API_KEY',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetId: id,
        targetType: 'ApiKey',
        details: JSON.stringify({ name: updatedKey.name, isEnabled: updatedKey.isEnabled }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({
      success: true,
      key: {
        id: updatedKey.id,
        name: updatedKey.name,
        prefix: updatedKey.prefix,
        permissions: updatedKey.permissions,
        isEnabled: updatedKey.isEnabled,
      },
    })
  } catch (error) {
    console.error('Update API key error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete an API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const key = await db.apiKey.findUnique({ where: { id } })
    if (!key) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    await db.apiKey.delete({ where: { id } })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'DELETE_API_KEY',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetId: id,
        targetType: 'ApiKey',
        details: JSON.stringify({ name: key.name, prefix: key.prefix }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete API key error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
