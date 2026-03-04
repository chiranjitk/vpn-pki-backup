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
  }
}
