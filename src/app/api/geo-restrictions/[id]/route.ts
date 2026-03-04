import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
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

// GET - Get a single geo/IP restriction
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const restriction = await db.geoIpRestriction.findUnique({
      where: { id },
    })

    if (!restriction) {
      return NextResponse.json({ error: 'Restriction not found' }, { status: 404 })
    }

    return NextResponse.json({ restriction })
  } catch (error) {
    console.error('Get geo restriction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update a geo/IP restriction
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { type, value, description, action, isEnabled, source } = body

    // Check if restriction exists
    const existing = await db.geoIpRestriction.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Restriction not found' }, { status: 404 })
    }

    // Determine the type to use for validation
    const targetType = type || existing.type

    // Validate type if provided
    if (type && !Object.values(RestrictionType).includes(type)) {
      return NextResponse.json({ error: 'Invalid restriction type' }, { status: 400 })
    }

    // Validate action if provided
    if (action && !Object.values(RestrictionAction).includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be BLOCK or ALLOW' }, { status: 400 })
    }

    // Normalize value based on type
    let normalizedValue = value || existing.value
    if (targetType === 'COUNTRY') {
      normalizedValue = normalizedValue.toUpperCase()
    } else if (targetType === 'ASN') {
      normalizedValue = normalizedValue.toUpperCase()
    } else if (targetType === 'IP_ADDRESS' || targetType === 'IP_RANGE') {
      normalizedValue = normalizedValue.trim()
    }

    // Validate value if provided
    if (value) {
      const validation = validateRestrictionValue(targetType, normalizedValue)
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
      }
    }

    // Check for duplicates (excluding current restriction)
    if (value || type) {
      const duplicate = await db.geoIpRestriction.findFirst({
        where: {
          type: targetType,
          value: normalizedValue,
          NOT: { id }
        }
      })
      if (duplicate) {
        return NextResponse.json({
          error: 'A restriction with this type and value already exists',
          existingRestriction: duplicate
        }, { status: 409 })
      }
    }

    // Update restriction
    const updated = await db.geoIpRestriction.update({
      where: { id },
      data: {
        type: targetType,
        value: normalizedValue,
        description: description !== undefined ? description : existing.description,
        action: action || existing.action,
        isEnabled: isEnabled !== undefined ? isEnabled : existing.isEnabled,
        source: source || existing.source,
      },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'UPDATE_GEO_RESTRICTION',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetId: id,
        targetType: 'GeoIpRestriction',
        details: JSON.stringify({
          previous: { type: existing.type, value: existing.value, action: existing.action, isEnabled: existing.isEnabled },
          current: { type: updated.type, value: updated.value, action: updated.action, isEnabled: updated.isEnabled }
        }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ success: true, restriction: updated })
  } catch (error) {
    console.error('Update geo restriction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Partial update of a geo/IP restriction
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Check if restriction exists
    const existing = await db.geoIpRestriction.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Restriction not found' }, { status: 404 })
    }

    // Build update data
    const updateData: {
      type?: RestrictionType
      value?: string
      description?: string | null
      action?: RestrictionAction
      isEnabled?: boolean
      source?: string
    } = {}

    // Validate and add fields
    if (body.type !== undefined) {
      if (!Object.values(RestrictionType).includes(body.type)) {
        return NextResponse.json({ error: 'Invalid restriction type' }, { status: 400 })
      }
      updateData.type = body.type
    }

    if (body.action !== undefined) {
      if (!Object.values(RestrictionAction).includes(body.action)) {
        return NextResponse.json({ error: 'Invalid action. Must be BLOCK or ALLOW' }, { status: 400 })
      }
      updateData.action = body.action
    }

    if (body.value !== undefined) {
      const targetType = updateData.type || existing.type
      let normalizedValue = body.value

      if (targetType === 'COUNTRY') {
        normalizedValue = normalizedValue.toUpperCase()
      } else if (targetType === 'ASN') {
        normalizedValue = normalizedValue.toUpperCase()
      } else if (targetType === 'IP_ADDRESS' || targetType === 'IP_RANGE') {
        normalizedValue = normalizedValue.trim()
      }

      const validation = validateRestrictionValue(targetType, normalizedValue)
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
      }

      // Check for duplicates
      const duplicate = await db.geoIpRestriction.findFirst({
        where: {
          type: targetType,
          value: normalizedValue,
          NOT: { id }
        }
      })
      if (duplicate) {
        return NextResponse.json({
          error: 'A restriction with this type and value already exists'
        }, { status: 409 })
      }

      updateData.value = normalizedValue
    }

    if (body.description !== undefined) {
      updateData.description = body.description
    }

    if (body.isEnabled !== undefined) {
      updateData.isEnabled = body.isEnabled
    }

    if (body.source !== undefined) {
      updateData.source = body.source
    }

    // Update restriction
    const updated = await db.geoIpRestriction.update({
      where: { id },
      data: updateData,
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'UPDATE_GEO_RESTRICTION',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetId: id,
        targetType: 'GeoIpRestriction',
        details: JSON.stringify({
          changes: updateData
        }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ success: true, restriction: updated })
  } catch (error) {
    console.error('Patch geo restriction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete a geo/IP restriction
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if restriction exists
    const existing = await db.geoIpRestriction.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Restriction not found' }, { status: 404 })
    }

    // Delete restriction
    await db.geoIpRestriction.delete({ where: { id } })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'DELETE_GEO_RESTRICTION',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetId: id,
        targetType: 'GeoIpRestriction',
        details: JSON.stringify({
          type: existing.type,
          value: existing.value,
          action: existing.action
        }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete geo restriction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
