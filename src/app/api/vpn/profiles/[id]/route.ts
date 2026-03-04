import { NextRequest, NextResponse } from 'next/server'
import {
  getProfileById,
  updateProfile,
  deleteProfile,
  applyProfile,
  validateProfileData,
} from '@/lib/vpn/profiles'
import { db } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET - Get single profile
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const profile = await getProfileById(id)

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Failed to fetch profile:', error)
    return NextResponse.json(
      { error: 'Failed to fetch connection profile' },
      { status: 500 }
    )
  }
}

// PUT - Update profile
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    // Check if profile exists
    const existing = await getProfileById(id)
    if (!existing) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Check for duplicate name if name is being changed
    if (body.name && body.name !== existing.name) {
      const duplicate = await db.connectionProfile.findUnique({
        where: { name: body.name }
      })
      if (duplicate) {
        return NextResponse.json(
          { error: 'A profile with this name already exists' },
          { status: 400 }
        )
      }
    }

    // Validate profile data
    const validation = validateProfileData({ ...existing, ...body })
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join(', ') },
        { status: 400 }
      )
    }

    // Update profile
    const profile = await updateProfile(id, body)

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'UPDATE_VPN_PROFILE',
        category: 'VPN_INTEGRATION',
        targetId: profile.id,
        targetType: 'ConnectionProfile',
        actorType: 'ADMIN',
        details: JSON.stringify({
          name: profile.name,
          changes: Object.keys(body)
        }),
        status: 'SUCCESS'
      }
    })

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Failed to update profile:', error)
    return NextResponse.json(
      { error: 'Failed to update connection profile' },
      { status: 500 }
    )
  }
}

// PATCH - Partial update (toggle enable/disable, set as default, apply)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    // Check if profile exists
    const existing = await getProfileById(id)
    if (!existing) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Apply profile action
    if (body.action === 'apply') {
      const result = await applyProfile(existing)

      // Log audit
      await db.auditLog.create({
        data: {
          action: 'APPLY_VPN_PROFILE',
          category: 'VPN_INTEGRATION',
          targetId: existing.id,
          targetType: 'ConnectionProfile',
          actorType: 'ADMIN',
          details: JSON.stringify({
            name: existing.name,
            configPath: result.configPath
          }),
          status: result.success ? 'SUCCESS' : 'FAILURE',
          errorMessage: result.success ? null : result.message
        }
      })

      return NextResponse.json(result, {
        status: result.success ? 200 : 400
      })
    }

    // Toggle enable/disable
    if (body.action === 'toggle') {
      const profile = await updateProfile(id, { isEnabled: !existing.isEnabled })

      // Log audit
      await db.auditLog.create({
        data: {
          action: existing.isEnabled ? 'DISABLE_VPN_PROFILE' : 'ENABLE_VPN_PROFILE',
          category: 'VPN_INTEGRATION',
          targetId: profile.id,
          targetType: 'ConnectionProfile',
          actorType: 'ADMIN',
          details: JSON.stringify({ name: profile.name }),
          status: 'SUCCESS'
        }
      })

      return NextResponse.json({ profile })
    }

    // Set as default
    if (body.action === 'set_default') {
      const profile = await updateProfile(id, { isDefault: true })

      // Log audit
      await db.auditLog.create({
        data: {
          action: 'SET_DEFAULT_VPN_PROFILE',
          category: 'VPN_INTEGRATION',
          targetId: profile.id,
          targetType: 'ConnectionProfile',
          actorType: 'ADMIN',
          details: JSON.stringify({ name: profile.name }),
          status: 'SUCCESS'
        }
      })

      return NextResponse.json({ profile })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Failed to patch profile:', error)
    return NextResponse.json(
      { error: 'Failed to update connection profile' },
      { status: 500 }
    )
  }
}

// DELETE - Delete profile
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Check if profile exists
    const existing = await getProfileById(id)
    if (!existing) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Don't allow deleting the default profile
    if (existing.isDefault) {
      return NextResponse.json(
        { error: 'Cannot delete the default profile. Set another profile as default first.' },
        { status: 400 }
      )
    }

    // Delete profile
    await deleteProfile(id)

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'DELETE_VPN_PROFILE',
        category: 'VPN_INTEGRATION',
        targetId: id,
        targetType: 'ConnectionProfile',
        actorType: 'ADMIN',
        details: JSON.stringify({
          name: existing.name,
          connectionName: existing.connectionName
        }),
        status: 'SUCCESS'
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete profile:', error)
    return NextResponse.json(
      { error: 'Failed to delete connection profile' },
      { status: 500 }
    )
  }
}
