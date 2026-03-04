import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { GuestStatus } from '@prisma/client'

// GET /api/guest-users/[id] - Get a specific guest user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const guestUser = await db.guestUser.findUnique({
      where: { id },
    })

    if (!guestUser) {
      return NextResponse.json(
        { success: false, error: 'Guest user not found' },
        { status: 404 }
      )
    }

    // Parse allowed networks if present
    let allowedNetworks = null
    if (guestUser.allowedNetworks) {
      try {
        allowedNetworks = JSON.parse(guestUser.allowedNetworks)
      } catch {
        allowedNetworks = guestUser.allowedNetworks
      }
    }

    // Calculate remaining time
    const now = new Date()
    const remainingMs = guestUser.accessEndDate.getTime() - now.getTime()
    const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)))
    const remainingHours = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60)))

    // Determine if access is currently valid
    const isAccessValid = 
      guestUser.status === GuestStatus.APPROVED || guestUser.status === GuestStatus.ACTIVE
      && guestUser.accessStartDate <= now
      && guestUser.accessEndDate > now

    return NextResponse.json({
      success: true,
      data: {
        ...guestUser,
        allowedNetworks,
        accessInfo: {
          isAccessValid,
          remainingDays,
          remainingHours,
          hasStarted: guestUser.accessStartDate <= now,
          hasExpired: guestUser.accessEndDate <= now,
          totalAccessDays: Math.ceil(
            (guestUser.accessEndDate.getTime() - guestUser.accessStartDate.getTime()) / (1000 * 60 * 60 * 24)
          ),
        },
      },
    })
  } catch (error: any) {
    console.error('Error fetching guest user:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch guest user', message: error.message },
      { status: 500 }
    )
  }
}

