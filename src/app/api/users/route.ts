import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hash } from 'bcryptjs'

// GET - List all VPN users
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const search = searchParams.get('search')

    const where: any = {}

    if (status !== 'all') {
      where.status = status
    }

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const users = await db.vpnUser.findMany({
      where,
      include: {
        certificates: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            serialNumber: true,
            expiryDate: true,
            status: true,
          },
          take: 1,
        },
        _count: {
          select: { certificates: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      users: users.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        department: user.department,
        phone: user.phone,
        notes: user.notes,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        certificateStatus: user.certificates.length > 0 ? 'ACTIVE' : 'NONE',
        certificateExpiry: user.certificates[0]?.expiryDate || null,
        totalCertificates: user._count.certificates,
      })),
    })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new VPN user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, email, fullName, department, phone, notes } = body

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      )
    }

    // Check if username already exists
    const existingUser = await db.vpnUser.findUnique({
      where: { username },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 400 }
      )
    }

    // Check if email already exists
    if (email) {
      const existingEmail = await db.vpnUser.findFirst({
        where: { email },
      })

      if (existingEmail) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 400 }
        )
      }
    }

    // Create user
    const user = await db.vpnUser.create({
      data: {
        username,
        email,
        fullName,
        department,
        phone,
        notes,
        status: 'ACTIVE',
      },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'CREATE_USER',
        category: 'USER_MANAGEMENT',
        actorType: 'ADMIN',
        targetId: user.id,
        targetType: 'VpnUser',
        details: JSON.stringify({ username, email, fullName }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        department: user.department,
        status: user.status,
        createdAt: user.createdAt,
      },
    })
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update a VPN user
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, username, email, fullName, department, phone, notes, status } = body

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Check if user exists
    const existingUser = await db.vpnUser.findUnique({
      where: { id },
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // If username is being changed, check for duplicates
    if (username && username !== existingUser.username) {
      const duplicateUsername = await db.vpnUser.findUnique({
        where: { username },
      })
      if (duplicateUsername) {
        return NextResponse.json(
          { error: 'Username already exists' },
          { status: 400 }
        )
      }
    }

    // If email is being changed, check for duplicates
    if (email && email !== existingUser.email) {
      const duplicateEmail = await db.vpnUser.findFirst({
        where: { email },
      })
      if (duplicateEmail) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 400 }
        )
      }
    }

    // Update user
    const user = await db.vpnUser.update({
      where: { id },
      data: {
        username: username || existingUser.username,
        email: email !== undefined ? email : existingUser.email,
        fullName: fullName !== undefined ? fullName : existingUser.fullName,
        department: department !== undefined ? department : existingUser.department,
        phone: phone !== undefined ? phone : existingUser.phone,
        notes: notes !== undefined ? notes : existingUser.notes,
        status: status || existingUser.status,
      },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'UPDATE_USER',
        category: 'USER_MANAGEMENT',
        actorType: 'ADMIN',
        targetId: user.id,
        targetType: 'VpnUser',
        details: JSON.stringify({ username: user.username }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a VPN user
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await db.vpnUser.findUnique({
      where: { id },
      include: {
        _count: { select: { certificates: true } },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Delete user (cascade will delete certificates)
    await db.vpnUser.delete({
      where: { id },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'DELETE_USER',
        category: 'USER_MANAGEMENT',
        actorType: 'ADMIN',
        targetId: id,
        targetType: 'VpnUser',
        details: JSON.stringify({ username: user.username }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
