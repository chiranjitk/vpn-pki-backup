<<<<<<< HEAD
/**
 * SIEM Configuration API
 * GET: List all SIEM configurations
 * POST: Create a new SIEM configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SiemType, SyslogProtocol, LogFormat } from '@prisma/client';

// Valid SIEM types
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

// Valid log formats
const VALID_LOG_FORMATS: LogFormat[] = ['JSON', 'CEF', 'LEEF', 'SYSLOG'];

// Valid syslog protocols
const VALID_SYSLOG_PROTOCOLS: SyslogProtocol[] = ['UDP', 'TCP', 'TLS'];

// GET - Retrieve all SIEM configurations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const enabledOnly = searchParams.get('enabledOnly') === 'true';
    const includeStats = searchParams.get('includeStats') === 'true';

    const where = enabledOnly ? { isEnabled: true } : {};

    const configs = await db.siemConfiguration.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Remove sensitive data from response
    const safeConfigs = configs.map((config) => {
      const { apiToken, apiKey, ...safeConfig } = config;
      return {
        ...safeConfig,
        apiToken: apiToken ? '••••••••' : null,
        apiKey: apiKey ? '••••••••' : null,
      };
    });

    // Include stats if requested
    let stats = null;
    if (includeStats) {
      const [totalEvents, pendingEvents, failedEvents] = await Promise.all([
        db.siemEventLog.count(),
        db.siemEventLog.count({ where: { sendStatus: 'PENDING' } }),
        db.siemEventLog.count({ where: { sendStatus: 'FAILED' } }),
      ]);

      stats = {
        totalConfigurations: configs.length,
        enabledConfigurations: configs.filter((c) => c.isEnabled).length,
        totalEventsSent: configs.reduce((sum, c) => sum + c.eventsSent, 0),
        eventQueue: {
          total: totalEvents,
          pending: pendingEvents,
          failed: failedEvents,
        },
      };
    }

    return NextResponse.json({
      configurations: safeConfigs,
      stats,
      supportedTypes: VALID_SIEM_TYPES,
      supportedFormats: VALID_LOG_FORMATS,
    });
  } catch (error) {
    console.error('Error fetching SIEM configurations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch SIEM configurations' },
      { status: 500 }
    );
  }
}

// POST - Create a new SIEM configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      siemType,
      name,
      endpointUrl,
      apiToken,
      apiKey,
      // Syslog settings
      syslogHost,
      syslogPort = 514,
      syslogProtocol = 'UDP',
      syslogFacility = 16,
      // What to log
      logAuthentication = true,
      logCertificates = true,
      logVpnSessions = true,
      logAdminActions = true,
      logSecurityEvents = true,
      // Log format
      logFormat = 'JSON',
      includeRawData = false,
      // Status
      isEnabled = false,
    } = body;

    // Validate SIEM type
    if (!siemType || !VALID_SIEM_TYPES.includes(siemType)) {
      return NextResponse.json(
        { error: `Invalid SIEM type. Must be one of: ${VALID_SIEM_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate log format
    if (!VALID_LOG_FORMATS.includes(logFormat)) {
      return NextResponse.json(
        { error: `Invalid log format. Must be one of: ${VALID_LOG_FORMATS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate syslog protocol if provided
    if (syslogProtocol && !VALID_SYSLOG_PROTOCOLS.includes(syslogProtocol)) {
      return NextResponse.json(
        { error: `Invalid syslog protocol. Must be one of: ${VALID_SYSLOG_PROTOCOLS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate required fields based on SIEM type
    const isSyslogBased = siemType === 'SYSLOG';
    const isApiBased = !isSyslogBased;

    if (isApiBased && !endpointUrl) {
      return NextResponse.json(
        { error: 'Endpoint URL is required for API-based SIEM integrations' },
        { status: 400 }
      );
    }

    if (isSyslogBased && !syslogHost) {
      return NextResponse.json(
        { error: 'Syslog host is required for syslog-based SIEM integrations' },
        { status: 400 }
      );
    }

    // Validate authentication for certain SIEM types
    if (siemType === 'SPLUNK' && !apiToken) {
      return NextResponse.json(
        { error: 'API token is required for Splunk integration' },
        { status: 400 }
      );
    }

    // Create the configuration
    const config = await db.siemConfiguration.create({
      data: {
        siemType,
        endpointUrl: endpointUrl || null,
        apiToken: apiToken || null,
        apiKey: apiKey || null,
        syslogHost: syslogHost || null,
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
      },
    });

    // Log to audit
    await db.auditLog.create({
      data: {
        action: 'CREATE_SIEM_CONFIG',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'SiemConfiguration',
        targetId: config.id,
        details: JSON.stringify({
          siemType,
          endpointUrl: endpointUrl || syslogHost,
          logFormat,
          isEnabled,
        }),
      },
    });

    // Remove sensitive data from response
    const { apiToken: _, apiKey: __, ...safeConfig } = config;

    return NextResponse.json({
      success: true,
      configuration: {
        ...safeConfig,
        apiToken: apiToken ? '••••••••' : null,
        apiKey: apiKey ? '••••••••' : null,
      },
    });
  } catch (error) {
    console.error('Error creating SIEM configuration:', error);
    return NextResponse.json(
      { error: 'Failed to create SIEM configuration' },
      { status: 500 }
    );
=======
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const configs = await db.siemConfiguration.findMany({
      orderBy: { createdAt: 'desc' }
    })
    
    return NextResponse.json({ 
      configs: configs.map(c => ({
        ...c,
        apiToken: c.apiToken ? '********' : null,
        apiKey: c.apiKey ? '********' : null,
      }))
    })
  } catch (error) {
    console.error('Failed to fetch SIEM configs:', error)
    return NextResponse.json({ error: 'Failed to fetch SIEM configurations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const config = await db.siemConfiguration.create({
      data: {
        siemType: body.siemType,
        endpointUrl: body.endpointUrl || null,
        apiToken: body.apiToken || null,
        syslogHost: body.syslogHost || null,
        syslogPort: body.syslogPort || 514,
        syslogProtocol: body.syslogProtocol || 'UDP',
        logAuthentication: body.logAuthentication ?? true,
        logCertificates: body.logCertificates ?? true,
        logVpnSessions: body.logVpnSessions ?? true,
        logAdminActions: body.logAdminActions ?? true,
        logSecurityEvents: body.logSecurityEvents ?? true,
        logFormat: body.logFormat || 'JSON',
        isEnabled: body.isEnabled ?? false,
      }
    })
    
    return NextResponse.json({ success: true, config })
  } catch (error) {
    console.error('Failed to create SIEM config:', error)
    return NextResponse.json({ error: 'Failed to create SIEM configuration' }, { status: 500 })
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  }
}