// PUT /api/guest-users/[id] - Update a guest user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Check if guest user exists
    const existingGuest = await db.guestUser.findUnique({
      where: { id },
    })

    if (!existingGuest) {
      return NextResponse.json(
        { success: false, error: 'Guest user not found' },
        { status: 404 }
      )
    }

    // Prevent modification of revoked or denied guests
    if (existingGuest.status === GuestStatus.REVOKED || existingGuest.status === GuestStatus.DENIED) {
      return NextResponse.json(
        { success: false, error: 'Cannot modify revoked or denied guest users' },
        { status: 400 }
      )
    }

    // Build update data
    const updateData: any = {}

    // Updatable fields
    if (body.email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(body.email)) {
        return NextResponse.json(
          { success: false, error: 'Invalid email format' },
          { status: 400 }
        )
      }
      updateData.email = body.email
    }

    if (body.fullName !== undefined) {
      updateData.fullName = body.fullName || null
    }

    if (body.phone !== undefined) {
      updateData.phone = body.phone || null
    }

    if (body.company !== undefined) {
      updateData.company = body.company || null
    }

    if (body.purpose !== undefined) {
      updateData.purpose = body.purpose || null
    }

    // Validate and update sponsor info
    if (body.sponsorId !== undefined || body.sponsorName !== undefined || body.sponsorEmail !== undefined) {
      if (body.sponsorName && !body.sponsorEmail) {
        return NextResponse.json(
          { success: false, error: 'Sponsor email is required when sponsor name is provided' },
          { status: 400 }
        )
      }
      if (body.sponsorEmail && !body.sponsorName) {
        return NextResponse.json(
          { success: false, error: 'Sponsor name is required when sponsor email is provided' },
          { status: 400 }
        )
      }
      if (body.sponsorEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(body.sponsorEmail)) {
          return NextResponse.json(
            { success: false, error: 'Invalid sponsor email format' },
            { status: 400 }
          )
        }
      }
      updateData.sponsorId = body.sponsorId || null
      updateData.sponsorName = body.sponsorName || null
      updateData.sponsorEmail = body.sponsorEmail || null
    }

    // Validate and update access dates
    if (body.accessStartDate !== undefined || body.accessEndDate !== undefined) {
      const startDate = body.accessStartDate ? new Date(body.accessStartDate) : existingGuest.accessStartDate
      const endDate = body.accessEndDate ? new Date(body.accessEndDate) : existingGuest.accessEndDate

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid date format' },
          { status: 400 }
        )
      }

      if (endDate <= startDate) {
        return NextResponse.json(
          { success: false, error: 'Access end date must be after start date' },
          { status: 400 }
        )
      }

      // Validate access period (max 90 days)
      const maxAccessDays = 90
      const accessDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      if (accessDays > maxAccessDays) {
        return NextResponse.json(
          { success: false, error: `Access period cannot exceed ${maxAccessDays} days` },
          { status: 400 }
        )
      }

      updateData.accessStartDate = startDate
      updateData.accessEndDate = endDate
    }

    // Validate and update maxSessions
    if (body.maxSessions !== undefined) {
      if (body.maxSessions < 1 || body.maxSessions > 5) {
        return NextResponse.json(
          { success: false, error: 'maxSessions must be between 1 and 5' },
          { status: 400 }
        )
      }
      updateData.maxSessions = body.maxSessions
    }

    // Validate and update bandwidth limit
    if (body.bandwidthLimit !== undefined) {
      if (body.bandwidthLimit !== null && (body.bandwidthLimit < 64 || body.bandwidthLimit > 100000)) {
        return NextResponse.json(
          { success: false, error: 'bandwidthLimit must be between 64 and 100000 Kbps or null' },
          { status: 400 }
        )
      }
      updateData.bandwidthLimit = body.bandwidthLimit
    }

    // Validate and update allowed networks
    if (body.allowedNetworks !== undefined) {
      let allowedNetworks = body.allowedNetworks
      if (allowedNetworks) {
        try {
          if (typeof allowedNetworks === 'string') {
            allowedNetworks = JSON.parse(allowedNetworks)
          }
          if (!Array.isArray(allowedNetworks)) {
            throw new Error('Must be an array')
          }
          const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
          for (const network of allowedNetworks) {
            if (!cidrRegex.test(network)) {
              throw new Error(`Invalid network format: ${network}`)
            }
          }
          updateData.allowedNetworks = JSON.stringify(allowedNetworks)
        } catch (e: any) {
          return NextResponse.json(
            { success: false, error: `Invalid allowedNetworks format: ${e.message}` },
            { status: 400 }
          )
        }
      } else {
        updateData.allowedNetworks = null
      }
    }

    // Update the guest user
    const updatedGuest = await db.guestUser.update({
      where: { id },
      data: updateData,
    })

    // Log the action
    await db.auditLog.create({
      data: {
        action: 'UPDATE_GUEST_USER',
        category: 'USER_MANAGEMENT',
        targetId: id,
        targetType: 'GuestUser',
        details: JSON.stringify({
          username: existingGuest.username,
          changes: Object.keys(updateData),
          before: {
            email: existingGuest.email,
            fullName: existingGuest.fullName,
            accessStartDate: existingGuest.accessStartDate,
            accessEndDate: existingGuest.accessEndDate,
            maxSessions: existingGuest.maxSessions,
          },
          after: {
            email: updatedGuest.email,
            fullName: updatedGuest.fullName,
            accessStartDate: updatedGuest.accessStartDate,
            accessEndDate: updatedGuest.accessEndDate,
            maxSessions: updatedGuest.maxSessions,
          },
        }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedGuest,
      message: 'Guest user updated successfully',
    })
  } catch (error: any) {
    console.error('Error updating guest user:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update guest user', message: error.message },
      { status: 500 }
    )
  }
}

// DELETE /api/guest-users/[id] - Delete a guest user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if guest user exists
    const existingGuest = await db.guestUser.findUnique({
      where: { id },
    })

    if (!existingGuest) {
      return NextResponse.json(
        { success: false, error: 'Guest user not found' },
        { status: 404 }
      )
    }

    // Prevent deletion of active guests
    if (existingGuest.status === GuestStatus.ACTIVE) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete an active guest user. Revoke access first.' },
        { status: 400 }
      )
    }

    // Check for active VPN sessions (would need VpnSession model)
    // For now, we'll allow deletion

    // Delete the guest user
    await db.guestUser.delete({
      where: { id },
    })

    // Log the action
    await db.auditLog.create({
      data: {
        action: 'DELETE_GUEST_USER',
        category: 'USER_MANAGEMENT',
        targetId: id,
        targetType: 'GuestUser',
        details: JSON.stringify({
          username: existingGuest.username,
          email: existingGuest.email,
          status: existingGuest.status,
          accessEndDate: existingGuest.accessEndDate,
          sponsorId: existingGuest.sponsorId,
        }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Guest user deleted successfully',
    })
  } catch (error: any) {
    console.error('Error deleting guest user:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete guest user', message: error.message },
      { status: 500 }
    )
  }
}
