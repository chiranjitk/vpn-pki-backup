/**
 * SIEM Configuration by ID API
 * GET: Retrieve a specific SIEM configuration
 * PUT: Update a SIEM configuration
 * DELETE: Delete a SIEM configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SiemType, SyslogProtocol, LogFormat } from '@prisma/client';

// Valid values
const VALID_SIEM_TYPES: SiemType[] = [
  'SPLUNK',
  'ELK_STACK',
  'QRADAR',
  'ARCSIGHT',
  'SENTINEL_ONE',
  'MICROSOFT_SENTINEL',
  'CUSTOM_API',
  'SYSLOG',
];
const VALID_LOG_FORMATS: LogFormat[] = ['JSON', 'CEF', 'LEEF', 'SYSLOG'];
const VALID_SYSLOG_PROTOCOLS: SyslogProtocol[] = ['UDP', 'TCP', 'TLS'];

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Retrieve a specific SIEM configuration
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const config = await db.siemConfiguration.findUnique({
      where: { id },
    });

    if (!config) {
      return NextResponse.json(
        { error: 'SIEM configuration not found' },
        { status: 404 }
      );
    }

    // Remove sensitive data
    const { apiToken, apiKey, ...safeConfig } = config;

    return NextResponse.json({
      configuration: {
        ...safeConfig,
        apiToken: apiToken ? '••••••••' : null,
        apiKey: apiKey ? '••••••••' : null,
      },
      statistics: {
        eventsSent: config.eventsSent,
        lastSyncAt: config.lastSyncAt,
        lastSyncSuccess: config.lastSyncSuccess,
      },
    });
  } catch (error) {
    console.error('Error fetching SIEM configuration:', error);
    return NextResponse.json(
      { error: 'Failed to fetch SIEM configuration' },
      { status: 500 }
    );
  }
}

// PUT - Update a SIEM configuration
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if configuration exists
    const existing = await db.siemConfiguration.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'SIEM configuration not found' },
        { status: 404 }
      );
    }

    const {
      siemType,
      endpointUrl,
      apiToken,
      apiKey,
      syslogHost,
      syslogPort,
      syslogProtocol,
      syslogFacility,
      logAuthentication,
      logCertificates,
      logVpnSessions,
      logAdminActions,
      logSecurityEvents,
      logFormat,
      includeRawData,
      isEnabled,
    } = body;

    // Build update data
    const updateData: Record<string, unknown> = {};

    // Only update fields that are provided
    if (siemType !== undefined) {
      if (!VALID_SIEM_TYPES.includes(siemType)) {
        return NextResponse.json(
          { error: `Invalid SIEM type. Must be one of: ${VALID_SIEM_TYPES.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.siemType = siemType;
    }

    if (endpointUrl !== undefined) {
      updateData.endpointUrl = endpointUrl || null;
    }

    if (apiToken !== undefined && apiToken !== '••••••••') {
      updateData.apiToken = apiToken || null;
    }

    if (apiKey !== undefined && apiKey !== '••••••••') {
      updateData.apiKey = apiKey || null;
    }

    if (syslogHost !== undefined) {
      updateData.syslogHost = syslogHost || null;
    }

    if (syslogPort !== undefined) {
      updateData.syslogPort = syslogPort;
    }

    if (syslogProtocol !== undefined) {
      if (!VALID_SYSLOG_PROTOCOLS.includes(syslogProtocol)) {
        return NextResponse.json(
          { error: `Invalid syslog protocol. Must be one of: ${VALID_SYSLOG_PROTOCOLS.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.syslogProtocol = syslogProtocol;
    }

    if (syslogFacility !== undefined) {
      updateData.syslogFacility = syslogFacility;
    }

    if (logAuthentication !== undefined) {
      updateData.logAuthentication = logAuthentication;
    }

    if (logCertificates !== undefined) {
      updateData.logCertificates = logCertificates;
    }

    if (logVpnSessions !== undefined) {
      updateData.logVpnSessions = logVpnSessions;
    }

    if (logAdminActions !== undefined) {
      updateData.logAdminActions = logAdminActions;
    }

    if (logSecurityEvents !== undefined) {
      updateData.logSecurityEvents = logSecurityEvents;
    }

    if (logFormat !== undefined) {
      if (!VALID_LOG_FORMATS.includes(logFormat)) {
        return NextResponse.json(
          { error: `Invalid log format. Must be one of: ${VALID_LOG_FORMATS.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.logFormat = logFormat;
    }

    if (includeRawData !== undefined) {
      updateData.includeRawData = includeRawData;
    }

    if (isEnabled !== undefined) {
      updateData.isEnabled = isEnabled;
    }

    // Update the configuration
    const updated = await db.siemConfiguration.update({
      where: { id },
      data: updateData,
    });

    // Log to audit
    await db.auditLog.create({
      data: {
        action: 'UPDATE_SIEM_CONFIG',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'SiemConfiguration',
        targetId: id,
        details: JSON.stringify({
          updatedFields: Object.keys(updateData),
        }),
      },
    });

    // Remove sensitive data
    const { apiToken: _, apiKey: __, ...safeConfig } = updated;

    return NextResponse.json({
      success: true,
      configuration: {
        ...safeConfig,
        apiToken: updated.apiToken ? '••••••••' : null,
        apiKey: updated.apiKey ? '••••••••' : null,
      },
    });
  } catch (error) {
    console.error('Error updating SIEM configuration:', error);
    return NextResponse.json(
      { error: 'Failed to update SIEM configuration' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a SIEM configuration
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check if configuration exists
    const existing = await db.siemConfiguration.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'SIEM configuration not found' },
        { status: 404 }
      );
    }

    // Delete the configuration
    await db.siemConfiguration.delete({
      where: { id },
    });

    // Log to audit
    await db.auditLog.create({
      data: {
        action: 'DELETE_SIEM_CONFIG',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'SiemConfiguration',
        targetId: id,
        details: JSON.stringify({
          siemType: existing.siemType,
          endpointUrl: existing.endpointUrl || existing.syslogHost,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'SIEM configuration deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting SIEM configuration:', error);
    return NextResponse.json(
      { error: 'Failed to delete SIEM configuration' },
      { status: 500 }
    );
  }
}
