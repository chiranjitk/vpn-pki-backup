import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
<<<<<<< HEAD
import { RestrictionType, RestrictionAction } from '@prisma/client'

// IPv4 validation regex
const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/

// IPv6 validation regex (simplified)
const IPV6_REGEX = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::$|^([0-9a-fA-F]{1,4}:){1,7}:$|^:([0-9a-fA-F]{1,4}:){1,7}$|^([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}$|^([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}$|^([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}$|^([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}$|^[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})$|^:((:[0-9a-fA-F]{1,4}){1,7}|:)$/

// Country code validation (ISO 3166-1 alpha-2)
const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/

// ASN validation
const ASN_REGEX = /^AS\d+$/i

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

// Validate CIDR notation
function isValidCIDR(cidr: string): boolean {
  const parts = cidr.split('/')
  if (parts.length !== 2) return false

  const [ip, prefix] = parts
  const prefixNum = parseInt(prefix, 10)

  // Check if IP is valid
  if (!isValidIP(ip)) return false

  // Check prefix length
  if (isNaN(prefixNum)) return false

  // IPv4 prefix: 0-32, IPv6 prefix: 0-128
  if (isValidIPv4(ip)) {
    return prefixNum >= 0 && prefixNum <= 32
  } else if (isValidIPv6(ip)) {
    return prefixNum >= 0 && prefixNum <= 128
  }

  return false
}

// Validate country code
function isValidCountryCode(code: string): boolean {
  return COUNTRY_CODE_REGEX.test(code)
}

// Validate ASN
function isValidASN(asn: string): boolean {
  return ASN_REGEX.test(asn)
}

// Validate restriction value based on type
function validateRestrictionValue(type: RestrictionType, value: string): { valid: boolean; error?: string } {
  switch (type) {
    case 'COUNTRY':
      if (!isValidCountryCode(value)) {
        return { valid: false, error: 'Invalid country code. Must be ISO 3166-1 alpha-2 (e.g., US, CN, RU)' }
      }
      break
    case 'IP_ADDRESS':
      if (!isValidIP(value)) {
        return { valid: false, error: 'Invalid IP address. Must be valid IPv4 or IPv6' }
      }
      break
    case 'IP_RANGE':
      if (!isValidCIDR(value)) {
        return { valid: false, error: 'Invalid CIDR notation. Must be valid IP/prefix (e.g., 192.168.1.0/24)' }
      }
      break
    case 'ASN':
      if (!isValidASN(value)) {
        return { valid: false, error: 'Invalid ASN. Must be in format AS<number> (e.g., AS15169)' }
      }
      break
    default:
      return { valid: false, error: 'Invalid restriction type' }
  }
  return { valid: true }
}

// GET - List all geo/IP restrictions
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') as RestrictionType | null
    const action = searchParams.get('action') as RestrictionAction | null
    const isEnabled = searchParams.get('isEnabled')
    const search = searchParams.get('search')

    const where: {
      type?: RestrictionType
      action?: RestrictionAction
      isEnabled?: boolean
      OR?: Array<{ value: { contains: string }; description?: { contains: string } }>
    } = {}

    if (type && Object.values(RestrictionType).includes(type)) {
      where.type = type
    }
    if (action && Object.values(RestrictionAction).includes(action)) {
      where.action = action
    }
    if (isEnabled !== null) {
      where.isEnabled = isEnabled === 'true'
    }
    if (search) {
      where.OR = [
        { value: { contains: search } },
        { description: { contains: search } }
      ]
    }

    const restrictions = await db.geoIpRestriction.findMany({
      where,
      orderBy: [
        { type: 'asc' },
        { createdAt: 'desc' }
      ],
    })

    // Group by type for summary
    const summary = {
      total: restrictions.length,
      enabled: restrictions.filter(r => r.isEnabled).length,
      disabled: restrictions.filter(r => !r.isEnabled).length,
      byType: {
        COUNTRY: restrictions.filter(r => r.type === 'COUNTRY').length,
        IP_ADDRESS: restrictions.filter(r => r.type === 'IP_ADDRESS').length,
        IP_RANGE: restrictions.filter(r => r.type === 'IP_RANGE').length,
        ASN: restrictions.filter(r => r.type === 'ASN').length,
      },
      byAction: {
        BLOCK: restrictions.filter(r => r.action === 'BLOCK').length,
        ALLOW: restrictions.filter(r => r.action === 'ALLOW').length,
      },
    }

    return NextResponse.json({ restrictions, summary })
  } catch (error) {
    console.error('Get geo restrictions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new geo/IP restriction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, value, description, action = 'BLOCK', isEnabled = true, source = 'manual' } = body

    // Validate required fields
    if (!type || !value) {
      return NextResponse.json({ error: 'Type and value are required' }, { status: 400 })
    }

    // Validate type
    if (!Object.values(RestrictionType).includes(type)) {
      return NextResponse.json({ error: 'Invalid restriction type' }, { status: 400 })
    }

    // Validate action
    if (!Object.values(RestrictionAction).includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be BLOCK or ALLOW' }, { status: 400 })
    }

    // Normalize value based on type
    let normalizedValue = value
    if (type === 'COUNTRY') {
      normalizedValue = value.toUpperCase()
    } else if (type === 'ASN') {
      normalizedValue = value.toUpperCase()
    } else if (type === 'IP_ADDRESS') {
      normalizedValue = value.trim()
    } else if (type === 'IP_RANGE') {
      normalizedValue = value.trim()
    }

    // Validate value based on type
    const validation = validateRestrictionValue(type, normalizedValue)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Check for duplicates
    const existing = await db.geoIpRestriction.findFirst({
      where: { type, value: normalizedValue }
    })
    if (existing) {
      return NextResponse.json({ 
        error: 'A restriction with this type and value already exists',
        existingRestriction: existing 
      }, { status: 409 })
    }

    // Create restriction
    const restriction = await db.geoIpRestriction.create({
      data: {
        type,
        value: normalizedValue,
        description,
        action,
        isEnabled,
        source,
      },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'CREATE_GEO_RESTRICTION',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetId: restriction.id,
        targetType: 'GeoIpRestriction',
        details: JSON.stringify({ type, value: normalizedValue, action, isEnabled }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ success: true, restriction }, { status: 201 })
  } catch (error) {
    console.error('Create geo restriction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
=======

export async function GET() {
  try {
    const restrictions = await db.geoIpRestriction.findMany({
      orderBy: { createdAt: 'desc' }
    })
    
    const stats = {
      total: restrictions.length,
      enabled: restrictions.filter(r => r.isEnabled).length,
      blocked: restrictions.filter(r => r.action === 'BLOCK').length,
      allowed: restrictions.filter(r => r.action === 'ALLOW').length,
      countries: restrictions.filter(r => r.type === 'COUNTRY').length,
      ips: restrictions.filter(r => r.type === 'IP_ADDRESS').length,
      ranges: restrictions.filter(r => r.type === 'IP_RANGE').length,
      asns: restrictions.filter(r => r.type === 'ASN').length,
    }
    
    return NextResponse.json({ restrictions, stats })
  } catch (error) {
    console.error('Failed to fetch geo restrictions:', error)
    return NextResponse.json({ error: 'Failed to fetch restrictions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, value, description, action, isEnabled } = body
    
    if (!type || !value) {
      return NextResponse.json({ error: 'Type and value are required' }, { status: 400 })
    }
    
    const restriction = await db.geoIpRestriction.create({
      data: {
        type,
        value,
        description: description || null,
        action: action || 'BLOCK',
        isEnabled: isEnabled ?? true,
        source: 'manual',
      }
    })
    
    return NextResponse.json({ success: true, restriction })
  } catch (error) {
    console.error('Failed to create restriction:', error)
    return NextResponse.json({ error: 'Failed to create restriction' }, { status: 500 })
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  }
}
