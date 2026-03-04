import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - List all static routes
export async function GET() {
  try {
    const routes = await db.staticRoute.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ routes })
  } catch (error) {
    console.error('Get routes error:', error)
    return NextResponse.json({ routes: [] })
  }
}

// POST - Create a new static route
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { destination, gateway, interface: iface, metric, isEnabled, description } = body

    if (!destination || !gateway) {
      return NextResponse.json(
        { error: 'Destination and Gateway are required' },
        { status: 400 }
      )
    }

    const route = await db.staticRoute.create({
      data: {
        destination,
        gateway,
        interface: iface || 'eth0',
        metric: metric || 100,
        isEnabled: isEnabled ?? true,
        description,
      },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'CREATE_STATIC_ROUTE',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'StaticRoute',
        details: JSON.stringify({ destination, gateway, interface: iface }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ route })
  } catch (error) {
    console.error('Create route error:', error)
    return NextResponse.json(
      { error: 'Failed to create route' },
      { status: 500 }
    )
  }
}
