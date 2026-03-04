import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PolicyAction } from '@prisma/client'

interface PreviewRequest {
  // User info
  userId?: string
  username?: string
  userGroups?: string[]
  
  // Certificate info
  certificateType?: string
  certificateSerial?: string
  
  // Device info
  deviceType?: string
  
  // Connection info
  sourceIp?: string
  sourceCountry?: string
  
  // Time context
  timestamp?: string
  
  // Destination info
  destinationIp?: string
  
  // Preview options
  includeDisabled?: boolean
}

interface PolicyPreviewResult {
  policyId: string
  policyName: string
  priority: number
  isEnabled: boolean
  action: PolicyAction
  
  // Match results
  matches: boolean
  matchScore: number // Number of conditions matched
  
  // Condition breakdown
  conditions: {
    userGroups: { required: boolean; matched: boolean; values?: string[] }
    certificateTypes: { required: boolean; matched: boolean; values?: string[] }
    deviceTypes: { required: boolean; matched: boolean; values?: string[] }
    sourceCountries: { required: boolean; matched: boolean; values?: string[] }
    sourceIpRanges: { required: boolean; matched: boolean; values?: string[] }
    timeSchedule: { required: boolean; matched: boolean; schedule?: unknown }
    destinationRestrictions: { required: boolean; matched: boolean; allowed?: string[]; denied?: string[] }
  }
  
  // Action details
  bandwidthLimit?: number
  sessionTimeout?: number
  maxConcurrentSessions?: number
}

