/**
 * SIEM Export API
 * GET: Export SIEM logs in various formats (JSON, CSV, CEF, LEEF, SYSLOG)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { LogFormat } from '@prisma/client';

// GET - Export SIEM logs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'JSON').toUpperCase() as LogFormat;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const eventType = searchParams.get('eventType');
    const eventCategory = searchParams.get('eventCategory');
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '1000');
    const download = searchParams.get('download') === 'true';

    // Validate format
    const validFormats: LogFormat[] = ['JSON', 'CEF', 'LEEF', 'SYSLOG'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: `Invalid format. Must be one of: ${validFormats.join(', ')}` },
        { status: 400 }
      );
    }

    // Build where clause
    const where: Record<string, unknown> = {};

    if (startDate) {
      where.createdAt = { ...where.createdAt as object, gte: new Date(startDate) };
    }
    if (endDate) {
      where.createdAt = { ...where.createdAt as object, lte: new Date(endDate) };
    }
    if (eventType) {
      where.eventType = eventType;
    }
    if (eventCategory) {
      where.eventCategory = eventCategory;
    }
    if (severity) {
      where.severity = severity;
    }
    if (status) {
      where.sendStatus = status;
    }

    // Get events
    const events = await db.siemEventLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Get event types and categories for metadata
    const [eventTypes, eventCategories, severities] = await Promise.all([
      db.siemEventLog.groupBy({
        by: ['eventType'],
        _count: { id: true },
      }),
      db.siemEventLog.groupBy({
        by: ['eventCategory'],
        _count: { id: true },
      }),
      db.siemEventLog.groupBy({
        by: ['severity'],
        _count: { id: true },
      }),
    ]);

    const metadata = {
      exportedAt: new Date().toISOString(),
      totalEvents: events.length,
      filters: {
        startDate,
        endDate,
        eventType,
        eventCategory,
        severity,
        status,
      },
      eventTypes: eventTypes.map((e) => ({ type: e.eventType, count: e._count.id })),
      eventCategories: eventCategories.map((e) => ({ category: e.eventCategory, count: e._count.id })),
      severities: severities.map((e) => ({ severity: e.severity, count: e._count.id })),
    };

    // Format output based on requested format
    let output: string;
    let contentType: string;
    let filename: string;

    switch (format) {
      case 'CEF':
        output = formatToCEF(events);
        contentType = 'text/plain';
        filename = `siem-export-${Date.now()}.cef`;
        break;
      case 'LEEF':
        output = formatToLEEF(events);
        contentType = 'text/plain';
        filename = `siem-export-${Date.now()}.leef`;
        break;
      case 'SYSLOG':
        output = formatToSyslog(events);
        contentType = 'text/plain';
        filename = `siem-export-${Date.now()}.log`;
        break;
      case 'JSON':
      default:
        output = formatToJson(events, metadata);
        contentType = 'application/json';
        filename = `siem-export-${Date.now()}.json`;
    }

    // Log export to audit
    await db.auditLog.create({
      data: {
        action: 'EXPORT_SIEM_LOGS',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'SiemEventLog',
        details: JSON.stringify({
          format,
          totalEvents: events.length,
          filters: metadata.filters,
        }),
      },
    });

    if (download) {
      return new NextResponse(output, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': Buffer.byteLength(output).toString(),
        },
      });
    }

    return NextResponse.json({
      metadata,
      format,
      events: events.map((e) => ({
        ...e,
        eventData: e.eventData ? JSON.parse(e.eventData) : null,
      })),
      rawOutput: output.substring(0, 10000) + (output.length > 10000 ? '...(truncated)' : ''),
    });
  } catch (error) {
    console.error('Error exporting SIEM logs:', error);
    return NextResponse.json(
      { error: 'Failed to export SIEM logs' },
      { status: 500 }
    );
  }
}

// Format events to JSON
function formatToJson(
  events: Array<{
    id: string;
    eventType: string;
    eventCategory: string;
    severity: string;
    eventData: string;
    sendStatus: string;
    sentAt: Date | null;
    sendAttempts: number;
    errorMessage: string | null;
    createdAt: Date;
  }>,
  metadata: Record<string, unknown>
): string {
  const formattedEvents = events.map((event) => ({
    id: event.id,
    timestamp: event.createdAt.toISOString(),
    eventType: event.eventType,
    category: event.eventCategory,
    severity: event.severity,
    data: event.eventData ? JSON.parse(event.eventData) : null,
    status: {
      sendStatus: event.sendStatus,
      sentAt: event.sentAt?.toISOString() || null,
      attempts: event.sendAttempts,
      error: event.errorMessage,
    },
  }));

  return JSON.stringify({
    metadata,
    events: formattedEvents,
  }, null, 2);
}

// Format events to CEF (Common Event Format)
function formatToCEF(
  events: Array<{
    id: string;
    eventType: string;
    eventCategory: string;
    severity: string;
    eventData: string;
    createdAt: Date;
  }>
): string {
  const severityMap: Record<string, string> = {
    info: '2',
    low: '3',
    medium: '5',
    high: '7',
    critical: '9',
  };

  return events
    .map((event) => {
      const data = event.eventData ? JSON.parse(event.eventData) : {};
      const cefSeverity = severityMap[event.severity.toLowerCase()] || '5';

      const extension = Object.entries(data)
        .map(([key, value]) => {
          const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
          return `${key}=${strValue.replace(/[\r\n]/g, ' ')}`;
        })
        .join(' ');

      return `CEF:0|VPN PKI Platform|VPN Manager|1.0|${event.eventType}|${event.eventCategory}|${cefSeverity}|rt=${event.createdAt.toISOString()} ${extension}`;
    })
    .join('\n');
}

// Format events to LEEF (Log Event Extended Format)
function formatToLEEF(
  events: Array<{
    id: string;
    eventType: string;
    eventCategory: string;
    severity: string;
    eventData: string;
    createdAt: Date;
  }>
): string {
  return events
    .map((event) => {
      const data = event.eventData ? JSON.parse(event.eventData) : {};

      const extension = Object.entries(data)
        .map(([key, value]) => {
          const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
          return `\t${key}=${strValue.replace(/[\r\n\t]/g, ' ')}`;
        })
        .join('');

      return `LEEF:1.0|VPN PKI Platform|VPN Manager|1.0|${event.eventType}|devTime=${event.createdAt.toISOString()}${extension}\tsev=${event.severity}\tcat=${event.eventCategory}`;
    })
    .join('\n');
}

// Format events to Syslog format
function formatToSyslog(
  events: Array<{
    id: string;
    eventType: string;
    eventCategory: string;
    severity: string;
    eventData: string;
    createdAt: Date;
  }>
): string {
  const hostname = process.env.HOSTNAME || 'vpn-pki-manager';

  const severityToPriority: Record<string, number> = {
    info: 6,
    low: 6,
    medium: 4,
    high: 3,
    critical: 2,
  };

  return events
    .map((event) => {
      const data = event.eventData ? JSON.parse(event.eventData) : {};
      const syslogSeverity = severityToPriority[event.severity.toLowerCase()] || 6;
      const priority = (16 * 8) + syslogSeverity; // facility=16 (LOCAL0)

      const dataStr = Object.entries(data)
        .map(([key, value]) => {
          const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
          return `${key}="${strValue.replace(/"/g, '\\"')}"`;
        })
        .join(' ');

      const timestamp = event.createdAt.toISOString();
      return `<${priority}>${timestamp} ${hostname} VPN-PKI: [${event.eventType}] [${event.eventCategory}] [${event.severity}] ${dataStr}`;
    })
    .join('\n');
}
