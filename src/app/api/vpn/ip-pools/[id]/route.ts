import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Get single IP pool
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const poolsSetting = await db.systemSetting.findUnique({
      where: { key: 'vpn_ip_pools' }
    })

    if (!poolsSetting?.value) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }

    const pools = JSON.parse(poolsSetting.value)
    const pool = pools.find((p: { id: string }) => p.id === id)

    if (!pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }

    return NextResponse.json({ pool })
  } catch (error) {
    console.error('Failed to fetch IP pool:', error)
    return NextResponse.json({ error: 'Failed to fetch IP pool' }, { status: 500 })
  }
}

// PUT - Update IP pool
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const poolsSetting = await db.systemSetting.findUnique({
      where: { key: 'vpn_ip_pools' }
    })

    if (!poolsSetting?.value) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }

    let pools = JSON.parse(poolsSetting.value)
    const index = pools.findIndex((p: { id: string }) => p.id === id)

    if (index === -1) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }

    // Update pool
    pools[index] = {
      ...pools[index],
      name: body.name || pools[index].name,
      cidr: body.cidr || pools[index].cidr,
      gateway: body.gateway !== undefined ? body.gateway : pools[index].gateway,
      dnsServers: body.dnsServers || pools[index].dnsServers,
      profileId: body.profileId !== undefined ? body.profileId : pools[index].profileId,
      status: body.status || pools[index].status,
      updatedAt: new Date().toISOString(),
    }

    // Calculate total IPs if CIDR changed
    if (body.cidr) {
      const prefix = parseInt(body.cidr.split('/')[1])
      pools[index].totalIps = Math.pow(2, 32 - prefix) - 2
    }

    await db.systemSetting.upsert({
      where: { key: 'vpn_ip_pools' },
      create: { key: 'vpn_ip_pools', value: JSON.stringify(pools) },
      update: { value: JSON.stringify(pools) }
    })

    return NextResponse.json({ pool: pools[index] })
  } catch (error) {
    console.error('Failed to update IP pool:', error)
    return NextResponse.json({ error: 'Failed to update IP pool' }, { status: 500 })
  }
}

// PATCH - Toggle IP pool status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const poolsSetting = await db.systemSetting.findUnique({
      where: { key: 'vpn_ip_pools' }
    })

    if (!poolsSetting?.value) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }

    let pools = JSON.parse(poolsSetting.value)
    const index = pools.findIndex((p: { id: string }) => p.id === id)

    if (index === -1) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }

    pools[index].status = body.status || (pools[index].status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE')

    await db.systemSetting.upsert({
      where: { key: 'vpn_ip_pools' },
      create: { key: 'vpn_ip_pools', value: JSON.stringify(pools) },
      update: { value: JSON.stringify(pools) }
    })

    return NextResponse.json({ pool: pools[index] })
  } catch (error) {
    console.error('Failed to toggle IP pool:', error)
    return NextResponse.json({ error: 'Failed to toggle IP pool' }, { status: 500 })
  }
}

// DELETE - Delete IP pool
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const poolsSetting = await db.systemSetting.findUnique({
      where: { key: 'vpn_ip_pools' }
    })

    if (!poolsSetting?.value) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }

    let pools = JSON.parse(poolsSetting.value)
    const index = pools.findIndex((p: { id: string }) => p.id === id)

    if (index === -1) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }

    pools.splice(index, 1)

    await db.systemSetting.upsert({
      where: { key: 'vpn_ip_pools' },
      create: { key: 'vpn_ip_pools', value: JSON.stringify(pools) },
      update: { value: JSON.stringify(pools) }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete IP pool:', error)
    return NextResponse.json({ error: 'Failed to delete IP pool' }, { status: 500 })
  }
}
