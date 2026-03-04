import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PolicyAction } from '@prisma/client'

// Types for creating/updating policies
interface TimeSchedule {
  days?: number[] // 0-6 (Sunday-Saturday)
  startTime?: string // HH:mm format
  endTime?: string // HH:mm format
  timezone?: string
}

interface PolicyCreateInput {
  name: string
  description?: string
  priority?: number
  userGroups?: string[]
  certificateTypes?: string[]
  deviceTypes?: string[]
  sourceCountries?: string[]
  sourceIpRanges?: string[]
  timeSchedule?: TimeSchedule
  action?: PolicyAction
  bandwidthLimit?: number
  sessionTimeout?: number
  maxConcurrentSessions?: number
  allowedDestinations?: string[]
  deniedDestinations?: string[]
  isEnabled?: boolean
}

// GET - List all access policies
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const enabled = searchParams.get('enabled')
    const action = searchParams.get('action')

    // Build filter conditions
    const where: Record<string, unknown> = {}
    if (enabled !== null) {
      where.isEnabled = enabled === 'true'
    }
    if (action && ['ALLOW', 'DENY', 'QUARANTINE', 'MONITOR'].includes(action)) {
      where.action = action as PolicyAction
    }

    const policies = await db.accessPolicy.findMany({
      where,
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'desc' },
      ],
    })

    // Parse JSON fields for response
    const parsedPolicies = policies.map((policy) => ({
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
      policies: parsedPolicies,
      total: parsedPolicies.length,
    })
  } catch (error) {
    console.error('Get access policies error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new access policy
export async function POST(request: NextRequest) {
  try {
    const body: PolicyCreateInput = await request.json()
    const {
      name,
      description,
      priority = 100,
      userGroups,
      certificateTypes,
      deviceTypes,
      sourceCountries,
      sourceIpRanges,
      timeSchedule,
      action = 'ALLOW',
      bandwidthLimit,
      sessionTimeout,
      maxConcurrentSessions,
      allowedDestinations,
      deniedDestinations,
      isEnabled = true,
    } = body

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Policy name is required' }, { status: 400 })
    }

    // Validate action
    const validActions: PolicyAction[] = ['ALLOW', 'DENY', 'QUARANTINE', 'MONITOR']
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be ALLOW, DENY, QUARANTINE, or MONITOR' }, { status: 400 })
    }

    // Check for duplicate name
    const existingPolicy = await db.accessPolicy.findFirst({
      where: { name: name.trim() },
    })
    if (existingPolicy) {
      return NextResponse.json({ error: 'A policy with this name already exists' }, { status: 400 })
    }

    // Validate time schedule if provided
    if (timeSchedule) {
      if (timeSchedule.days && (!Array.isArray(timeSchedule.days) || timeSchedule.days.some(d => d < 0 || d > 6))) {
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
    if (sourceIpRanges && Array.isArray(sourceIpRanges)) {
      const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))?$/
      const invalidIp = sourceIpRanges.find(ip => !cidrRegex.test(ip))
      if (invalidIp) {
        return NextResponse.json({ error: `Invalid IP range format: ${invalidIp}` }, { status: 400 })
      }
    }

    if (allowedDestinations && Array.isArray(allowedDestinations)) {
      const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))?$/
      const invalidIp = allowedDestinations.find(ip => !cidrRegex.test(ip))
      if (invalidIp) {
        return NextResponse.json({ error: `Invalid allowed destination format: ${invalidIp}` }, { status: 400 })
      }
    }

    if (deniedDestinations && Array.isArray(deniedDestinations)) {
      const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))?$/
      const invalidIp = deniedDestinations.find(ip => !cidrRegex.test(ip))
      if (invalidIp) {
        return NextResponse.json({ error: `Invalid denied destination format: ${invalidIp}` }, { status: 400 })
      }
    }

    // Create policy
    const policy = await db.accessPolicy.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        priority,
        userGroups: userGroups && userGroups.length > 0 ? JSON.stringify(userGroups) : null,
        certificateTypes: certificateTypes && certificateTypes.length > 0 ? JSON.stringify(certificateTypes) : null,
        deviceTypes: deviceTypes && deviceTypes.length > 0 ? JSON.stringify(deviceTypes) : null,
        sourceCountries: sourceCountries && sourceCountries.length > 0 ? JSON.stringify(sourceCountries) : null,
        sourceIpRanges: sourceIpRanges && sourceIpRanges.length > 0 ? JSON.stringify(sourceIpRanges) : null,
        timeSchedule: timeSchedule ? JSON.stringify(timeSchedule) : null,
        action,
        bandwidthLimit: bandwidthLimit && bandwidthLimit > 0 ? bandwidthLimit : null,
        sessionTimeout: sessionTimeout && sessionTimeout > 0 ? sessionTimeout : null,
        maxConcurrentSessions: maxConcurrentSessions && maxConcurrentSessions > 0 ? maxConcurrentSessions : null,
        allowedDestinations: allowedDestinations && allowedDestinations.length > 0 ? JSON.stringify(allowedDestinations) : null,
        deniedDestinations: deniedDestinations && deniedDestinations.length > 0 ? JSON.stringify(deniedDestinations) : null,
        isEnabled,
      },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'CREATE_ACCESS_POLICY',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetId: policy.id,
        targetType: 'AccessPolicy',
        details: JSON.stringify({
          name: policy.name,
          action: policy.action,
          priority: policy.priority,
        }),
        status: 'SUCCESS',
      },
    })

    // Return parsed policy
    return NextResponse.json({
      success: true,
      policy: {
        ...policy,
        userGroups: policy.userGroups ? JSON.parse(policy.userGroups) : null,
        certificateTypes: policy.certificateTypes ? JSON.parse(policy.certificateTypes) : null,
        deviceTypes: policy.deviceTypes ? JSON.parse(policy.deviceTypes) : null,
        sourceCountries: policy.sourceCountries ? JSON.parse(policy.sourceCountries) : null,
        sourceIpRanges: policy.sourceIpRanges ? JSON.parse(policy.sourceIpRanges) : null,
        timeSchedule: policy.timeSchedule ? JSON.parse(policy.timeSchedule) : null,
        allowedDestinations: policy.allowedDestinations ? JSON.parse(policy.allowedDestinations) : null,
        deniedDestinations: policy.deniedDestinations ? JSON.parse(policy.deniedDestinations) : null,
      },
    })
  } catch (error) {
    console.error('Create access policy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
