import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const RENEWAL_SERVICE_URL = 'http://localhost:3032'

/**
 * Forward request to renewal service with port transform header
 */
async function forwardToRenewalService(
  path: string,
  method: string,
  body?: unknown
): Promise<Response> {
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Transform-Port': '3032',
      },
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(`${RENEWAL_SERVICE_URL}${path}`, options)
    const data = await response.json()

    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Renewal service error:', error)
    return NextResponse.json(
      { error: 'Renewal service unavailable', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 503 }
    )
  }
}

/**
 * GET /api/certificates/renewal
 * Get renewal status and expiring certificates
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  // If action=expiring, get expiring certificates from service
  if (action === 'expiring') {
    return forwardToRenewalService('/expiring', 'GET')
  }

  // If action=logs, get renewal logs
  if (action === 'logs') {
    return forwardToRenewalService('/logs', 'GET')
  }

  // Default: get full status from service
  try {
    const response = await fetch(`${RENEWAL_SERVICE_URL}/status`, {
      headers: { 'X-Transform-Port': '3032' },
    })

    if (!response.ok) {
      throw new Error('Renewal service not responding')
    }

    const status = await response.json()

    // Also get expiring certificates for the dashboard
    const expiringResponse = await fetch(`${RENEWAL_SERVICE_URL}/expiring`, {
      headers: { 'X-Transform-Port': '3032' },
    })
    const expiring = expiringResponse.ok ? await expiringResponse.json() : { clientCerts: [], serverCerts: [] }

    // Get PKI mode from database
    const pkiConfig = await db.pkiConfiguration.findFirst()
    const pkiMode = pkiConfig?.mode || 'MANAGED'

    // Get pending notifications for renewal approvals
    const pendingApprovals = await db.notification.count({
      where: {
        type: { in: ['cert-renewal-required', 'server-cert-renewal-required'] },
        isRead: false,
        isDismissed: false,
      },
    })

    return NextResponse.json({
      status: {
        ...status,
        pkiMode,
        pendingApprovals,
      },
      expiring,
    })
  } catch (error) {
    console.error('Get renewal status error:', error)

    // Return fallback data if service is not available
    return NextResponse.json({
      status: {
        isRunning: false,
        startTime: null,
        lastCheck: null,
        totalRenewals: 0,
        successfulRenewals: 0,
        failedRenewals: 0,
        pendingApprovals: 0,
        notificationsSent: 0,
        pkiMode: 'MANAGED',
        settings: {
          enabled: true,
          daysBeforeExpiry: 30,
          notifyDays: [60, 30, 14, 7],
          autoRenew: false,
        },
        serviceAvailable: false,
        error: error instanceof Error ? error.message : 'Service unavailable',
      },
      expiring: { clientCerts: [], serverCerts: [] },
    })
  }
}

/**
 * POST /api/certificates/renewal
 * Perform renewal actions
 * Body: { action: 'check' | 'renew' | 'start' | 'stop', certificateId?, type? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, certificateId, type } = body

    switch (action) {
      case 'check':
        // Run immediate check for expiring certs
        return forwardToRenewalService('/check', 'POST')

      case 'start':
        // Start the scheduler
        return forwardToRenewalService('/start', 'POST')

      case 'stop':
        // Stop the scheduler
        return forwardToRenewalService('/stop', 'POST')

      case 'renew':
        // Force renew specific certificate
        if (!certificateId) {
          return NextResponse.json(
            { error: 'Certificate ID required for renewal' },
            { status: 400 }
          )
        }

        // Log audit
        await db.auditLog.create({
          data: {
            action: 'FORCE_CERT_RENEWAL',
            category: 'CERTIFICATE_OPERATIONS',
            actorType: 'ADMIN',
            targetId: certificateId,
            targetType: type === 'server' ? 'ServerCertificate' : 'Certificate',
            details: JSON.stringify({ certificateId, type: type || 'client' }),
            status: 'SUCCESS',
          },
        })

        return forwardToRenewalService(`/renew/${certificateId}`, 'POST', { type: type || 'client' })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: check, renew, start, stop' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Renewal action error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/certificates/renewal
 * Update renewal configuration
 * Body: { enabled?, daysBeforeExpiry?, notifyDays?, autoRenew? }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { enabled, daysBeforeExpiry, notifyDays, autoRenew } = body

    // Validate input
    if (daysBeforeExpiry !== undefined && (daysBeforeExpiry < 1 || daysBeforeExpiry > 365)) {
      return NextResponse.json(
        { error: 'daysBeforeExpiry must be between 1 and 365' },
        { status: 400 }
      )
    }

    if (notifyDays !== undefined) {
      for (const day of notifyDays) {
        if (typeof day !== 'number' || day < 1 || day > 365) {
          return NextResponse.json(
            { error: 'notifyDays must be an array of numbers between 1 and 365' },
            { status: 400 }
          )
        }
      }
    }

    // Update in database directly
    const updates = []
    if (enabled !== undefined) {
      updates.push(
        db.systemSetting.upsert({
          where: { key: 'cert_renewal_enabled' },
          create: { key: 'cert_renewal_enabled', value: enabled.toString(), category: 'cert_renewal', description: 'Enable certificate auto-renewal' },
          update: { value: enabled.toString() },
        })
      )
    }

    if (daysBeforeExpiry !== undefined) {
      updates.push(
        db.systemSetting.upsert({
          where: { key: 'cert_renewal_days_before' },
          create: { key: 'cert_renewal_days_before', value: daysBeforeExpiry.toString(), category: 'cert_renewal', description: 'Days before expiry to trigger renewal' },
          update: { value: daysBeforeExpiry.toString() },
        })
      )
    }

    if (notifyDays !== undefined) {
      updates.push(
        db.systemSetting.upsert({
          where: { key: 'cert_renewal_notify_days' },
          create: { key: 'cert_renewal_notify_days', value: notifyDays.join(','), category: 'cert_renewal', description: 'Days before expiry to send notifications' },
          update: { value: notifyDays.join(',') },
        })
      )
    }

    if (autoRenew !== undefined) {
      updates.push(
        db.systemSetting.upsert({
          where: { key: 'cert_renewal_auto' },
          create: { key: 'cert_renewal_auto', value: autoRenew.toString(), category: 'cert_renewal', description: 'Enable automatic renewal without approval' },
          update: { value: autoRenew.toString() },
        })
      )
    }

    await Promise.all(updates)

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'UPDATE_RENEWAL_CONFIG',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        details: JSON.stringify({ enabled, daysBeforeExpiry, notifyDays, autoRenew }),
        status: 'SUCCESS',
      },
    })

    // Also update the renewal service
    const response = await fetch(`${RENEWAL_SERVICE_URL}/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Transform-Port': '3032',
      },
      body: JSON.stringify({ enabled, daysBeforeExpiry, notifyDays, autoRenew }),
    })

    const serviceResponse = response.ok ? await response.json() : null

    return NextResponse.json({
      success: true,
      settings: {
        enabled: enabled ?? (await db.systemSetting.findUnique({ where: { key: 'cert_renewal_enabled' } }))?.value === 'true',
        daysBeforeExpiry: daysBeforeExpiry ?? parseInt((await db.systemSetting.findUnique({ where: { key: 'cert_renewal_days_before' } }))?.value || '30', 10),
        notifyDays: notifyDays ?? ((await db.systemSetting.findUnique({ where: { key: 'cert_renewal_notify_days' } }))?.value || '60,30,14,7').split(',').map(Number),
        autoRenew: autoRenew ?? (await db.systemSetting.findUnique({ where: { key: 'cert_renewal_auto' } }))?.value === 'true',
      },
      serviceUpdated: serviceResponse?.success ?? false,
    })
  } catch (error) {
    console.error('Update renewal config error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
