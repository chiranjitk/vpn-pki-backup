/**
 * Firewall Configuration API (by ID)
 * 
 * GET - Retrieve a specific firewall configuration
 * PUT - Update a firewall configuration
 * DELETE - Delete a firewall configuration
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

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Retrieve a specific firewall configuration
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    const firewall = await db.firewallIntegration.findUnique({
      where: { id },
      include: {
        zones: {
          orderBy: { name: 'asc' }
        },
        syncLogs: {
          take: 10,
          orderBy: { startedAt: 'desc' }
        }
      }
    });

    if (!firewall) {
      return NextResponse.json(
        { error: 'Firewall configuration not found' },
        { status: 404 }
      );
    }

    // Sanitize sensitive fields
    const { apiKey, apiPassword, ...safeFirewall } = firewall;

    return NextResponse.json({
      success: true,
      firewall: {
        ...safeFirewall,
        apiKey: apiKey ? '••••••••' : null,
        apiPassword: apiPassword ? '••••••••' : null,
      }
    });
  } catch (error) {
    console.error('Error fetching firewall configuration:', error);
    return NextResponse.json(
      { error: 'Failed to fetch firewall configuration' },
      { status: 500 }
    );
  }
}

// PUT - Update a firewall configuration
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if firewall exists
    const existing = await db.firewallIntegration.findUnique({
      where: { id }
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Firewall configuration not found' },
        { status: 404 }
      );
    }

    const {
      firewallType,
      apiUrl,
      apiKey,
      apiUsername,
      apiPassword,
      panDeviceGroup,
      panVsys,
      autoCreateZone,
      autoCreatePolicy,
      syncVpnSubnets,
      syncUserGroups,
      vpnZoneName,
      vpnInterface,
      vpnSubnet,
      isEnabled,
    } = body;

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (firewallType !== undefined) {
      if (!VALID_FIREWALL_TYPES.includes(firewallType)) {
        return NextResponse.json(
          { error: `Invalid firewall type. Must be one of: ${VALID_FIREWALL_TYPES.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.firewallType = firewallType;
    }

    if (apiUrl !== undefined) {
      if (!apiUrl) {
        return NextResponse.json(
          { error: 'API URL cannot be empty' },
          { status: 400 }
        );
      }
      try {
        new URL(apiUrl);
      } catch {
        return NextResponse.json(
          { error: 'Invalid API URL format' },
          { status: 400 }
        );
      }
      updateData.apiUrl = apiUrl;
    }

    // Only update sensitive fields if they're not placeholders
    if (apiKey !== undefined && apiKey !== '••••••••') {
      updateData.apiKey = apiKey || null;
    }

    if (apiUsername !== undefined) {
      updateData.apiUsername = apiUsername || null;
    }

    if (apiPassword !== undefined && apiPassword !== '••••••••') {
      updateData.apiPassword = apiPassword || null;
    }

    if (panDeviceGroup !== undefined) {
      updateData.panDeviceGroup = panDeviceGroup || null;
    }

    if (panVsys !== undefined) {
      updateData.panVsys = panVsys;
    }

    if (autoCreateZone !== undefined) {
      updateData.autoCreateZone = autoCreateZone;
    }

    if (autoCreatePolicy !== undefined) {
      updateData.autoCreatePolicy = autoCreatePolicy;
    }

    if (syncVpnSubnets !== undefined) {
      updateData.syncVpnSubnets = syncVpnSubnets;
    }

    if (syncUserGroups !== undefined) {
      updateData.syncUserGroups = syncUserGroups;
    }

    if (vpnZoneName !== undefined) {
      updateData.vpnZoneName = vpnZoneName;
    }

    if (vpnInterface !== undefined) {
      updateData.vpnInterface = vpnInterface;
    }

    if (vpnSubnet !== undefined) {
      updateData.vpnSubnet = vpnSubnet || null;
    }

    if (isEnabled !== undefined) {
      updateData.isEnabled = isEnabled;
    }

    // Update the firewall configuration
    const firewall = await db.firewallIntegration.update({
      where: { id },
      data: updateData
    });

    // Sanitize sensitive fields in response
    const { apiKey: _, apiPassword: __, ...safeFirewall } = firewall;

    return NextResponse.json({
      success: true,
      firewall: {
        ...safeFirewall,
        apiKey: firewall.apiKey ? '••••••••' : null,
        apiPassword: firewall.apiPassword ? '••••••••' : null,
      }
    });
  } catch (error) {
    console.error('Error updating firewall configuration:', error);
    return NextResponse.json(
      { error: 'Failed to update firewall configuration' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a firewall configuration
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    // Check if firewall exists
    const existing = await db.firewallIntegration.findUnique({
      where: { id },
      include: {
        _count: {
          select: { zones: true, syncLogs: true }
        }
      }
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Firewall configuration not found' },
        { status: 404 }
      );
    }

    // Delete the firewall (cascades to zones and sync logs)
    await db.firewallIntegration.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: 'Firewall configuration deleted successfully',
      deletedZones: existing._count.zones,
      deletedSyncLogs: existing._count.syncLogs
    });
  } catch (error) {
    console.error('Error deleting firewall configuration:', error);
    return NextResponse.json(
      { error: 'Failed to delete firewall configuration' },
      { status: 500 }
    );
  }
}
