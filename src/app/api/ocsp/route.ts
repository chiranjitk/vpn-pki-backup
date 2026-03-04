import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Return OCSP configuration from system settings
    const settings = await db.systemSetting.findMany({
      where: { category: 'ocsp' }
    })
    
    const config = {
      isEnabled: true,
      responderUrl: 'http://localhost:3033',
      port: 3033,
      responseValiditySeconds: 3600,
      ocspCertPath: '/etc/swanctl/ocsp.crt',
      ocspKeyPath: '/etc/swanctl/ocsp.key',
      caCertPath: '/etc/swanctl/x509ca/intermediate.crt',
    }
    
    for (const setting of settings) {
      if (setting.key in config) {
        (config as Record<string, unknown>)[setting.key] = setting.value
      }
    }
    
    return NextResponse.json({ config })
  } catch (error) {
    console.error('Failed to get OCSP config:', error)
    return NextResponse.json({ error: 'Failed to get OCSP configuration' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Save OCSP configuration
    for (const [key, value] of Object.entries(body)) {
      await db.systemSetting.upsert({
        where: { key: `ocsp_${key}` },
        create: {
          key: `ocsp_${key}`,
          value: String(value),
          category: 'ocsp',
        },
        update: {
          value: String(value),
        }
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save OCSP config:', error)
    return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
  }
}
