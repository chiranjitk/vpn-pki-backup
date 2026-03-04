import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PolicyAction } from '@prisma/client'

interface EvaluateRequest {
  // User info
  userId?: string
  username?: string
  userGroups?: string[]
  
  // Certificate info
  certificateType?: string
  certificateSerial?: string
  
  // Device info
  deviceType?: string // 'windows', 'macos', 'ios', 'android', etc.
  
  // Connection info
  sourceIp?: string
  sourceCountry?: string
  
  // Time context (optional - defaults to now)
  timestamp?: string
  
  // Destination info (for policy action determination)
  destinationIp?: string
}

interface PolicyMatch {
  policyId: string
  policyName: string
  action: PolicyAction
  priority: number
  matchedConditions: string[]
  bandwidthLimit?: number
  sessionTimeout?: number
  maxConcurrentSessions?: number
  allowedDestinations?: string[]
  deniedDestinations?: string[]
}

// Check if current time matches the schedule
function matchesTimeSchedule(timeSchedule: unknown, timestamp: Date): boolean {
  if (!timeSchedule || typeof timeSchedule !== 'object') return true

  const schedule = timeSchedule as {
    days?: number[]
    startTime?: string
    endTime?: string
    timezone?: string
  }

  // Get the day of week (0-6, Sunday-Saturday)
  const dayOfWeek = timestamp.getDay()

  // Check if the day is allowed
  if (schedule.days && Array.isArray(schedule.days)) {
    if (!schedule.days.includes(dayOfWeek)) {
      return false
    }
  }

  // Check time range
  if (schedule.startTime && schedule.endTime) {
    const currentTime = timestamp.getHours() * 60 + timestamp.getMinutes()
    
    const [startHour, startMin] = schedule.startTime.split(':').map(Number)
    const [endHour, endMin] = schedule.endTime.split(':').map(Number)
    
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin

    if (startMinutes <= endMinutes) {
      // Normal range (e.g., 09:00 - 17:00)
      if (currentTime < startMinutes || currentTime > endMinutes) {
        return false
      }
    } else {
      // Overnight range (e.g., 22:00 - 06:00)
      if (currentTime < startMinutes && currentTime > endMinutes) {
        return false
      }
    }
  }

  return true
}

// Check if IP is in CIDR range
function isIpInCidr(ip: string, cidr: string): boolean {
  const ipParts = ip.split('.').map(Number)
  if (ipParts.length !== 4) return false

  const [cidrIp, prefixStr] = cidr.split('/')
  const prefix = prefixStr ? parseInt(prefixStr, 10) : 32
  const cidrParts = cidrIp.split('.').map(Number)

  if (cidrParts.length !== 4) return false

  // Create a mask for the prefix
  const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0

  // Convert IPs to 32-bit integers
  const ipNum = ((ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3]) >>> 0
  const cidrNum = ((cidrParts[0] << 24) | (cidrParts[1] << 16) | (cidrParts[2] << 8) | cidrParts[3]) >>> 0

  // Compare with mask
  return (ipNum & mask) === (cidrNum & mask)
}

// Check if IP matches any of the ranges
function matchesIpRanges(ip: string, ranges: string[]): boolean {
  if (!ranges || ranges.length === 0) return true
  return ranges.some(range => isIpInCidr(ip, range))
}

