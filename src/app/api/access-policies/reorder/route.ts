import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface ReorderItem {
  id: string
  priority: number
}

interface ReorderRequest {
  policies: ReorderItem[]
}

// POST - Reorder policy priorities
export async function POST(request: NextRequest) {
  try {
    const body: ReorderRequest = await request.json()
    const { policies } = body

    // Validate request
    if (!policies || !Array.isArray(policies)) {
      return NextResponse.json({ error: 'Policies array is required' }, { status: 400 })
    }

    if (policies.length === 0) {
      return NextResponse.json({ error: 'Policies array cannot be empty' }, { status: 400 })
    }

    // Validate each item
    for (const item of policies) {
      if (!item.id || typeof item.id !== 'string') {
        return NextResponse.json({ error: 'Each policy must have a valid id' }, { status: 400 })
      }
      if (typeof item.priority !== 'number' || item.priority < 1) {
        return NextResponse.json({ error: 'Priority must be a positive number' }, { status: 400 })
      }
    }

    // Check for duplicate IDs
    const ids = policies.map(p => p.id)
    const uniqueIds = new Set(ids)
    if (uniqueIds.size !== ids.length) {
      return NextResponse.json({ error: 'Duplicate policy IDs found' }, { status: 400 })
    }

    // Check for duplicate priorities
    const priorities = policies.map(p => p.priority)
    const uniquePriorities = new Set(priorities)
    if (uniquePriorities.size !== priorities.length) {
      return NextResponse.json({ error: 'Duplicate priorities found. Each policy must have a unique priority' }, { status: 400 })
    }

    // Verify all policies exist
    const existingPolicies = await db.accessPolicy.findMany({
      where: {
        id: { in: ids },
      },
      select: { id: true, name: true },
    })

    if (existingPolicies.length !== ids.length) {
      const foundIds = existingPolicies.map(p => p.id)
      const missingIds = ids.filter(id => !foundIds.includes(id))
      return NextResponse.json({
        error: `Some policies not found: ${missingIds.join(', ')}`,
      }, { status: 404 })
    }

    // Create a map for quick lookup
    const policyMap = new Map(existingPolicies.map(p => [p.id, p.name]))

    // Update policies in a transaction
    const updatePromises = policies.map(item =>
      db.accessPolicy.update({
        where: { id: item.id },
        data: { priority: item.priority },
      })
    )

    await db.$transaction(updatePromises)

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'REORDER_ACCESS_POLICIES',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'AccessPolicy',
        details: JSON.stringify({
          policies: policies.map(p => ({
            id: p.id,
            name: policyMap.get(p.id),
            priority: p.priority,
          })),
        }),
        status: 'SUCCESS',
      },
    })

    // Fetch updated policies to return
    const updatedPolicies = await db.accessPolicy.findMany({
      where: {
        id: { in: ids },
      },
      orderBy: { priority: 'asc' },
    })

    // Parse JSON fields for response
    const parsedPolicies = updatedPolicies.map((policy) => ({
      ...policy,
      userGroups: policy.userGroups ? JSON.parse(policy.userGroups) : null,
      certificateTypes: policy.certificateTypes ? JSON.parse(policy.certificateTypes) : null,
      deviceTypes: policy.deviceTypes ? JSON.parse(policy.deviceTypes) : null,
      sourceCountries: policy.sourceCountries ? JSON.parse(policy.sourceCountries) : null,
      sourceIpRanges: policy.sourceIpRanges ? JSON.parse(policy.sourceIpRanges) : null,
      timeSchedule: policy.timeSchedule ? JSON.parse(policy.timeSchedule) : null,
      allowedDestinations: policy.allowedDestinations ? JSON.parse(policy.allowedDestinations) : null,
      deniedDestinations: policy.deniedDestinations ? JSON.parse(policy.deniedDestinations) : null,
    }))

    return NextResponse.json({
      success: true,
      message: 'Policy priorities updated successfully',
      policies: parsedPolicies,
    })
  } catch (error) {
    console.error('Reorder access policies error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Move a single policy to a new position (shifts other policies)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { policyId, newPriority } = body

    if (!policyId || typeof policyId !== 'string') {
      return NextResponse.json({ error: 'Policy ID is required' }, { status: 400 })
    }

    if (typeof newPriority !== 'number' || newPriority < 1) {
      return NextResponse.json({ error: 'New priority must be a positive number' }, { status: 400 })
    }

    // Get the policy to move
    const policy = await db.accessPolicy.findUnique({
      where: { id: policyId },
    })

    if (!policy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 })
    }

    const oldPriority = policy.priority

    // If priority is the same, no change needed
    if (oldPriority === newPriority) {
      return NextResponse.json({
        success: true,
        message: 'Priority unchanged',
        policy,
      })
    }

    // Get all policies to reorder
    const allPolicies = await db.accessPolicy.findMany({
      orderBy: { priority: 'asc' },
    })

    // Use a transaction to update all affected policies
    await db.$transaction(async (tx) => {
      // If moving to a higher priority (lower number), shift policies down
      if (newPriority < oldPriority) {
        // Shift policies with priority >= newPriority and < oldPriority up by 1
        await tx.accessPolicy.updateMany({
          where: {
            priority: { gte: newPriority, lt: oldPriority },
            id: { not: policyId },
          },
          data: {
            priority: { increment: 1 },
          },
        })
      } else {
        // Moving to a lower priority (higher number)
        // Shift policies with priority > oldPriority and <= newPriority down by 1
        await tx.accessPolicy.updateMany({
          where: {
            priority: { gt: oldPriority, lte: newPriority },
            id: { not: policyId },
          },
          data: {
            priority: { decrement: 1 },
          },
        })
      }

      // Update the target policy
      await tx.accessPolicy.update({
        where: { id: policyId },
        data: { priority: newPriority },
      })
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'MOVE_ACCESS_POLICY',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetId: policyId,
        targetType: 'AccessPolicy',
        details: JSON.stringify({
          name: policy.name,
          oldPriority,
          newPriority,
        }),
        status: 'SUCCESS',
      },
    })

    // Fetch updated policies
    const updatedPolicies = await db.accessPolicy.findMany({
      orderBy: { priority: 'asc' },
    })

    // Parse JSON fields for response
    const parsedPolicies = updatedPolicies.map((p) => ({
      ...p,
      userGroups: p.userGroups ? JSON.parse(p.userGroups) : null,
      certificateTypes: p.certificateTypes ? JSON.parse(p.certificateTypes) : null,
      deviceTypes: p.deviceTypes ? JSON.parse(p.deviceTypes) : null,
      sourceCountries: p.sourceCountries ? JSON.parse(p.sourceCountries) : null,
      sourceIpRanges: p.sourceIpRanges ? JSON.parse(p.sourceIpRanges) : null,
      timeSchedule: p.timeSchedule ? JSON.parse(p.timeSchedule) : null,
      allowedDestinations: p.allowedDestinations ? JSON.parse(p.allowedDestinations) : null,
      deniedDestinations: p.deniedDestinations ? JSON.parse(p.deniedDestinations) : null,
    }))

    return NextResponse.json({
      success: true,
      message: 'Policy moved successfully',
      policies: parsedPolicies,
    })
  } catch (error) {
    console.error('Move access policy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
