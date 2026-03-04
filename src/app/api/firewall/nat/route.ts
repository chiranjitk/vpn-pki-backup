import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - List all NAT policies
export async function GET() {
  try {
    const policies = await db.natPolicy.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ policies })
  } catch (error) {
    console.error('Get NAT policies error:', error)
    return NextResponse.json({ policies: [] })
  }
}

// POST - Create a new NAT policy
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, type, sourceIp, destIp, interface: iface, translatedIp, isEnabled, description } = body

    if (!name || !type) {
      return NextResponse.json(
        { error: 'Name and Type are required' },
        { status: 400 }
      )
    }

    const policy = await db.natPolicy.create({
      data: {
        name,
        type,
        sourceIp: sourceIp || '0.0.0.0/0',
        destIp: destIp || '0.0.0.0/0',
        interface: iface || 'eth0',
        translatedIp: translatedIp || '',
        isEnabled: isEnabled ?? true,
        description,
      },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'CREATE_NAT_POLICY',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'NatPolicy',
        details: JSON.stringify({ name, type }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ policy })
  } catch (error) {
    console.error('Create NAT policy error:', error)
    return NextResponse.json(
      { error: 'Failed to create NAT policy' },
      { status: 500 }
    )
  }
}
