import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { GuestStatus } from '@prisma/client'

// GET /api/guest-users - List all guest users
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as GuestStatus | null
    const search = searchParams.get('search')
    const sponsorId = searchParams.get('sponsorId')
    const includeExpired = searchParams.get('includeExpired') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: any = {}

    if (status && Object.values(GuestStatus).includes(status)) {
      where.status = status
    } else if (!includeExpired) {
      // By default, exclude expired and revoked guests from main listing
      where.status = { notIn: [GuestStatus.EXPIRED, GuestStatus.REVOKED] }
    }

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (sponsorId) {
      where.sponsorId = sponsorId
    }

    // Get total count for pagination
    const total = await db.guestUser.count({ where })

    // Get guest users
    const guestUsers = await db.guestUser.findMany({
      where,
      orderBy: [
        { status: 'asc' }, // PENDING first
        { createdAt: 'desc' },
      ],
      take: limit,
      skip: offset,
    })

    // Calculate statistics
    const stats = await db.guestUser.groupBy({
      by: ['status'],
      _count: { id: true },
    })

    const statsMap = stats.reduce((acc, s) => {
      acc[s.status] = s._count.id
      return acc
    }, {} as Record<GuestStatus, number>)

    // Get upcoming expirations (within 7 days)
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

    const expiringSoon = await db.guestUser.count({
      where: {
        status: { in: [GuestStatus.APPROVED, GuestStatus.ACTIVE] },
        accessEndDate: { lte: sevenDaysFromNow, gte: new Date() },
      },
    })

    return NextResponse.json({
      success: true,
      data: guestUsers,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      stats: {
        pending: statsMap[GuestStatus.PENDING] || 0,
        approved: statsMap[GuestStatus.APPROVED] || 0,
        active: statsMap[GuestStatus.ACTIVE] || 0,
        expired: statsMap[GuestStatus.EXPIRED] || 0,
        revoked: statsMap[GuestStatus.REVOKED] || 0,
        denied: statsMap[GuestStatus.DENIED] || 0,
        expiringSoon,
      },
    })
  } catch (error: any) {
    console.error('Error fetching guest users:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch guest users', message: error.message },
      { status: 500 }
    )
  }
}

// POST /api/guest-users - Create a new guest user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    const { username, email, accessStartDate, accessEndDate, sponsorId, sponsorName, sponsorEmail } = body

    if (!username || !email || !accessStartDate || !accessEndDate) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: username, email, accessStartDate, accessEndDate' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate username format (alphanumeric, underscores, hyphens)
    const usernameRegex = /^[a-zA-Z0-9_-]+$/
    if (!usernameRegex.test(username)) {
      return NextResponse.json(
        { success: false, error: 'Username must contain only alphanumeric characters, underscores, and hyphens' },
        { status: 400 }
      )
    }

    // Check for duplicate username
    const existingGuest = await db.guestUser.findUnique({
      where: { username },
    })

    if (existingGuest) {
      return NextResponse.json(
        { success: false, error: 'Username already exists' },
        { status: 409 }
      )
    }

    // Parse and validate dates
    const startDate = new Date(accessStartDate)
    const endDate = new Date(accessEndDate)
    const now = new Date()

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format for accessStartDate or accessEndDate' },
        { status: 400 }
      )
    }

    if (endDate <= startDate) {
      return NextResponse.json(
        { success: false, error: 'Access end date must be after start date' },
        { status: 400 }
      )
    }

    // Validate access period (max 90 days for guests)
    const maxAccessDays = 90
    const accessDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    if (accessDays > maxAccessDays) {
      return NextResponse.json(
        { success: false, error: `Access period cannot exceed ${maxAccessDays} days` },
        { status: 400 }
      )
    }

    // Validate sponsor info if provided
    if (sponsorId || sponsorName || sponsorEmail) {
      if (!sponsorName || !sponsorEmail) {
        return NextResponse.json(
          { success: false, error: 'Sponsor information incomplete. Both sponsorName and sponsorEmail are required.' },
          { status: 400 }
        )
      }

      if (!emailRegex.test(sponsorEmail)) {
        return NextResponse.json(
          { success: false, error: 'Invalid sponsor email format' },
          { status: 400 }
        )
      }
    }

    // Validate maxSessions
    const maxSessions = body.maxSessions ?? 1
    if (maxSessions < 1 || maxSessions > 5) {
      return NextResponse.json(
        { success: false, error: 'maxSessions must be between 1 and 5' },
        { status: 400 }
      )
    }

    // Validate bandwidth limit if provided
    if (body.bandwidthLimit !== undefined && body.bandwidthLimit !== null) {
      if (body.bandwidthLimit < 64 || body.bandwidthLimit > 100000) {
        return NextResponse.json(
          { success: false, error: 'bandwidthLimit must be between 64 and 100000 Kbps' },
          { status: 400 }
        )
      }
    }

    // Validate allowed networks if provided
    let allowedNetworks = body.allowedNetworks
    if (allowedNetworks) {
      try {
        if (typeof allowedNetworks === 'string') {
          allowedNetworks = JSON.parse(allowedNetworks)
        }
        if (!Array.isArray(allowedNetworks)) {
          throw new Error('Must be an array')
        }
        // Validate each network is valid CIDR or IP
        const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
        for (const network of allowedNetworks) {
          if (!cidrRegex.test(network)) {
            throw new Error(`Invalid network format: ${network}`)
          }
        }
      } catch (e: any) {
        return NextResponse.json(
          { success: false, error: `Invalid allowedNetworks format: ${e.message}` },
          { status: 400 }
        )
      }
    }

    // Determine initial status
    // If start date is in the future, status is PENDING
    // If start date is now or past and has sponsor, status is APPROVED
    let initialStatus = GuestStatus.PENDING
    if (startDate <= now && sponsorId && sponsorName && sponsorEmail) {
      initialStatus = GuestStatus.APPROVED
    }

    // Create the guest user
    const guestUser = await db.guestUser.create({
      data: {
        username,
        email,
        fullName: body.fullName || null,
        phone: body.phone || null,
        company: body.company || null,
        purpose: body.purpose || null,
        sponsorId: sponsorId || null,
        sponsorName: sponsorName || null,
        sponsorEmail: sponsorEmail || null,
        accessStartDate: startDate,
        accessEndDate: endDate,
        maxSessions,
        allowedNetworks: allowedNetworks ? JSON.stringify(allowedNetworks) : null,
        bandwidthLimit: body.bandwidthLimit || null,
        status: initialStatus,
      },
    })

    // Log the action
    await db.auditLog.create({
      data: {
        action: 'CREATE_GUEST_USER',
        category: 'USER_MANAGEMENT',
        targetId: guestUser.id,
        targetType: 'GuestUser',
        details: JSON.stringify({
          username: guestUser.username,
          email: guestUser.email,
          accessStartDate: guestUser.accessStartDate,
          accessEndDate: guestUser.accessEndDate,
          sponsorId: guestUser.sponsorId,
          status: guestUser.status,
        }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({
      success: true,
      data: guestUser,
      message: 'Guest user created successfully',
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating guest user:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create guest user', message: error.message },
      { status: 500 }
    )
  }
}
