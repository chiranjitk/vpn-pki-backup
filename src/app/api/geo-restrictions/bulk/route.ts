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
        return { valid: false, error: 'Invalid country code' }
      }
      break
    case 'IP_ADDRESS':
      if (!isValidIP(value)) {
        return { valid: false, error: 'Invalid IP address' }
      }
      break
    case 'IP_RANGE':
      if (!isValidCIDR(value)) {
        return { valid: false, error: 'Invalid CIDR notation' }
      }
      break
    case 'ASN':
      if (!isValidASN(value)) {
        return { valid: false, error: 'Invalid ASN' }
      }
      break
    default:
      return { valid: false, error: 'Invalid restriction type' }
  }
  return { valid: true }
}

// Normalize value based on type
function normalizeValue(type: RestrictionType, value: string): string {
  if (type === 'COUNTRY' || type === 'ASN') {
    return value.toUpperCase()
  }
  return value.trim()
}

interface BulkRestrictionItem {
  type: RestrictionType
  value: string
  description?: string
  action?: RestrictionAction
  isEnabled?: boolean
  source?: string
}

interface BulkImportResult {
  success: boolean
  created: number
  skipped: number
  failed: number
  errors: Array<{ index: number; value: string; error: string }>
  createdItems: Array<{ id: string; type: string; value: string }>
  skippedItems: Array<{ type: string; value: string; reason: string }>
}

