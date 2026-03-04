import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - List all IP pools
export async function GET() {
  try {
    // Get IP pools from database (using SystemSetting as a simple key-value store)
    const poolsSetting = await db.systemSetting.findUnique({
      where: { key: 'vpn_ip_pools' }
    })

    let pools = []
    if (poolsSetting?.value) {
      try {
        pools = JSON.parse(poolsSetting.value)
      } catch {
        pools = []
      }
    }

    return NextResponse.json({ pools })
  } catch (error) {
    console.error('Failed to fetch IP pools:', error)
    return NextResponse.json({ error: 'Failed to fetch IP pools' }, { status: 500 })
  }
}

// POST - Create new IP pool
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, cidr, gateway, dnsServers, profileId, isEnabled } = body

    if (!name || !cidr) {
      return NextResponse.json({ error: 'Name and CIDR are required' }, { status: 400 })
    }

    // Validate CIDR format
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
    if (!cidrRegex.test(cidr)) {
      return NextResponse.json({ error: 'Invalid CIDR format' }, { status: 400 })
    }

    // Calculate total IPs from CIDR
    const prefix = parseInt(cidr.split('/')[1])
    const totalIps = Math.pow(2, 32 - prefix) - 2

    // Get existing pools
    const poolsSetting = await db.systemSetting.findUnique({
      where: { key: 'vpn_ip_pools' }
    })

    let pools = []
    if (poolsSetting?.value) {
      try {
        pools = JSON.parse(poolsSetting.value)
      } catch {
        pools = []
      }
    }

    // Create new pool
    const newPool = {
      id: `pool-${Date.now()}`,
      name,
      cidr,
      gateway: gateway || '',
      dnsServers: dnsServers || [],
      status: isEnabled ? 'ACTIVE' : 'DISABLED',
      usedIps: 0,
      totalIps,
      profileId: profileId || null,
      createdAt: new Date().toISOString(),
    }

    pools.push(newPool)

    // Save to database
    await db.systemSetting.upsert({
      where: { key: 'vpn_ip_pools' },
      create: { key: 'vpn_ip_pools', value: JSON.stringify(pools) },
      update: { value: JSON.stringify(pools) }
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'CREATE_IP_POOL',
        category: 'VPN_INTEGRATION',
        actorType: 'ADMIN',
        targetId: newPool.id,
        targetType: 'IpPool',
        details: JSON.stringify({ name, cidr, gateway }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ pool: newPool })
  } catch (error) {
    console.error('Failed to create IP pool:', error)
    return NextResponse.json({ error: 'Failed to create IP pool' }, { status: 500 })
  }
}

// PUT - Update an IP pool
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, cidr, gateway, dnsServers, profileId, isEnabled } = body

    if (!id) {
      return NextResponse.json({ error: 'Pool ID is required' }, { status: 400 })
    }

    // Get existing pools
    const poolsSetting = await db.systemSetting.findUnique({
      where: { key: 'vpn_ip_pools' }
    })

    let pools = []
    if (poolsSetting?.value) {
      try {
        pools = JSON.parse(poolsSetting.value)
      } catch {
        pools = []
      }
    }

    // Find the pool
    const poolIndex = pools.findIndex((p: any) => p.id === id)
    if (poolIndex === -1) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }

    // Validate CIDR if provided
    if (cidr) {
      const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
      if (!cidrRegex.test(cidr)) {
        return NextResponse.json({ error: 'Invalid CIDR format' }, { status: 400 })
      }
    }

    // Update pool
    const updatedPool = {
      ...pools[poolIndex],
      name: name || pools[poolIndex].name,
      cidr: cidr || pools[poolIndex].cidr,
      gateway: gateway !== undefined ? gateway : pools[poolIndex].gateway,
      dnsServers: dnsServers !== undefined ? dnsServers : pools[poolIndex].dnsServers,
      profileId: profileId !== undefined ? profileId : pools[poolIndex].profileId,
      status: isEnabled !== undefined ? (isEnabled ? 'ACTIVE' : 'DISABLED') : pools[poolIndex].status,
    }

    // Recalculate total IPs if CIDR changed
    if (cidr && cidr !== pools[poolIndex].cidr) {
      const prefix = parseInt(cidr.split('/')[1])
      updatedPool.totalIps = Math.pow(2, 32 - prefix) - 2
    }

    pools[poolIndex] = updatedPool

    // Save to database
    await db.systemSetting.upsert({
      where: { key: 'vpn_ip_pools' },
      create: { key: 'vpn_ip_pools', value: JSON.stringify(pools) },
      update: { value: JSON.stringify(pools) }
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'UPDATE_IP_POOL',
        category: 'VPN_INTEGRATION',
        actorType: 'ADMIN',
        targetId: id,
        targetType: 'IpPool',
        details: JSON.stringify({ name: updatedPool.name, cidr: updatedPool.cidr }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ pool: updatedPool })
  } catch (error) {
    console.error('Failed to update IP pool:', error)
    return NextResponse.json({ error: 'Failed to update IP pool' }, { status: 500 })
  }
}

// DELETE - Delete an IP pool
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Pool ID is required' }, { status: 400 })
    }

    // Get existing pools
    const poolsSetting = await db.systemSetting.findUnique({
      where: { key: 'vpn_ip_pools' }
    })

    let pools = []
    if (poolsSetting?.value) {
      try {
        pools = JSON.parse(poolsSetting.value)
      } catch {
        pools = []
      }
    }

    // Find and remove the pool
    const poolIndex = pools.findIndex((p: any) => p.id === id)
    if (poolIndex === -1) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }

    const deletedPool = pools.splice(poolIndex, 1)[0]

    // Save to database
    await db.systemSetting.upsert({
      where: { key: 'vpn_ip_pools' },
      create: { key: 'vpn_ip_pools', value: JSON.stringify(pools) },
      update: { value: JSON.stringify(pools) }
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'DELETE_IP_POOL',
        category: 'VPN_INTEGRATION',
        actorType: 'ADMIN',
        targetId: id,
        targetType: 'IpPool',
        details: JSON.stringify({ name: deletedPool.name, cidr: deletedPool.cidr }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete IP pool:', error)
    return NextResponse.json({ error: 'Failed to delete IP pool' }, { status: 500 })
  }
}
