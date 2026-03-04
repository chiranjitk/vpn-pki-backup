import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
<<<<<<< HEAD
import { RestrictionAction } from '@prisma/client'

// IPv4 validation regex
const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/

// IPv6 validation regex (simplified)
const IPV6_REGEX = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::$|^([0-9a-fA-F]{1,4}:){1,7}:$|^:([0-9a-fA-F]{1,4}:){1,7}$|^([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}$|^([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}$|^([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}$|^([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}$|^[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})$|^:((:[0-9a-fA-F]{1,4}){1,7}|:)$/

// Validate IPv4 address
function isValidIPv4(ip: string): boolean {
  if (!IPV4_REGEX.test(ip)) return false
  const parts = ip.split('.')
  return parts.every((part) => {
    const num = parseInt(part, 10)
    return num >= 0 && num <= 255
  })
}

// Validate IPv6 address
function isValidIPv6(ip: string): boolean {
  return IPV6_REGEX.test(ip)
}

// Validate IP address (IPv4 or IPv6)
function isValidIP(ip: string): boolean {
  return isValidIPv4(ip) || isValidIPv6(ip)
}

// Convert IPv4 string to number
function ipv4ToNumber(ip: string): number {
  const parts = ip.split('.').map(p => parseInt(p, 10))
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
}

// Convert IPv4 number to string
function numberToIpv4(num: number): string {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255
  ].join('.')
}

// Get network address from IP and prefix
function getNetworkAddressIPv4(ip: string, prefix: number): number {
  const ipNum = ipv4ToNumber(ip)
  const mask = prefix === 0 ? 0 : ~((1 << (32 - prefix)) - 1) >>> 0
  return (ipNum & mask) >>> 0
}

// Check if IPv4 is in CIDR range
function isIPv4InCIDR(ip: string, cidr: string): boolean {
  const [rangeIp, prefixStr] = cidr.split('/')
  const prefix = parseInt(prefixStr, 10)

  if (!isValidIPv4(ip) || !isValidIPv4(rangeIp)) {
    return false
  }

  const ipNum = ipv4ToNumber(ip)
  const rangeNum = ipv4ToNumber(rangeIp)

  if (prefix === 0) {
    return true // /0 matches everything
  }

  const mask = ~((1 << (32 - prefix)) - 1) >>> 0
  return (ipNum & mask) === (rangeNum & mask)
}

// Expand IPv6 to full form
function expandIPv6(ip: string): string {
  if (ip === '::') return '0000:0000:0000:0000:0000:0000:0000:0000'

  let expanded = ip

  // Handle :: compression
  if (expanded.includes('::')) {
    const parts = expanded.split('::')
    const leftParts = parts[0] ? parts[0].split(':') : []
    const rightParts = parts[1] ? parts[1].split(':') : []
    const missingParts = 8 - leftParts.length - rightParts.length
    const middle = Array(missingParts).fill('0000')
    expanded = [...leftParts, ...middle, ...rightParts].join(':')
  }

  // Pad each part to 4 characters
  return expanded.split(':').map(part => part.padStart(4, '0')).join(':')
}

// Convert IPv6 to BigInt
function ipv6ToBigInt(ip: string): bigint {
  const expanded = expandIPv6(ip)
  const parts = expanded.split(':')
  let result = BigInt(0)
  for (const part of parts) {
    result = (result << BigInt(16)) | BigInt(parseInt(part, 16))
  }
  return result
}

// Check if IPv6 is in CIDR range
function isIPv6InCIDR(ip: string, cidr: string): boolean {
  const [rangeIp, prefixStr] = cidr.split('/')
  const prefix = parseInt(prefixStr, 10)

  if (!isValidIPv6(ip) || !isValidIPv6(rangeIp)) {
    return false
  }

  const ipNum = ipv6ToBigInt(ip)
  const rangeNum = ipv6ToBigInt(rangeIp)

  if (prefix === 0) {
    return true // /0 matches everything
  }

  const mask = (BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF') >> BigInt(128 - prefix)) << BigInt(128 - prefix)
  return (ipNum & mask) === (rangeNum & mask)
}

// Check if IP is in CIDR range
function isIPInCIDR(ip: string, cidr: string): boolean {
  if (isValidIPv4(ip) && isValidIPv4(cidr.split('/')[0])) {
    return isIPv4InCIDR(ip, cidr)
  }
  if (isValidIPv6(ip) && isValidIPv6(cidr.split('/')[0])) {
    return isIPv6InCIDR(ip, cidr)
  }
  return false
}

interface CheckResult {
  ip: string
  isBlocked: boolean
  isAllowed: boolean
  matchedRestrictions: Array<{
    id: string
    type: string
    value: string
    action: string
    description?: string | null
  }>
  matchedBy: {
    country: Array<{ id: string; value: string; action: string }>
    ipAddress: Array<{ id: string; value: string; action: string }>
    ipRange: Array<{ id: string; value: string; action: string }>
    asn: Array<{ id: string; value: string; action: string }>
  }
  recommendation: 'ALLOW' | 'BLOCK' | 'CHECK_MANUAL'
}

// POST - Check if IP is blocked
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ip, country, asn, includeDetails = false } = body as {
      ip: string
      country?: string
      asn?: string
      includeDetails?: boolean
    }

    // Validate IP
    if (!ip) {
      return NextResponse.json({ error: 'IP address is required' }, { status: 400 })
    }

    const normalizedIP = ip.trim()

    if (!isValidIP(normalizedIP)) {
      return NextResponse.json({ error: 'Invalid IP address format' }, { status: 400 })
    }

    // Get all enabled restrictions
    const restrictions = await db.geoIpRestriction.findMany({
      where: { isEnabled: true },
      orderBy: [
        // Order by specificity: IP_ADDRESS > IP_RANGE > COUNTRY > ASN
        { type: 'asc' }
      ],
    })

    const result: CheckResult = {
      ip: normalizedIP,
      isBlocked: false,
      isAllowed: false,
      matchedRestrictions: [],
      matchedBy: {
        country: [],
        ipAddress: [],
        ipRange: [],
        asn: [],
      },
      recommendation: 'ALLOW',
    }

    // Check each restriction
    for (const restriction of restrictions) {
      let matched = false

      switch (restriction.type) {
        case 'IP_ADDRESS':
          // Direct IP comparison
          if (restriction.value === normalizedIP) {
            matched = true
          }
          break

        case 'IP_RANGE':
          // CIDR range check
          if (isIPInCIDR(normalizedIP, restriction.value)) {
            matched = true
          }
          break

        case 'COUNTRY':
          // Country match (requires country parameter)
          if (country && restriction.value.toUpperCase() === country.toUpperCase()) {
            matched = true
          }
          break

        case 'ASN':
          // ASN match (requires asn parameter)
          if (asn && restriction.value.toUpperCase() === asn.toUpperCase()) {
            matched = true
          }
          break
      }

      if (matched) {
        result.matchedRestrictions.push({
          id: restriction.id,
          type: restriction.type,
          value: restriction.value,
          action: restriction.action,
          description: restriction.description,
        })

        // Categorize matches
        const matchInfo = { id: restriction.id, value: restriction.value, action: restriction.action }
        switch (restriction.type) {
          case 'COUNTRY':
            result.matchedBy.country.push(matchInfo)
            break
          case 'IP_ADDRESS':
            result.matchedBy.ipAddress.push(matchInfo)
            break
          case 'IP_RANGE':
            result.matchedBy.ipRange.push(matchInfo)
            break
          case 'ASN':
            result.matchedBy.asn.push(matchInfo)
            break
        }

        // Determine action
        if (restriction.action === 'BLOCK') {
          result.isBlocked = true
        } else if (restriction.action === 'ALLOW') {
          result.isAllowed = true
        }
      }
    }

    // Determine recommendation
    // Priority: ALLOW rules override BLOCK rules (whitelist takes precedence)
    if (result.matchedRestrictions.length === 0) {
      result.recommendation = 'ALLOW'
    } else if (result.isAllowed) {
      // If there's any ALLOW match, allow the connection
      result.recommendation = 'ALLOW'
      result.isBlocked = false // ALLOW overrides BLOCK
    } else if (result.isBlocked) {
      result.recommendation = 'BLOCK'
    } else {
      result.recommendation = 'CHECK_MANUAL'
    }

    // Remove sensitive details if not requested
    if (!includeDetails) {
      result.matchedRestrictions = result.matchedRestrictions.map(r => ({
        id: r.id,
        type: r.type,
        value: r.value,
        action: r.action,
        description: null,
      }))
      result.matchedBy = {
        country: result.matchedBy.country,
        ipAddress: result.matchedBy.ipAddress,
        ipRange: result.matchedBy.ipRange,
        asn: result.matchedBy.asn,
      }
    }

    // Log check for audit (optional, can be disabled for performance)
    if (process.env.LOG_GEO_CHECKS === 'true') {
      await db.auditLog.create({
        data: {
          action: 'CHECK_GEO_RESTRICTION',
          category: 'VPN_INTEGRATION',
          actorType: 'SYSTEM',
          targetType: 'GeoIpRestriction',
          details: JSON.stringify({
            ip: normalizedIP,
            country,
            asn,
            result: result.recommendation,
            matchedCount: result.matchedRestrictions.length
          }),
          status: 'SUCCESS',
        },
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Check geo restriction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET - Quick check via query params (convenience method)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const ip = searchParams.get('ip')
    const country = searchParams.get('country')
    const asn = searchParams.get('asn')
    const includeDetails = searchParams.get('details') === 'true'

    if (!ip) {
      return NextResponse.json({ error: 'IP address is required (use ?ip=xxx query param)' }, { status: 400 })
    }

    // Reuse POST logic by constructing request body
    const body = { ip, country: country || undefined, asn: asn || undefined, includeDetails }

    // Create a new request with the body
    const newRequest = new NextRequest(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    return POST(newRequest)
  } catch (error) {
    console.error('Check geo restriction GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
=======

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ip } = body
    
    if (!ip) {
      return NextResponse.json({ error: 'IP address is required' }, { status: 400 })
    }
    
    const restrictions = await db.geoIpRestriction.findMany({
      where: { isEnabled: true }
    })
    
    let blocked = false
    let reason = ''
    
    for (const r of restrictions) {
      if (r.type === 'IP_ADDRESS' && r.value === ip) {
        blocked = r.action === 'BLOCK'
        reason = `IP ${r.action === 'BLOCK' ? 'blocked' : 'allowed'}: ${r.value}`
        break
      }
      if (r.type === 'IP_RANGE') {
        const [range] = r.value.split('/')
        if (ip.startsWith(range.substring(0, range.lastIndexOf('.')))) {
          blocked = r.action === 'BLOCK'
          reason = `Range ${r.action === 'BLOCK' ? 'blocked' : 'allowed'}: ${r.value}`
          break
        }
      }
    }
    
    return NextResponse.json({ blocked, reason: reason || 'No restrictions match this IP' })
  } catch (error) {
    console.error('Failed to check IP:', error)
    return NextResponse.json({ error: 'Failed to check IP' }, { status: 500 })
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  }
}
