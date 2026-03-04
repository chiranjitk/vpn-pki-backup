/**
 * Firewall Zones API
 * 
 * GET - Get all zones for a firewall
 * POST - Create a new zone
 * PUT - Update multiple zones
 * DELETE - Delete multiple zones
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { FirewallZoneType } from '@prisma/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Valid zone types
const VALID_ZONE_TYPES: FirewallZoneType[] = ['L3', 'L2', 'TAP', 'EXTERNAL', 'TUNNEL'];

// GET - Get all zones for a firewall
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const vpnOnly = searchParams.get('vpnOnly') === 'true';
    const enabled = searchParams.get('enabled');

    // Check if firewall exists
    const firewall = await db.firewallIntegration.findUnique({
      where: { id }
    });

    if (!firewall) {
      return NextResponse.json(
        { error: 'Firewall configuration not found' },
        { status: 404 }
      );
    }

    const where: Record<string, unknown> = { firewallId: id };

    if (vpnOnly) {
      where.isVpnZone = true;
    }

    if (enabled !== null) {
      where.isEnabled = enabled === 'true';
    }

    const zones = await db.firewallZone.findMany({
      where,
      orderBy: [{ isVpnZone: 'desc' }, { name: 'asc' }]
    });

    // Parse JSON fields for response
    const parsedZones = zones.map(zone => ({
      ...zone,
      interfaces: zone.interfaces ? JSON.parse(zone.interfaces) : [],
      subnets: zone.subnets ? JSON.parse(zone.subnets) : []
    }));

    return NextResponse.json({
      success: true,
      zones: parsedZones,
      total: zones.length
    });
  } catch (error) {
    console.error('Error fetching firewall zones:', error);
    return NextResponse.json(
      { error: 'Failed to fetch firewall zones' },
      { status: 500 }
    );
  }
}

// POST - Create a new zone
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      description,
      zoneType = 'L3',
      interfaces = [],
      subnets = [],
      isVpnZone = false,
      vpnSubnet,
      isEnabled = true
    } = body;

    // Check if firewall exists
    const firewall = await db.firewallIntegration.findUnique({
      where: { id }
    });

    if (!firewall) {
      return NextResponse.json(
        { error: 'Firewall configuration not found' },
        { status: 404 }
      );
    }

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Zone name is required' },
        { status: 400 }
      );
    }

    // Validate zone type
    if (!VALID_ZONE_TYPES.includes(zoneType)) {
      return NextResponse.json(
        { error: `Invalid zone type. Must be one of: ${VALID_ZONE_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Check for duplicate zone name within the firewall
    const existingZone = await db.firewallZone.findFirst({
      where: {
        firewallId: id,
        name
      }
    });

    if (existingZone) {
      return NextResponse.json(
        { error: 'A zone with this name already exists for this firewall' },
        { status: 400 }
      );
    }

    // Validate interfaces and subnets are arrays
    const interfacesArray = Array.isArray(interfaces) ? interfaces : [];
    const subnetsArray = Array.isArray(subnets) ? subnets : [];

    // Validate subnets format (CIDR notation)
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    for (const subnet of subnetsArray) {
      if (!cidrRegex.test(subnet)) {
        return NextResponse.json(
          { error: `Invalid subnet format: ${subnet}. Must be in CIDR notation (e.g., 10.0.0.0/24)` },
          { status: 400 }
        );
      }
    }

    // Create the zone
    const zone = await db.firewallZone.create({
      data: {
        firewallId: id,
        name,
        description: description || null,
        zoneType,
        interfaces: interfacesArray.length > 0 ? JSON.stringify(interfacesArray) : null,
        subnets: subnetsArray.length > 0 ? JSON.stringify(subnetsArray) : null,
        isVpnZone,
        vpnSubnet: vpnSubnet || null,
        isEnabled,
        syncStatus: 'PENDING'
      }
    });

    return NextResponse.json({
      success: true,
      zone: {
        ...zone,
        interfaces: interfacesArray,
        subnets: subnetsArray
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating firewall zone:', error);
    return NextResponse.json(
      { error: 'Failed to create firewall zone' },
      { status: 500 }
    );
  }
}

// PUT - Update multiple zones
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { zones } = body;

    if (!zones || !Array.isArray(zones) || zones.length === 0) {
      return NextResponse.json(
        { error: 'Array of zones to update is required' },
        { status: 400 }
      );
    }

    // Check if firewall exists
    const firewall = await db.firewallIntegration.findUnique({
      where: { id }
    });

    if (!firewall) {
      return NextResponse.json(
        { error: 'Firewall configuration not found' },
        { status: 404 }
      );
    }

    const results = [];

    for (const zoneUpdate of zones) {
      const { id: zoneId, ...updateData } = zoneUpdate;

      if (!zoneId) {
        results.push({
          success: false,
          error: 'Zone ID is required'
        });
        continue;
      }

      // Check if zone belongs to this firewall
      const existingZone = await db.firewallZone.findFirst({
        where: {
          id: zoneId,
          firewallId: id
        }
      });

      if (!existingZone) {
        results.push({
          success: false,
          zoneId,
          error: 'Zone not found or does not belong to this firewall'
        });
        continue;
      }

      // Build update data
      const data: Record<string, unknown> = {};

      if (updateData.name !== undefined) {
        // Check for duplicate name
        const duplicate = await db.firewallZone.findFirst({
          where: {
            firewallId: id,
            name: updateData.name,
            id: { not: zoneId }
          }
        });
        if (duplicate) {
          results.push({
            success: false,
            zoneId,
            error: 'A zone with this name already exists'
          });
          continue;
        }
        data.name = updateData.name;
      }

      if (updateData.description !== undefined) {
        data.description = updateData.description || null;
      }

      if (updateData.zoneType !== undefined) {
        if (!VALID_ZONE_TYPES.includes(updateData.zoneType)) {
          results.push({
            success: false,
            zoneId,
            error: 'Invalid zone type'
          });
          continue;
        }
        data.zoneType = updateData.zoneType;
      }

      if (updateData.interfaces !== undefined) {
        data.interfaces = Array.isArray(updateData.interfaces) && updateData.interfaces.length > 0
          ? JSON.stringify(updateData.interfaces)
          : null;
      }

      if (updateData.subnets !== undefined) {
        data.subnets = Array.isArray(updateData.subnets) && updateData.subnets.length > 0
          ? JSON.stringify(updateData.subnets)
          : null;
      }

      if (updateData.isVpnZone !== undefined) {
        data.isVpnZone = updateData.isVpnZone;
      }

      if (updateData.vpnSubnet !== undefined) {
        data.vpnSubnet = updateData.vpnSubnet || null;
      }

      if (updateData.isEnabled !== undefined) {
        data.isEnabled = updateData.isEnabled;
      }

      // Update the zone
      const updated = await db.firewallZone.update({
        where: { id: zoneId },
        data
      });

      results.push({
        success: true,
        zone: {
          ...updated,
          interfaces: updated.interfaces ? JSON.parse(updated.interfaces) : [],
          subnets: updated.subnets ? JSON.parse(updated.subnets) : []
        }
      });
    }

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      message: `Updated ${successCount} of ${zones.length} zones`,
      results
    });
  } catch (error) {
    console.error('Error updating firewall zones:', error);
    return NextResponse.json(
      { error: 'Failed to update firewall zones' },
      { status: 500 }
    );
  }
}

// DELETE - Delete multiple zones
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { zoneIds } = body;

    if (!zoneIds || !Array.isArray(zoneIds) || zoneIds.length === 0) {
      return NextResponse.json(
        { error: 'Array of zone IDs is required' },
        { status: 400 }
      );
    }

    // Check if firewall exists
    const firewall = await db.firewallIntegration.findUnique({
      where: { id }
    });

    if (!firewall) {
      return NextResponse.json(
        { error: 'Firewall configuration not found' },
        { status: 404 }
      );
    }

    // Delete zones that belong to this firewall
    const result = await db.firewallZone.deleteMany({
      where: {
        id: { in: zoneIds },
        firewallId: id
      }
    });

    return NextResponse.json({
      success: true,
      deleted: result.count
    });
  } catch (error) {
    console.error('Error deleting firewall zones:', error);
    return NextResponse.json(
      { error: 'Failed to delete firewall zones' },
      { status: 500 }
    );
  }
}
