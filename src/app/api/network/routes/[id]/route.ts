import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Get a specific route
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const route = await db.staticRoute.findUnique({
      where: { id },
    })

    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 })
    }

    return NextResponse.json({ route })
  } catch (error) {
    console.error('Get route error:', error)
    return NextResponse.json({ error: 'Failed to get route' }, { status: 500 })
  }
}

// PUT - Update a route
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { destination, gateway, interface: iface, metric, isEnabled, description } = body

    const existingRoute = await db.staticRoute.findUnique({ where: { id } })
    if (!existingRoute) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 })
    }

    const route = await db.staticRoute.update({
      where: { id },
      data: {
        destination,
        gateway,
        interface: iface,
        metric,
        isEnabled,
        description,
      },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'UPDATE_STATIC_ROUTE',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'StaticRoute',
        details: JSON.stringify({ id, changes: body }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ route })
  } catch (error) {
    console.error('Update route error:', error)
    return NextResponse.json({ error: 'Failed to update route' }, { status: 500 })
  }
}

// PATCH - Toggle route status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { isEnabled } = body

    const existingRoute = await db.staticRoute.findUnique({ where: { id } })
    if (!existingRoute) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 })
    }

    const route = await db.staticRoute.update({
      where: { id },
      data: { isEnabled },
    })

    return NextResponse.json({ route })
  } catch (error) {
    console.error('Toggle route error:', error)
    return NextResponse.json({ error: 'Failed to toggle route' }, { status: 500 })
  }
}

// DELETE - Delete a route
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existingRoute = await db.staticRoute.findUnique({ where: { id } })
    if (!existingRoute) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 })
    }

    await db.staticRoute.delete({ where: { id } })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'DELETE_STATIC_ROUTE',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'StaticRoute',
        details: JSON.stringify({ id, destination: existingRoute.destination }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete route error:', error)
    return NextResponse.json({ error: 'Failed to delete route' }, { status: 500 })
  }
}