// Check if current time matches the schedule
function matchesTimeSchedule(timeSchedule: unknown, timestamp: Date): { matched: boolean; reason: string } {
  if (!timeSchedule || typeof timeSchedule !== 'object') {
    return { matched: true, reason: 'No schedule restriction' }
  }

  const schedule = timeSchedule as {
    days?: number[]
    startTime?: string
    endTime?: string
    timezone?: string
  }

  const dayOfWeek = timestamp.getDay()
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  // Check day
  if (schedule.days && Array.isArray(schedule.days)) {
    if (!schedule.days.includes(dayOfWeek)) {
      return {
        matched: false,
        reason: `Current day (${dayNames[dayOfWeek]}) not in allowed days: ${schedule.days.map(d => dayNames[d]).join(', ')}`,
      }
    }
  }

  // Check time range
  if (schedule.startTime && schedule.endTime) {
    const currentTime = timestamp.getHours() * 60 + timestamp.getMinutes()
    const currentTimeStr = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}`
    
    const [startHour, startMin] = schedule.startTime.split(':').map(Number)
    const [endHour, endMin] = schedule.endTime.split(':').map(Number)
    
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin

    if (startMinutes <= endMinutes) {
      if (currentTime < startMinutes || currentTime > endMinutes) {
        return {
          matched: false,
          reason: `Current time (${currentTimeStr}) outside allowed range (${schedule.startTime} - ${schedule.endTime})`,
        }
      }
    } else {
      if (currentTime < startMinutes && currentTime > endMinutes) {
        return {
          matched: false,
          reason: `Current time (${currentTimeStr}) outside allowed overnight range (${schedule.startTime} - ${schedule.endTime})`,
        }
      }
    }
  }

  return { matched: true, reason: 'Within allowed schedule' }
}

// Check if IP is in CIDR range
function isIpInCidr(ip: string, cidr: string): boolean {
  const ipParts = ip.split('.').map(Number)
  if (ipParts.length !== 4) return false

  const [cidrIp, prefixStr] = cidr.split('/')
  const prefix = prefixStr ? parseInt(prefixStr, 10) : 32
  const cidrParts = cidrIp.split('.').map(Number)

  if (cidrParts.length !== 4) return false

  const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0
  const ipNum = ((ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3]) >>> 0
  const cidrNum = ((cidrParts[0] << 24) | (cidrParts[1] << 16) | (cidrParts[2] << 8) | cidrParts[3]) >>> 0

  return (ipNum & mask) === (cidrNum & mask)
}

// POST - Preview policy matching for a given context
export async function POST(request: NextRequest) {
  try {
    const body: PreviewRequest = await request.json()

    // Build query
    const where: { isEnabled?: boolean } = {}
    if (!body.includeDisabled) {
      where.isEnabled = true
    }

    // Get policies
    const policies = await db.accessPolicy.findMany({
      where,
      orderBy: { priority: 'asc' },
    })

    const userGroups = body.userGroups || []
    const timestamp = body.timestamp ? new Date(body.timestamp) : new Date()

    // Process each policy
    const previewResults: PolicyPreviewResult[] = policies.map((policy) => {
      // Parse JSON fields
      const policyUserGroups = policy.userGroups ? JSON.parse(policy.userGroups) : null
      const policyCertTypes = policy.certificateTypes ? JSON.parse(policy.certificateTypes) : null
      const policyDeviceTypes = policy.deviceTypes ? JSON.parse(policy.deviceTypes) : null
      const policySourceCountries = policy.sourceCountries ? JSON.parse(policy.sourceCountries) : null
      const policySourceIpRanges = policy.sourceIpRanges ? JSON.parse(policy.sourceIpRanges) : null
      const policyTimeSchedule = policy.timeSchedule ? JSON.parse(policy.timeSchedule) : null
      const policyAllowedDest = policy.allowedDestinations ? JSON.parse(policy.allowedDestinations) : null
      const policyDeniedDest = policy.deniedDestinations ? JSON.parse(policy.deniedDestinations) : null

      // Evaluate each condition
      const conditions: PolicyPreviewResult['conditions'] = {
        userGroups: {
          required: !!(policyUserGroups && policyUserGroups.length > 0),
          matched: !policyUserGroups || policyUserGroups.length === 0 || userGroups.some((g: string) => policyUserGroups.includes(g)),
          values: policyUserGroups || undefined,
        },
        certificateTypes: {
          required: !!(policyCertTypes && policyCertTypes.length > 0),
          matched: !policyCertTypes || policyCertTypes.length === 0 || (body.certificateType ? policyCertTypes.includes(body.certificateType) : false),
          values: policyCertTypes || undefined,
        },
        deviceTypes: {
          required: !!(policyDeviceTypes && policyDeviceTypes.length > 0),
          matched: !policyDeviceTypes || policyDeviceTypes.length === 0 || (body.deviceType ? policyDeviceTypes.includes(body.deviceType) : false),
          values: policyDeviceTypes || undefined,
        },
        sourceCountries: {
          required: !!(policySourceCountries && policySourceCountries.length > 0),
          matched: !policySourceCountries || policySourceCountries.length === 0 || (body.sourceCountry ? policySourceCountries.includes(body.sourceCountry) : false),
          values: policySourceCountries || undefined,
        },
        sourceIpRanges: {
          required: !!(policySourceIpRanges && policySourceIpRanges.length > 0),
          matched: !policySourceIpRanges || policySourceIpRanges.length === 0 || (body.sourceIp ? policySourceIpRanges.some((range: string) => isIpInCidr(body.sourceIp as string, range)) : false),
          values: policySourceIpRanges || undefined,
        },
        timeSchedule: {
          required: !!policyTimeSchedule,
          matched: matchesTimeSchedule(policyTimeSchedule, timestamp).matched,
          schedule: policyTimeSchedule || undefined,
        },
        destinationRestrictions: {
          required: !!(policyAllowedDest || policyDeniedDest),
          matched: (() => {
            // Check if destination is in allowed list (if specified)
            if (policyAllowedDest && policyAllowedDest.length > 0 && body.destinationIp) {
              if (!policyAllowedDest.some((range: string) => isIpInCidr(body.destinationIp as string, range))) {
                return false
              }
            }
            // Check if destination is in denied list
            if (policyDeniedDest && policyDeniedDest.length > 0 && body.destinationIp) {
              if (policyDeniedDest.some((range: string) => isIpInCidr(body.destinationIp as string, range))) {
                return false
              }
            }
            return true
          })(),
          allowed: policyAllowedDest || undefined,
          denied: policyDeniedDest || undefined,
        },
      }

      // Calculate match score
      const matchScore = Object.values(conditions).filter(c => c.matched).length
      const requiredConditionsMet = Object.values(conditions)
        .filter(c => c.required)
        .every(c => c.matched)
      
      // Overall match: all required conditions must be met
      const matches = requiredConditionsMet

      return {
        policyId: policy.id,
        policyName: policy.name,
        priority: policy.priority,
        isEnabled: policy.isEnabled,
        action: policy.action,
        matches,
        matchScore,
        conditions,
        bandwidthLimit: policy.bandwidthLimit || undefined,
        sessionTimeout: policy.sessionTimeout || undefined,
        maxConcurrentSessions: policy.maxConcurrentSessions || undefined,
      }
    })

    // Find the winning policy (first matching enabled policy)
    const winningPolicy = previewResults.find(p => p.matches && p.isEnabled)

    // Calculate summary
    const summary = {
      totalPolicies: policies.length,
      enabledPolicies: policies.filter(p => p.isEnabled).length,
      matchingPolicies: previewResults.filter(p => p.matches).length,
      winningPolicy: winningPolicy ? {
        id: winningPolicy.policyId,
        name: winningPolicy.policyName,
        action: winningPolicy.action,
        priority: winningPolicy.priority,
      } : null,
      defaultAction: 'DENY' as PolicyAction, // Default action if no policy matches
    }

    return NextResponse.json({
      success: true,
      previewContext: {
        userId: body.userId,
        username: body.username,
        userGroups: body.userGroups,
        certificateType: body.certificateType,
        deviceType: body.deviceType,
        sourceIp: body.sourceIp,
        sourceCountry: body.sourceCountry,
        destinationIp: body.destinationIp,
        timestamp: timestamp.toISOString(),
      },
      summary,
      policies: previewResults,
    })
  } catch (error) {
    console.error('Preview access policies error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
