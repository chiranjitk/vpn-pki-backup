import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PolicyAction } from '@prisma/client'

// Helper to parse policy JSON fields
function parsePolicyJsonFields(policy: Record<string, unknown>) {
  return {
    ...policy,
    userGroups: policy.userGroups ? JSON.parse(policy.userGroups as string) : null,
    certificateTypes: policy.certificateTypes ? JSON.parse(policy.certificateTypes as string) : null,
    deviceTypes: policy.deviceTypes ? JSON.parse(policy.deviceTypes as string) : null,
    sourceCountries: policy.sourceCountries ? JSON.parse(policy.sourceCountries as string) : null,
    sourceIpRanges: policy.sourceIpRanges ? JSON.parse(policy.sourceIpRanges as string) : null,
    timeSchedule: policy.timeSchedule ? JSON.parse(policy.timeSchedule as string) : null,
    allowedDestinations: policy.allowedDestinations ? JSON.parse(policy.allowedDestinations as string) : null,
    deniedDestinations: policy.deniedDestinations ? JSON.parse(policy.deniedDestinations as string) : null,
  }
}

// GET - Get a single access policy
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const policy = await db.accessPolicy.findUnique({
      where: { id },
    })

    if (!policy) {
      return NextResponse.json({ error: 'Access policy not found' }, { status: 404 })
    }

    return NextResponse.json({ policy: parsePolicyJsonFields(policy) })
  } catch (error) {
    console.error('Get access policy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update an access policy
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      name,
      description,
      priority,
      userGroups,
      certificateTypes,
      deviceTypes,
      sourceCountries,
      sourceIpRanges,
      timeSchedule,
      action,
      bandwidthLimit,
      sessionTimeout,
      maxConcurrentSessions,
      allowedDestinations,
      deniedDestinations,
      isEnabled,
    } = body

    // Check if policy exists
    const existingPolicy = await db.accessPolicy.findUnique({ where: { id } })
    if (!existingPolicy) {
      return NextResponse.json({ error: 'Access policy not found' }, { status: 404 })
    }

    // Validate action if provided
    if (action) {
      const validActions: PolicyAction[] = ['ALLOW', 'DENY', 'QUARANTINE', 'MONITOR']
      if (!validActions.includes(action)) {
        return NextResponse.json({ error: 'Invalid action. Must be ALLOW, DENY, QUARANTINE, or MONITOR' }, { status: 400 })
      }
    }

    // Check for duplicate name (if name is being changed)
    if (name && name !== existingPolicy.name) {
      const duplicateName = await db.accessPolicy.findFirst({
        where: { name: name.trim(), id: { not: id } },
      })
      if (duplicateName) {
        return NextResponse.json({ error: 'A policy with this name already exists' }, { status: 400 })
      }
    }

    // Validate time schedule if provided
    if (timeSchedule) {
      if (timeSchedule.days && (!Array.isArray(timeSchedule.days) || timeSchedule.days.some((d: number) => d < 0 || d > 6))) {
        return NextResponse.json({ error: 'Invalid days in time schedule. Must be array of 0-6' }, { status: 400 })
      }
      if (timeSchedule.startTime && !/^\d{2}:\d{2}$/.test(timeSchedule.startTime)) {
        return NextResponse.json({ error: 'Invalid startTime format. Use HH:mm' }, { status: 400 })
      }
      if (timeSchedule.endTime && !/^\d{2}:\d{2}$/.test(timeSchedule.endTime)) {
        return NextResponse.json({ error: 'Invalid endTime format. Use HH:mm' }, { status: 400 })
      }
    }

    // Validate IP ranges if provided
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))?$/
    
    if (sourceIpRanges && Array.isArray(sourceIpRanges)) {
      const invalidIp = sourceIpRanges.find((ip: string) => !cidrRegex.test(ip))
      if (invalidIp) {
        return NextResponse.json({ error: `Invalid IP range format: ${invalidIp}` }, { status: 400 })
      }
    }

    if (allowedDestinations && Array.isArray(allowedDestinations)) {
      const invalidIp = allowedDestinations.find((ip: string) => !cidrRegex.test(ip))
      if (invalidIp) {
        return NextResponse.json({ error: `Invalid allowed destination format: ${invalidIp}` }, { status: 400 })
      }
    }

    if (deniedDestinations && Array.isArray(deniedDestinations)) {
      const invalidIp = deniedDestinations.find((ip: string) => !cidrRegex.test(ip))
      if (invalidIp) {
        return NextResponse.json({ error: `Invalid denied destination format: ${invalidIp}` }, { status: 400 })
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (priority !== undefined) updateData.priority = priority
    if (action !== undefined) updateData.action = action
    if (bandwidthLimit !== undefined) updateData.bandwidthLimit = bandwidthLimit && bandwidthLimit > 0 ? bandwidthLimit : null
    if (sessionTimeout !== undefined) updateData.sessionTimeout = sessionTimeout && sessionTimeout > 0 ? sessionTimeout : null
    if (maxConcurrentSessions !== undefined) updateData.maxConcurrentSessions = maxConcurrentSessions && maxConcurrentSessions > 0 ? maxConcurrentSessions : null
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled

    // Handle JSON fields
    if (userGroups !== undefined) updateData.userGroups = userGroups && userGroups.length > 0 ? JSON.stringify(userGroups) : null
    if (certificateTypes !== undefined) updateData.certificateTypes = certificateTypes && certificateTypes.length > 0 ? JSON.stringify(certificateTypes) : null
    if (deviceTypes !== undefined) updateData.deviceTypes = deviceTypes && deviceTypes.length > 0 ? JSON.stringify(deviceTypes) : null
    if (sourceCountries !== undefined) updateData.sourceCountries = sourceCountries && sourceCountries.length > 0 ? JSON.stringify(sourceCountries) : null
    if (sourceIpRanges !== undefined) updateData.sourceIpRanges = sourceIpRanges && sourceIpRanges.length > 0 ? JSON.stringify(sourceIpRanges) : null
    if (timeSchedule !== undefined) updateData.timeSchedule = timeSchedule ? JSON.stringify(timeSchedule) : null
    if (allowedDestinations !== undefined) updateData.allowedDestinations = allowedDestinations && allowedDestinations.length > 0 ? JSON.stringify(allowedDestinations) : null
    if (deniedDestinations !== undefined) updateData.deniedDestinations = deniedDestinations && deniedDestinations.length > 0 ? JSON.stringify(deniedDestinations) : null

    // Update policy
    const updatedPolicy = await db.accessPolicy.update({
      where: { id },
      data: updateData,
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'UPDATE_ACCESS_POLICY',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetId: id,
        targetType: 'AccessPolicy',
        details: JSON.stringify({
          name: updatedPolicy.name,
          action: updatedPolicy.action,
          changes: Object.keys(updateData),
        }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({
      success: true,
      policy: parsePolicyJsonFields(updatedPolicy),
    })
  } catch (error) {
    console.error('Update access policy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete an access policy
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const policy = await db.accessPolicy.findUnique({ where: { id } })
    if (!policy) {
      return NextResponse.json({ error: 'Access policy not found' }, { status: 404 })
    }

    await db.accessPolicy.delete({ where: { id } })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'DELETE_ACCESS_POLICY',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetId: id,
        targetType: 'AccessPolicy',
        details: JSON.stringify({
          name: policy.name,
          action: policy.action,
          priority: policy.priority,
        }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete access policy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Partial update (alias for PUT behavior with partial data)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return PUT(request, { params })
}
