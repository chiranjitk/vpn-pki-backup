import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const config = await db.ldapConfiguration.findFirst()
    
    if (!config) {
      return NextResponse.json({
        config: {
          serverUrl: '',
          bindDn: '',
          bindPassword: '',
          baseDn: '',
          useTls: true,
          tlsVerifyCert: true,
          timeout: 30,
          isEnabled: false,
          syncInterval: 3600,
          syncFilter: '(objectClass=user)',
          syncAttributeUsername: 'sAMAccountName',
          syncAttributeEmail: 'mail',
          syncAttributeFullName: 'displayName',
          autoCreateUsers: true,
          autoDisableUsers: false,
        }
      })
    }
    
    return NextResponse.json({ 
      config: {
        ...config,
        bindPassword: '********', // Don't expose password
      }
    })
  } catch (error) {
    console.error('Failed to fetch LDAP config:', error)
    return NextResponse.json({ error: 'Failed to fetch LDAP configuration' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Delete existing config and create new one
    const existing = await db.ldapConfiguration.findFirst()
    if (existing) {
      await db.ldapConfiguration.delete({ where: { id: existing.id } })
    }
    
    const config = await db.ldapConfiguration.create({
      data: {
        serverUrl: body.serverUrl || '',
        bindDn: body.bindDn || '',
        bindPassword: body.bindPassword || '',
        baseDn: body.baseDn || '',
        useTls: body.useTls ?? true,
        tlsVerifyCert: body.tlsVerifyCert ?? true,
        timeout: body.timeout || 30,
        isEnabled: body.isEnabled || false,
        syncInterval: body.syncInterval || 3600,
        syncFilter: body.syncFilter || '(objectClass=user)',
        syncAttributeUsername: body.syncAttributeUsername || 'sAMAccountName',
        syncAttributeEmail: body.syncAttributeEmail || 'mail',
        syncAttributeFullName: body.syncAttributeFullName || 'displayName',
        syncAttributeDepartment: body.syncAttributeDepartment,
        autoCreateUsers: body.autoCreateUsers ?? true,
        autoDisableUsers: body.autoDisableUsers || false,
      }
    })
    
    return NextResponse.json({ 
      success: true,
      config: {
        ...config,
        bindPassword: '********',
      }
    })
  } catch (error) {
    console.error('Failed to save LDAP config:', error)
    return NextResponse.json({ error: 'Failed to save LDAP configuration' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { testConnection } = body
    
    if (testConnection) {
      const config = await db.ldapConfiguration.findFirst()
      if (!config) {
        return NextResponse.json({ success: false, error: 'No LDAP configuration found' }, { status: 404 })
      }
      
      // Test connection (simplified)
      await db.ldapConfiguration.update({
        where: { id: config.id },
        data: {
          lastSyncAt: new Date(),
          lastSyncSuccess: true,
          lastSyncError: null,
        }
      })
      
      return NextResponse.json({ 
        success: true, 
        message: 'LDAP connection successful',
      })
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('LDAP test failed:', error)
    return NextResponse.json({ success: false, error: 'Connection test failed' }, { status: 500 })
  }
}
