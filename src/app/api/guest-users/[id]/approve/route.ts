import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
<<<<<<< HEAD
import { GuestStatus } from '@prisma/client'

// POST /api/guest-users/[id]/approve - Approve a guest user
=======

>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
<<<<<<< HEAD
    const body = await request.json().catch(() => ({}))

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

    // Check if guest user can be approved
    const approvableStatuses = [GuestStatus.PENDING, GuestStatus.DENIED]
    if (!approvableStatuses.includes(existingGuest.status)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot approve guest user with status '${existingGuest.status}'. Only PENDING or DENIED guests can be approved.` 
        },
        { status: 400 }
      )
    }

    // Validate sponsor information exists
    if (!existingGuest.sponsorName || !existingGuest.sponsorEmail) {
      return NextResponse.json(
        { success: false, error: 'Guest user must have sponsor information before approval' },
        { status: 400 }
      )
    }

    // Validate access dates
    const now = new Date()
    if (existingGuest.accessEndDate <= now) {
      return NextResponse.json(
        { success: false, error: 'Access end date has already passed. Extend the access period before approving.' },
        { status: 400 }
      )
    }

    // Determine the new status
    // If access start date is in the future, status is APPROVED
    // If access has already started, status is APPROVED (will become ACTIVE on first connection)
    const newStatus = existingGuest.accessStartDate <= now 
      ? GuestStatus.APPROVED 
      : GuestStatus.APPROVED

    // Get approver info from request body or headers
    const approverId = body.approverId || null
    const approverName = body.approverName || null

    // Update the guest user
    const updatedGuest = await db.guestUser.update({
      where: { id },
      data: {
        status: newStatus,
        approvalDate: now,
        approvedBy: approverId,
      },
    })

    // Log the action
    await db.auditLog.create({
      data: {
        action: 'APPROVE_GUEST_USER',
        category: 'USER_MANAGEMENT',
        targetId: id,
        targetType: 'GuestUser',
        details: JSON.stringify({
          username: existingGuest.username,
          email: existingGuest.email,
          previousStatus: existingGuest.status,
          newStatus: newStatus,
          sponsorName: existingGuest.sponsorName,
          sponsorEmail: existingGuest.sponsorEmail,
          accessStartDate: existingGuest.accessStartDate,
          accessEndDate: existingGuest.accessEndDate,
          approvedBy: approverName || approverId,
        }),
        status: 'SUCCESS',
      },
    })

    // Create notification for the guest (optional)
    await db.notification.create({
      data: {
        type: 'guest-approved',
        referenceId: id,
        title: 'Guest Access Approved',
        message: `Guest user '${existingGuest.username}' has been approved for VPN access until ${existingGuest.accessEndDate.toISOString().split('T')[0]}.`,
        severity: 'success',
      },
    }).catch(() => {
      // Ignore notification creation errors
    })

    return NextResponse.json({
      success: true,
      data: updatedGuest,
      message: 'Guest user approved successfully',
    })
  } catch (error: any) {
    console.error('Error approving guest user:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to approve guest user', message: error.message },
      { status: 500 }
    )
=======
    const guest = await db.guestUser.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvalDate: new Date(),
        approvedBy: 'admin', // In production, get from auth
      }
    })
    return NextResponse.json({ success: true, guest })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to approve guest user' }, { status: 500 })
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  }
}