// Evaluate policies against request context
async function evaluatePolicies(request: EvaluateRequest): Promise<{
  matched: boolean
  matchResult?: PolicyMatch
  evaluationDetails: {
    totalPolicies: number
    enabledPolicies: number
    evaluatedPolicies: number
    skippedReasons: string[]
  }
}> {
  const evaluationDetails = {
    totalPolicies: 0,
    enabledPolicies: 0,
    evaluatedPolicies: 0,
    skippedReasons: [] as string[],
  }

  // Get all enabled policies ordered by priority
  const policies = await db.accessPolicy.findMany({
    where: { isEnabled: true },
    orderBy: { priority: 'asc' },
  })

  evaluationDetails.totalPolicies = await db.accessPolicy.count()
  evaluationDetails.enabledPolicies = policies.length

  // Get user groups if userId is provided
  let userGroups = request.userGroups || []
  if (request.userId && userGroups.length === 0) {
    // Try to get user groups from database if available
    // This is a placeholder - you might need to implement user-group mapping
  }

  // Use current time or provided timestamp
  const timestamp = request.timestamp ? new Date(request.timestamp) : new Date()

  // Evaluate each policy in priority order
  for (const policy of policies) {
    const matchedConditions: string[] = []
    let matches = true

    // Parse JSON fields
    const policyUserGroups = policy.userGroups ? JSON.parse(policy.userGroups) : null
    const policyCertTypes = policy.certificateTypes ? JSON.parse(policy.certificateTypes) : null
    const policyDeviceTypes = policy.deviceTypes ? JSON.parse(policy.deviceTypes) : null
    const policySourceCountries = policy.sourceCountries ? JSON.parse(policy.sourceCountries) : null
    const policySourceIpRanges = policy.sourceIpRanges ? JSON.parse(policy.sourceIpRanges) : null
    const policyTimeSchedule = policy.timeSchedule ? JSON.parse(policy.timeSchedule) : null
    const policyAllowedDest = policy.allowedDestinations ? JSON.parse(policy.allowedDestinations) : null
    const policyDeniedDest = policy.deniedDestinations ? JSON.parse(policy.deniedDestinations) : null

    // Check user groups
    if (policyUserGroups && policyUserGroups.length > 0) {
      if (userGroups.length === 0) {
        matches = false
      } else {
        const hasMatchingGroup = userGroups.some((g: string) => policyUserGroups.includes(g))
        if (!hasMatchingGroup) {
          matches = false
        } else {
          matchedConditions.push('userGroups')
        }
      }
    }

    // Check certificate types
    if (matches && policyCertTypes && policyCertTypes.length > 0) {
      if (!request.certificateType || !policyCertTypes.includes(request.certificateType)) {
        matches = false
      } else {
        matchedConditions.push('certificateTypes')
      }
    }

    // Check device types
    if (matches && policyDeviceTypes && policyDeviceTypes.length > 0) {
      if (!request.deviceType || !policyDeviceTypes.includes(request.deviceType)) {
        matches = false
      } else {
        matchedConditions.push('deviceTypes')
      }
    }

    // Check source countries
    if (matches && policySourceCountries && policySourceCountries.length > 0) {
      if (!request.sourceCountry || !policySourceCountries.includes(request.sourceCountry)) {
        matches = false
      } else {
        matchedConditions.push('sourceCountries')
      }
    }

    // Check source IP ranges
    if (matches && policySourceIpRanges && policySourceIpRanges.length > 0) {
      if (!request.sourceIp || !matchesIpRanges(request.sourceIp, policySourceIpRanges)) {
        matches = false
      } else {
        matchedConditions.push('sourceIpRanges')
      }
    }

    // Check time schedule
    if (matches && policyTimeSchedule) {
      if (!matchesTimeSchedule(policyTimeSchedule, timestamp)) {
        matches = false
      } else {
        matchedConditions.push('timeSchedule')
      }
    }

    evaluationDetails.evaluatedPolicies++

    // If policy matches, return it
    if (matches) {
      return {
        matched: true,
        matchResult: {
          policyId: policy.id,
          policyName: policy.name,
          action: policy.action,
          priority: policy.priority,
          matchedConditions: matchedConditions.length > 0 ? matchedConditions : ['all (no specific conditions)'],
          bandwidthLimit: policy.bandwidthLimit || undefined,
          sessionTimeout: policy.sessionTimeout || undefined,
          maxConcurrentSessions: policy.maxConcurrentSessions || undefined,
          allowedDestinations: policyAllowedDest || undefined,
          deniedDestinations: policyDeniedDest || undefined,
        },
        evaluationDetails,
      }
    }
  }

  // No policy matched
  return {
    matched: false,
    evaluationDetails,
  }
}

// POST - Evaluate user/connection against policies
export async function POST(request: NextRequest) {
  try {
    const body: EvaluateRequest = await request.json()

    // Validate required fields
    if (!body.userId && !body.username && !body.certificateSerial) {
      return NextResponse.json({
        error: 'At least one of userId, username, or certificateSerial is required',
      }, { status: 400 })
    }

    // Evaluate policies
    const result = await evaluatePolicies(body)

    // Determine final decision
    let finalDecision: PolicyAction = 'DENY' // Default to deny if no policy matches
    let decisionReason = 'No matching policy found - default deny'

    if (result.matched && result.matchResult) {
      finalDecision = result.matchResult.action
      decisionReason = `Matched policy: ${result.matchResult.policyName}`
    }

    // Log the evaluation
    await db.auditLog.create({
      data: {
        action: 'EVALUATE_ACCESS_POLICY',
        category: 'VPN_INTEGRATION',
        actorType: 'SYSTEM',
        targetType: 'AccessPolicy',
        details: JSON.stringify({
          request: {
            userId: body.userId,
            username: body.username,
            deviceType: body.deviceType,
            sourceIp: body.sourceIp,
            sourceCountry: body.sourceCountry,
          },
          result: {
            matched: result.matched,
            policyName: result.matchResult?.policyName,
            action: finalDecision,
          },
          evaluationDetails: result.evaluationDetails,
        }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({
      success: true,
      decision: finalDecision,
      decisionReason,
      matched: result.matched,
      matchResult: result.matchResult,
      evaluationDetails: result.evaluationDetails,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Evaluate access policy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
