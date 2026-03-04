import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Get a specific NAT policy
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const policy = await db.natPolicy.findUnique({
      where: { id },
    })

    if (!policy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 })
    }

    return NextResponse.json({ policy })
  } catch (error) {
    console.error('Get NAT policy error:', error)
    return NextResponse.json({ error: 'Failed to get policy' }, { status: 500 })
  }
}

// PUT - Update a NAT policy
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, type, sourceIp, destIp, interface: iface, translatedIp, isEnabled, description } = body

    const existingPolicy = await db.natPolicy.findUnique({ where: { id } })
    if (!existingPolicy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 })
    }

    const policy = await db.natPolicy.update({
      where: { id },
      data: {
        name: name ?? existingPolicy.name,
        type: type ?? existingPolicy.type,
        sourceIp: sourceIp ?? existingPolicy.sourceIp,
        destIp: destIp ?? existingPolicy.destIp,
        interface: iface ?? existingPolicy.interface,
        translatedIp: translatedIp ?? existingPolicy.translatedIp,
        isEnabled: isEnabled ?? existingPolicy.isEnabled,
        description,
      },
    })

    return NextResponse.json({ policy })
  } catch (error) {
    console.error('Update NAT policy error:', error)
    return NextResponse.json({ error: 'Failed to update policy' }, { status: 500 })
  }
}

// PATCH - Toggle policy status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { isEnabled } = body

    const existingPolicy = await db.natPolicy.findUnique({ where: { id } })
    if (!existingPolicy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 })
    }

    const policy = await db.natPolicy.update({
      where: { id },
      data: { isEnabled },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: isEnabled ? 'ENABLE_NAT_POLICY' : 'DISABLE_NAT_POLICY',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'NatPolicy',
        details: JSON.stringify({ id, name: existingPolicy.name }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ policy })
  } catch (error) {
    console.error('Toggle NAT policy error:', error)
    return NextResponse.json({ error: 'Failed to toggle policy' }, { status: 500 })
  }
}

// DELETE - Delete a NAT policy
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existingPolicy = await db.natPolicy.findUnique({ where: { id } })
    if (!existingPolicy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 })
    }

    await db.natPolicy.delete({ where: { id } })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'DELETE_NAT_POLICY',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'NatPolicy',
        details: JSON.stringify({ id, name: existingPolicy.name }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete NAT policy error:', error)
    return NextResponse.json({ error: 'Failed to delete policy' }, { status: 500 })
  }
}
