import { NextRequest, NextResponse } from 'next/server'
import {
  getAllProfiles,
  getProfileById,
  createProfile,
  updateProfile,
  deleteProfile,
  validateProfileData,
  getProfileStats,
  applyProfile,
  applyAllProfiles,
  previewConfig,
} from '@/lib/vpn/profiles'
import { db } from '@/lib/db'

// VPN Connection Profiles API - strongSwan 6.0.1 integration

// GET - List all connection profiles or get stats/preview
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const preview = searchParams.get('preview')
    const search = searchParams.get('search')

    // Get statistics
    if (action === 'stats') {
      const stats = await getProfileStats()
      return NextResponse.json({ stats })
    }

    // Preview configuration
    if (preview === 'true' || action === 'preview') {
      const profileId = searchParams.get('id')
      try {
        const config = await previewConfig(profileId || undefined)
        return NextResponse.json({ config })
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to generate preview' },
          { status: 400 }
        )
      }
    }

    // Get IP pools for dropdown
    if (action === 'pools') {
      const pools = await db.ipPool.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, cidr: true, status: true }
      })
      return NextResponse.json({ pools })
    }

    // Default: list all profiles with search and IP pools
    let profiles = await getAllProfiles()

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase()
      profiles = profiles.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.connectionName.toLowerCase().includes(searchLower) ||
        (p.description && p.description.toLowerCase().includes(searchLower))
      )
    }

    // Get IP pools for the form
    const ipPools = await db.ipPool.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, cidr: true, status: true }
    })

    // Get CA certificates for the form
    const caCertificates = await db.certificateAuthority.findMany({
      where: { status: 'ACTIVE' },
      select: { 
        id: true, 
        name: true, 
        subject: true,
        isDefault: true,
        certificatePath: true
      }
    })

    return NextResponse.json({ profiles, ipPools, caCertificates })
  } catch (error) {
    console.error('Failed to fetch profiles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch connection profiles' },
      { status: 500 }
    )
  }
}

// POST - Create new profile or apply profiles
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Apply single profile action
    if (body.action === 'apply' && body.id) {
      const profile = await getProfileById(body.id)
      if (!profile) {
        return NextResponse.json(
          { error: 'Profile not found' },
          { status: 404 }
        )
      }

      const result = await applyProfile(profile)
      
      // Log audit
      await db.auditLog.create({
        data: {
          action: 'APPLY_VPN_PROFILE',
          category: 'VPN_INTEGRATION',
          targetId: profile.id,
          targetType: 'ConnectionProfile',
          actorType: 'ADMIN',
          details: JSON.stringify({
            name: profile.name,
            connectionName: profile.connectionName,
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
    
    // Apply all profiles action
    if (body.action === 'applyAll' || body.action === 'apply_all') {
      const result = await applyAllProfiles()
      
      // Log audit
      await db.auditLog.create({
        data: {
          action: 'APPLY_ALL_VPN_PROFILES',
          category: 'VPN_INTEGRATION',
          actorType: 'ADMIN',
          details: JSON.stringify({
            profilesApplied: result.profilesApplied,
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

    // Create new profile
    const { name, description, isDefault, isEnabled, ...profileData } = body
    
    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Profile name is required' },
        { status: 400 }
      )
    }

    // Check for duplicate name
    const existing = await db.connectionProfile.findUnique({
      where: { name }
    })
    if (existing) {
      return NextResponse.json(
        { error: 'A profile with this name already exists' },
        { status: 400 }
      )
    }

    // Validate profile data
    const validation = validateProfileData({ name, ...profileData })
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join(', ') },
        { status: 400 }
      )
    }

    // Create profile
    const profile = await createProfile({
      name,
      description,
      isDefault,
      isEnabled,
      ...profileData
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'CREATE_VPN_PROFILE',
        category: 'VPN_INTEGRATION',
        targetId: profile.id,
        targetType: 'ConnectionProfile',
        actorType: 'ADMIN',
        details: JSON.stringify({
          name: profile.name,
          connectionName: profile.connectionName
        }),
        status: 'SUCCESS'
      }
    })

    return NextResponse.json({ profile }, { status: 201 })
  } catch (error) {
    console.error('Failed to create profile:', error)
    return NextResponse.json(
      { error: 'Failed to create connection profile' },
      { status: 500 }
    )
  }
}

// PUT - Update a profile
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Profile ID is required' },
        { status: 400 }
      )
    }

    // Check if profile exists
    const existing = await getProfileById(id)
    if (!existing) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // If name is being changed, check for duplicates
    if (updateData.name && updateData.name !== existing.name) {
      const duplicate = await db.connectionProfile.findUnique({
        where: { name: updateData.name }
      })
      if (duplicate) {
        return NextResponse.json(
          { error: 'A profile with this name already exists' },
          { status: 400 }
        )
      }
    }

    // Validate profile data
    const validation = validateProfileData({ name: updateData.name || existing.name, ...updateData })
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join(', ') },
        { status: 400 }
      )
    }

    // Update profile
    const profile = await updateProfile(id, updateData)

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'UPDATE_VPN_PROFILE',
        category: 'VPN_INTEGRATION',
        targetId: id,
        targetType: 'ConnectionProfile',
        actorType: 'ADMIN',
        details: JSON.stringify({
          name: profile.name,
          changes: Object.keys(updateData)
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

// DELETE - Delete a profile
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Profile ID is required' },
        { status: 400 }
      )
    }

    // Check if profile exists
    const profile = await getProfileById(id)
    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
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
          name: profile.name,
          connectionName: profile.connectionName
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
