import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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
  }
}
