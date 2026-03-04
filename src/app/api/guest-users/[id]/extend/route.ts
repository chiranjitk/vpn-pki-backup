import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
<<<<<<< HEAD
import { GuestStatus } from '@prisma/client'

// POST /api/guest-users/[id]/extend - Extend guest user access period
=======

>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
<<<<<<< HEAD

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

    // Check if guest user can be extended
    const extendableStatuses = [
      GuestStatus.PENDING,
      GuestStatus.APPROVED,
      GuestStatus.ACTIVE,
      GuestStatus.EXPIRED, // Allow extending expired guests to reactivate
    ]

    if (!extendableStatuses.includes(existingGuest.status)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot extend guest user with status '${existingGuest.status}'. Only PENDING, APPROVED, ACTIVE, or EXPIRED guests can be extended.` 
        },
        { status: 400 }
      )
    }

    // Cannot extend revoked or denied guests
    if (existingGuest.status === GuestStatus.REVOKED || existingGuest.status === GuestStatus.DENIED) {
      return NextResponse.json(
        { success: false, error: 'Cannot extend access for revoked or denied guests' },
        { status: 400 }
      )
    }

    // Validate extension parameters
    const { newEndDate, extendDays, extendReason } = body

    if (!newEndDate && !extendDays) {
      return NextResponse.json(
        { success: false, error: 'Either newEndDate or extendDays must be provided' },
        { status: 400 }
      )
    }

    // Calculate new end date
    let calculatedNewEndDate: Date
    const maxAccessDays = 90
    const now = new Date()

    if (newEndDate) {
      // Use provided new end date
      calculatedNewEndDate = new Date(newEndDate)
      
      if (isNaN(calculatedNewEndDate.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid newEndDate format' },
          { status: 400 }
        )
      }

      if (calculatedNewEndDate <= existingGuest.accessEndDate) {
        return NextResponse.json(
          { success: false, error: 'newEndDate must be after the current access end date' },
          { status: 400 }
        )
      }
    } else {
      // Use extendDays to calculate new end date
      const days = parseInt(extendDays)
      
      if (isNaN(days) || days <= 0) {
        return NextResponse.json(
          { success: false, error: 'extendDays must be a positive number' },
          { status: 400 }
        )
      }

      // Extend from current end date or from now if expired
      const baseDate = existingGuest.accessEndDate > now 
        ? existingGuest.accessEndDate 
        : now
      
      calculatedNewEndDate = new Date(baseDate)
      calculatedNewEndDate.setDate(calculatedNewEndDate.getDate() + days)
    }

    // Validate total access period doesn't exceed maximum
    const totalAccessDays = Math.ceil(
      (calculatedNewEndDate.getTime() - existingGuest.accessStartDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (totalAccessDays > maxAccessDays) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Total access period cannot exceed ${maxAccessDays} days. Current total would be ${totalAccessDays} days.` 
        },
        { status: 400 }
      )
    }

    // Determine new status
    // If guest was EXPIRED and we're extending, change to APPROVED
    let newStatus = existingGuest.status
    if (existingGuest.status === GuestStatus.EXPIRED) {
      newStatus = GuestStatus.APPROVED
    }

    // Get approver info
    const extendedBy = body.extendedBy || null

    // Update the guest user
    const updatedGuest = await db.guestUser.update({
      where: { id },
      data: {
        accessEndDate: calculatedNewEndDate,
        status: newStatus,
      },
    })

    // Log the action
    await db.auditLog.create({
      data: {
        action: 'EXTEND_GUEST_ACCESS',
        category: 'USER_MANAGEMENT',
        targetId: id,
        targetType: 'GuestUser',
        details: JSON.stringify({
          username: existingGuest.username,
          email: existingGuest.email,
          previousEndDate: existingGuest.accessEndDate,
          newEndDate: calculatedNewEndDate,
          extensionDays: Math.ceil(
            (calculatedNewEndDate.getTime() - existingGuest.accessEndDate.getTime()) / (1000 * 60 * 60 * 24)
          ),
          totalAccessDays: totalAccessDays,
          previousStatus: existingGuest.status,
          newStatus: newStatus,
          reason: extendReason || null,
          extendedBy: extendedBy,
        }),
        status: 'SUCCESS',
      },
    })

    // Create notification
    await db.notification.create({
      data: {
        type: 'guest-extended',
        referenceId: id,
        title: 'Guest Access Extended',
        message: `Guest user '${existingGuest.username}' access has been extended until ${calculatedNewEndDate.toISOString().split('T')[0]}.`,
        severity: 'info',
      },
    }).catch(() => {
      // Ignore notification creation errors
    })

    return NextResponse.json({
      success: true,
      data: updatedGuest,
      message: 'Guest access extended successfully',
      details: {
        previousEndDate: existingGuest.accessEndDate,
        newEndDate: calculatedNewEndDate,
        extensionDays: Math.ceil(
          (calculatedNewEndDate.getTime() - existingGuest.accessEndDate.getTime()) / (1000 * 60 * 60 * 24)
        ),
        totalAccessDays: totalAccessDays,
        statusChanged: existingGuest.status !== newStatus,
        previousStatus: existingGuest.status,
        newStatus: newStatus,
      },
    })
  } catch (error: any) {
    console.error('Error extending guest access:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to extend guest access', message: error.message },
      { status: 500 }
    )
=======
    const { extendDays = 7 } = body
    
    const guest = await db.guestUser.findUnique({ where: { id } })
    if (!guest) {
      return NextResponse.json({ error: 'Guest user not found' }, { status: 404 })
    }
    
    const newEndDate = new Date(guest.accessEndDate)
    newEndDate.setDate(newEndDate.getDate() + extendDays)
    
    const updated = await db.guestUser.update({
      where: { id },
      data: { accessEndDate: newEndDate }
    })
    
    return NextResponse.json({ success: true, guest: updated })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to extend access' }, { status: 500 })
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  }
}
