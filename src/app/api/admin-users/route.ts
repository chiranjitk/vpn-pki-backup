import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hash } from 'bcryptjs'

// GET - List all admin users
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
      ]
    }

    const admins = await db.adminUser.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        twoFactorEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      admins: admins.map((admin) => ({
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        status: admin.status,
        twoFactorEnabled: admin.twoFactorEnabled,
        lastLoginAt: admin.lastLoginAt,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
      })),
    })
  } catch (error) {
    console.error('Get admin users error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new admin user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, email, password, role } = body

    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'Username, email, and password are required' },
        { status: 400 }
      )
    }

    // Validate role
    const validRoles = ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER']
    const userRole = role || 'VIEWER'
    if (!validRoles.includes(userRole)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be one of: SUPER_ADMIN, ADMIN, OPERATOR, VIEWER' },
        { status: 400 }
      )
    }

    // Check if username already exists
    const existingUsername = await db.adminUser.findUnique({
      where: { username },
    })

    if (existingUsername) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingEmail = await db.adminUser.findUnique({
      where: { email },
    })

    if (existingEmail) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await hash(password, 12)

    // Create admin user
    const admin = await db.adminUser.create({
      data: {
        username,
        email,
        passwordHash,
        role: userRole,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'CREATE_ADMIN_USER',
        category: 'ADMIN_OPERATIONS',
        actorType: 'ADMIN',
        targetId: admin.id,
        targetType: 'AdminUser',
        details: JSON.stringify({ username, email, role: userRole }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ admin })
  } catch (error) {
    console.error('Create admin user error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update an admin user
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, username, email, password, role, status } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Admin user ID is required' },
        { status: 400 }
      )
    }

    // Check if user exists
    const existingUser = await db.adminUser.findUnique({
      where: { id },
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Admin user not found' },
        { status: 404 }
      )
    }

    // If username is being changed, check for duplicates
    if (username && username !== existingUser.username) {
      const duplicateUsername = await db.adminUser.findUnique({
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
      const duplicateEmail = await db.adminUser.findUnique({
        where: { email },
      })
      if (duplicateEmail) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 400 }
        )
      }
    }

    // Validate role if provided
    if (role) {
      const validRoles = ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER']
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: 'Invalid role. Must be one of: SUPER_ADMIN, ADMIN, OPERATOR, VIEWER' },
          { status: 400 }
        )
      }
    }

    // Validate status if provided
    if (status) {
      const validStatuses = ['ACTIVE', 'DISABLED', 'LOCKED']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status. Must be one of: ACTIVE, DISABLED, LOCKED' },
          { status: 400 }
        )
      }
    }

    // Build update data
    const updateData: any = {}
    if (username) updateData.username = username
    if (email) updateData.email = email
    if (role) updateData.role = role
    if (status) updateData.status = status

    // Hash new password if provided
    if (password) {
      updateData.passwordHash = await hash(password, 12)
    }

    // Update user
    const admin = await db.adminUser.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        twoFactorEnabled: true,
        lastLoginAt: true,
        updatedAt: true,
      },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'UPDATE_ADMIN_USER',
        category: 'ADMIN_OPERATIONS',
        actorType: 'ADMIN',
        targetId: id,
        targetType: 'AdminUser',
        details: JSON.stringify({ username: admin.username, updates: Object.keys(updateData) }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ admin })
  } catch (error) {
    console.error('Update admin user error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete an admin user
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Admin user ID is required' },
        { status: 400 }
      )
    }

    // Check if user exists
    const admin = await db.adminUser.findUnique({
      where: { id },
    })

    if (!admin) {
      return NextResponse.json(
        { error: 'Admin user not found' },
        { status: 404 }
      )
    }

    // Prevent deleting the last SUPER_ADMIN
    if (admin.role === 'SUPER_ADMIN') {
      const superAdminCount = await db.adminUser.count({
        where: { role: 'SUPER_ADMIN' },
      })
      if (superAdminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last super admin' },
          { status: 400 }
        )
      }
    }

    // Delete user
    await db.adminUser.delete({
      where: { id },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'DELETE_ADMIN_USER',
        category: 'ADMIN_OPERATIONS',
        actorType: 'ADMIN',
        targetId: id,
        targetType: 'AdminUser',
        details: JSON.stringify({ username: admin.username }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete admin user error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