// POST - Bulk import geo/IP restrictions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { restrictions, defaultAction = 'BLOCK', defaultEnabled = true, defaultSource = 'bulk-import', skipDuplicates = true } = body as {
      restrictions: BulkRestrictionItem[]
      defaultAction?: RestrictionAction
      defaultEnabled?: boolean
      defaultSource?: string
      skipDuplicates?: boolean
    }

    // Validate input
    if (!restrictions || !Array.isArray(restrictions)) {
      return NextResponse.json({ error: 'Restrictions array is required' }, { status: 400 })
    }

    if (restrictions.length === 0) {
      return NextResponse.json({ error: 'Restrictions array cannot be empty' }, { status: 400 })
    }

    if (restrictions.length > 1000) {
      return NextResponse.json({ error: 'Maximum 1000 restrictions allowed per bulk import' }, { status: 400 })
    }

    // Validate default action
    if (!Object.values(RestrictionAction).includes(defaultAction)) {
      return NextResponse.json({ error: 'Invalid default action' }, { status: 400 })
    }

    const result: BulkImportResult = {
      success: true,
      created: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      createdItems: [],
      skippedItems: [],
    }

    // Get existing restrictions for duplicate checking
    const existingRestrictions = await db.geoIpRestriction.findMany({
      select: { type: true, value: true }
    })
    const existingMap = new Map<string, boolean>()
    existingRestrictions.forEach(r => {
      existingMap.set(`${r.type}:${r.value}`, true)
    })

    // Validate and prepare items
    const validItems: Array<{
      type: RestrictionType
      value: string
      description?: string
      action: RestrictionAction
      isEnabled: boolean
      source: string
    }> = []

    for (let i = 0; i < restrictions.length; i++) {
      const item = restrictions[i]

      // Validate type
      if (!item.type || !Object.values(RestrictionType).includes(item.type)) {
        result.failed++
        result.errors.push({
          index: i,
          value: item?.value || 'unknown',
          error: 'Invalid or missing restriction type'
        })
        continue
      }

      // Validate value
      if (!item.value) {
        result.failed++
        result.errors.push({
          index: i,
          value: 'unknown',
          error: 'Missing value'
        })
        continue
      }

      // Normalize and validate value
      const normalizedValue = normalizeValue(item.type, item.value)
      const validation = validateRestrictionValue(item.type, normalizedValue)

      if (!validation.valid) {
        result.failed++
        result.errors.push({
          index: i,
          value: item.value,
          error: validation.error || 'Invalid value'
        })
        continue
      }

      // Validate action if provided
      if (item.action && !Object.values(RestrictionAction).includes(item.action)) {
        result.failed++
        result.errors.push({
          index: i,
          value: item.value,
          error: 'Invalid action'
        })
        continue
      }

      // Check for duplicates
      const key = `${item.type}:${normalizedValue}`
      if (existingMap.has(key)) {
        if (skipDuplicates) {
          result.skipped++
          result.skippedItems.push({
            type: item.type,
            value: normalizedValue,
            reason: 'Already exists'
          })
          continue
        } else {
          result.failed++
          result.errors.push({
            index: i,
            value: normalizedValue,
            error: 'Duplicate restriction'
          })
          continue
        }
      }

      // Add to valid items
      validItems.push({
        type: item.type,
        value: normalizedValue,
        description: item.description,
        action: item.action || defaultAction,
        isEnabled: item.isEnabled !== undefined ? item.isEnabled : defaultEnabled,
        source: item.source || defaultSource,
      })

      // Mark as seen for duplicate checking within the batch
      existingMap.set(key, true)
    }

    // Bulk insert valid items
    if (validItems.length > 0) {
      try {
        const created = await db.geoIpRestriction.createMany({
          data: validItems,
          skipDuplicates: true,
        })

        result.created = created.count

        // Fetch created items for response
        const createdItems = await db.geoIpRestriction.findMany({
          where: {
            AND: [
              { source: defaultSource },
              { createdAt: { gte: new Date(Date.now() - 5000) } }
            ]
          },
          select: { id: true, type: true, value: true },
          take: validItems.length,
        })

        result.createdItems = createdItems.map(item => ({
          id: item.id,
          type: item.type,
          value: item.value
        }))

      } catch (createError) {
        console.error('Bulk create error:', createError)
        result.failed += validItems.length
        result.errors.push({
          index: -1,
          value: 'batch',
          error: 'Failed to create restrictions batch'
        })
      }
    }

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'BULK_IMPORT_GEO_RESTRICTIONS',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'GeoIpRestriction',
        details: JSON.stringify({
          totalAttempted: restrictions.length,
          created: result.created,
          skipped: result.skipped,
          failed: result.failed,
          defaultAction,
          defaultSource
        }),
        status: result.failed > 0 ? 'WARNING' : 'SUCCESS',
      },
    })

    // Set overall success based on results
    result.success = result.created > 0 || result.skipped > 0

    return NextResponse.json(result, { status: result.failed > 0 && result.created === 0 ? 400 : 200 })
  } catch (error) {
    console.error('Bulk import geo restrictions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Bulk delete geo/IP restrictions
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids, type, action } = body as {
      ids?: string[]
      type?: RestrictionType
      action?: RestrictionAction
    }

    // Must provide either ids or filter criteria
    if (!ids && !type && !action) {
      return NextResponse.json({ 
        error: 'Must provide either ids array or filter criteria (type and/or action)' 
      }, { status: 400 })
    }

    let whereClause: {
      id?: { in: string[] }
      type?: RestrictionType
      action?: RestrictionAction
    } = {}

    if (ids && Array.isArray(ids) && ids.length > 0) {
      whereClause.id = { in: ids }
    }
    if (type && Object.values(RestrictionType).includes(type)) {
      whereClause.type = type
    }
    if (action && Object.values(RestrictionAction).includes(action)) {
      whereClause.action = action
    }

    // Count items to be deleted
    const count = await db.geoIpRestriction.count({ where: whereClause })

    if (count === 0) {
      return NextResponse.json({ 
        success: true, 
        deleted: 0,
        message: 'No restrictions matched the criteria' 
      })
    }

    // Delete restrictions
    const deleted = await db.geoIpRestriction.deleteMany({ where: whereClause })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'BULK_DELETE_GEO_RESTRICTIONS',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'GeoIpRestriction',
        details: JSON.stringify({
          deletedCount: deleted.count,
          criteria: whereClause
        }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ 
      success: true, 
      deleted: deleted.count 
    })
  } catch (error) {
    console.error('Bulk delete geo restrictions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
