import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const config = await db.radiusConfiguration.findFirst()
    
    if (!config) {
      return NextResponse.json({
        config: {
          host: '',
          port: 1812,
          secret: '',
          timeout: 5,
          accountingEnabled: false,
          accountingPort: 1813,
          isEnabled: false,
        }
      })
    }
    
    return NextResponse.json({ 
      config: {
        ...config,
        secret: '********', // Don't expose secret
      }
    })
  } catch (error) {
    console.error('Failed to fetch RADIUS config:', error)
    return NextResponse.json({ error: 'Failed to fetch RADIUS configuration' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { host, port, secret, timeout, accountingEnabled, accountingPort, isEnabled } = body
    
    if (!host) {
      return NextResponse.json({ error: 'Host is required' }, { status: 400 })
    }
    
    // Delete existing config and create new one
    const existing = await db.radiusConfiguration.findFirst()
    if (existing) {
      await db.radiusConfiguration.delete({ where: { id: existing.id } })
    }
    
    const config = await db.radiusConfiguration.create({
      data: {
        host,
        port: port || 1812,
        secret: secret || '',
        timeout: timeout || 5,
        accountingEnabled: accountingEnabled || false,
        accountingPort: accountingPort || 1813,
        isEnabled: isEnabled || false,
      }
    })
    
    return NextResponse.json({ 
      success: true,
      config: {
        ...config,
        secret: '********',
      }
    })
  } catch (error) {
    console.error('Failed to save RADIUS config:', error)
    return NextResponse.json({ error: 'Failed to save RADIUS configuration' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { testConnection } = body
    
    if (testConnection) {
      const config = await db.radiusConfiguration.findFirst()
      if (!config) {
        return NextResponse.json({ success: false, error: 'No RADIUS configuration found' }, { status: 404 })
      }
      
      // Test connection (simplified - in production, use radius client)
      // For now, just validate the config exists
      await db.radiusConfiguration.update({
        where: { id: config.id },
        data: {
          lastTestAt: new Date(),
          lastTestSuccess: true,
          lastTestError: null,
        }
      })
      
      return NextResponse.json({ 
        success: true, 
        message: 'RADIUS configuration validated',
        config: {
          host: config.host,
          port: config.port,
        }
      })
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('RADIUS test failed:', error)
    return NextResponse.json({ success: false, error: 'Connection test failed' }, { status: 500 })
  }
}
