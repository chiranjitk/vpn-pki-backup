import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
<<<<<<< HEAD
import { GuestStatus } from '@prisma/client'

// POST /api/guest-users/[id]/revoke - Revoke guest user access
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

    // Check if guest user can be revoked
    const revocableStatuses = [
      GuestStatus.PENDING, 
      GuestStatus.APPROVED, 
      GuestStatus.ACTIVE
    ]
    
    if (!revocableStatuses.includes(existingGuest.status)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot revoke guest user with status '${existingGuest.status}'. Only PENDING, APPROVED, or ACTIVE guests can be revoked.` 
        },
        { status: 400 }
      )
    }

    // Validate reason is provided
    const reason = body.reason
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: 'A reason for revocation is required (minimum 5 characters)' },
        { status: 400 }
      )
    }

    // Get revoker info
    const revokedBy = body.revokedBy || null

    // Update the guest user
    const updatedGuest = await db.guestUser.update({
      where: { id },
      data: {
        status: GuestStatus.REVOKED,
      },
    })

    // If there's a certificate, it should be revoked too
    if (existingGuest.certificateId) {
      try {
        // Update certificate status to REVOKED
        await db.certificate.update({
          where: { id: existingGuest.certificateId },
          data: { status: 'REVOKED' },
        })

        // Create revocation record
        await db.revocation.create({
          data: {
            certificateId: existingGuest.certificateId,
            reason: 'PRIVILEGE_WITHDRAWN', // Guest access revoked
            revokedBy: revokedBy || 'system',
            notes: `Guest access revoked: ${reason}`,
          },
        })
      } catch (certError) {
        console.error('Error revoking certificate:', certError)
        // Continue with guest revocation even if certificate revocation fails
      }
    }

    // Log the action
    await db.auditLog.create({
      data: {
        action: 'REVOKE_GUEST_ACCESS',
        category: 'USER_MANAGEMENT',
        targetId: id,
        targetType: 'GuestUser',
        details: JSON.stringify({
          username: existingGuest.username,
          email: existingGuest.email,
          previousStatus: existingGuest.status,
          sponsorName: existingGuest.sponsorName,
          sponsorEmail: existingGuest.sponsorEmail,
          reason: reason,
          revokedBy: revokedBy,
          certificateId: existingGuest.certificateId,
        }),
        status: 'SUCCESS',
      },
    })

    // Create notification
    await db.notification.create({
      data: {
        type: 'guest-revoked',
        referenceId: id,
        title: 'Guest Access Revoked',
        message: `Guest user '${existingGuest.username}' access has been revoked. Reason: ${reason}`,
        severity: 'warning',
      },
    }).catch(() => {
      // Ignore notification creation errors
    })

    // TODO: Terminate any active VPN sessions for this guest
    // This would require integration with the VPN session management

    return NextResponse.json({
      success: true,
      data: updatedGuest,
      message: 'Guest access revoked successfully',
    })
  } catch (error: any) {
    console.error('Error revoking guest access:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to revoke guest access', message: error.message },
      { status: 500 }
    )
=======
    const body = await request.json()
    
    const guest = await db.guestUser.update({
      where: { id },
      data: {
        status: 'REVOKED',
      }
    })
    return NextResponse.json({ success: true, guest })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to revoke guest user' }, { status: 500 })
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  }
}
