import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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
  }
}
