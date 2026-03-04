/**
 * Firewall Integration API
 * 
 * GET - Retrieve all firewall configurations
 * POST - Create a new firewall configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { FirewallType } from '@prisma/client';

// Valid firewall types
const VALID_FIREWALL_TYPES: FirewallType[] = [
  'PALO_ALTO',
  'FORTINET',
  'CISCO_ASA',
  'CHECKPOINT',
  'JUNIPER',
  'SONICWALL',
  'CUSTOM'
];

// GET - Retrieve all firewall configurations
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const enabled = searchParams.get('enabled');
    const type = searchParams.get('type');

    const where: Record<string, unknown> = {};
    
    if (enabled !== null) {
      where.isEnabled = enabled === 'true';
    }
    
    if (type && VALID_FIREWALL_TYPES.includes(type as FirewallType)) {
      where.firewallType = type;
    }

    const firewalls = await db.firewallIntegration.findMany({
      where,
      include: {
        zones: {
          where: { isEnabled: true },
          select: {
            id: true,
            name: true,
            zoneType: true,
            isVpnZone: true,
            syncStatus: true,
          }
        },
        _count: {
          select: { zones: true, syncLogs: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Sanitize sensitive fields
    const sanitizedFirewalls = firewalls.map(fw => ({
      ...fw,
      apiKey: fw.apiKey ? '••••••••' : null,
      apiPassword: fw.apiPassword ? '••••••••' : null,
    }));

    return NextResponse.json({
      success: true,
      firewalls: sanitizedFirewalls,
      total: firewalls.length
    });
  } catch (error) {
    console.error('Error fetching firewall configurations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch firewall configurations' },
      { status: 500 }
    );
  }
}

// POST - Create a new firewall configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      firewallType,
      apiUrl,
      apiKey,
      apiUsername,
      apiPassword,
      panDeviceGroup,
      panVsys = 'vsys1',
      autoCreateZone = false,
      autoCreatePolicy = false,
      syncVpnSubnets = true,
      syncUserGroups = false,
      vpnZoneName = 'vpn-zone',
      vpnInterface = 'tunnel.1',
      vpnSubnet,
      isEnabled = false,
    } = body;

    // Validate required fields
    if (!firewallType || !VALID_FIREWALL_TYPES.includes(firewallType)) {
      return NextResponse.json(
        { error: `Invalid firewall type. Must be one of: ${VALID_FIREWALL_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!apiUrl) {
      return NextResponse.json(
        { error: 'API URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(apiUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid API URL format' },
        { status: 400 }
      );
    }

    // Palo Alto specific validation
    if (firewallType === 'PALO_ALTO') {
      if (!apiUsername || !apiPassword) {
        return NextResponse.json(
          { error: 'API username and password are required for Palo Alto firewalls' },
          { status: 400 }
        );
      }
    }

    // Check for duplicate configuration (same API URL and type)
    const existing = await db.firewallIntegration.findFirst({
      where: {
        apiUrl,
        firewallType
      }
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A firewall configuration with this API URL and type already exists' },
        { status: 400 }
      );
    }

    // Create the firewall configuration
    const firewall = await db.firewallIntegration.create({
      data: {
        firewallType,
        apiUrl,
        apiKey: apiKey || null,
        apiUsername: apiUsername || null,
        apiPassword: apiPassword || null,
        panDeviceGroup: panDeviceGroup || null,
        panVsys,
        autoCreateZone,
        autoCreatePolicy,
        syncVpnSubnets,
        syncUserGroups,
        vpnZoneName,
        vpnInterface,
        vpnSubnet: vpnSubnet || null,
        isEnabled,
      }
    });

    // Create default VPN zone if autoCreateZone is enabled
    if (autoCreateZone) {
      await db.firewallZone.create({
        data: {
          firewallId: firewall.id,
          name: vpnZoneName,
          description: 'Auto-created VPN zone',
          zoneType: 'TUNNEL',
          interfaces: JSON.stringify([vpnInterface]),
          subnets: vpnSubnet ? JSON.stringify([vpnSubnet]) : null,
          isVpnZone: true,
          vpnSubnet: vpnSubnet || null,
          syncStatus: 'PENDING',
        }
      });
    }

    // Sanitize sensitive fields in response
    const { apiKey: _, apiPassword: __, ...safeFirewall } = firewall;

    return NextResponse.json({
      success: true,
      firewall: {
        ...safeFirewall,
        apiKey: firewall.apiKey ? '••••••••' : null,
        apiPassword: firewall.apiPassword ? '••••••••' : null,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating firewall configuration:', error);
    return NextResponse.json(
      { error: 'Failed to create firewall configuration' },
      { status: 500 }
    );
  }
}

// DELETE - Delete multiple firewall configurations
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Array of firewall IDs is required' },
        { status: 400 }
      );
    }

    // Delete firewall configurations (cascades to zones and sync logs)
    const result = await db.firewallIntegration.deleteMany({
      where: {
        id: { in: ids }
      }
    });

    return NextResponse.json({
      success: true,
      deleted: result.count
    });
  } catch (error) {
    console.error('Error deleting firewall configurations:', error);
    return NextResponse.json(
      { error: 'Failed to delete firewall configurations' },
      { status: 500 }
    );
  }
}
