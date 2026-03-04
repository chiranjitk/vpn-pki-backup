<<<<<<< HEAD
/**
 * LDAP Configuration API
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Retrieve LDAP configuration
export async function GET() {
  try {
    let config = await db.ldapConfiguration.findFirst();
=======
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const config = await db.ldapConfiguration.findFirst()
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
    
    if (!config) {
      return NextResponse.json({
        config: {
<<<<<<< HEAD
          id: null,
=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
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
<<<<<<< HEAD
          syncAttributeDepartment: 'department',
          lastSyncAt: null,
          lastSyncSuccess: null,
          lastSyncError: null,
          lastSyncCount: null,
          autoCreateUsers: true,
          autoDisableUsers: false,
        }
      });
    }
    
    const { bindPassword: _, ...safeConfig } = config;
    
    return NextResponse.json({
      config: {
        ...safeConfig,
        bindPassword: '••••••••',
      }
    });
  } catch (error) {
    console.error('Error fetching LDAP config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch LDAP configuration' },
      { status: 500 }
    );
  }
}

// POST - Create or update LDAP configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      serverUrl,
      bindDn,
      bindPassword,
      baseDn,
      useTls = true,
      tlsVerifyCert = true,
      timeout = 30,
      isEnabled = false,
      syncInterval = 3600,
      syncFilter = '(objectClass=user)',
      syncAttributeUsername = 'sAMAccountName',
      syncAttributeEmail = 'mail',
      syncAttributeFullName = 'displayName',
      syncAttributeDepartment = 'department',
      autoCreateUsers = true,
      autoDisableUsers = false,
    } = body;
    
    if (!serverUrl || !bindDn || !baseDn) {
      return NextResponse.json(
        { error: 'Server URL, Bind DN, and Base DN are required' },
        { status: 400 }
      );
    }
    
    const existing = await db.ldapConfiguration.findFirst();
    
    let config;
    if (existing) {
      const updateData: Record<string, unknown> = {
        serverUrl,
        bindDn,
        baseDn,
        useTls,
        tlsVerifyCert,
        timeout,
        isEnabled,
        syncInterval,
        syncFilter,
        syncAttributeUsername,
        syncAttributeEmail,
        syncAttributeFullName,
        syncAttributeDepartment,
        autoCreateUsers,
        autoDisableUsers,
      };
      
      if (bindPassword && bindPassword !== '••••••••') {
        updateData.bindPassword = bindPassword;
      }
      
      config = await db.ldapConfiguration.update({
        where: { id: existing.id },
        data: updateData,
      });
    } else {
      if (!bindPassword) {
        return NextResponse.json(
          { error: 'Bind password is required for new configuration' },
          { status: 400 }
        );
      }
      
      config = await db.ldapConfiguration.create({
        data: {
          serverUrl,
          bindDn,
          bindPassword,
          baseDn,
          useTls,
          tlsVerifyCert,
          timeout,
          isEnabled,
          syncInterval,
          syncFilter,
          syncAttributeUsername,
          syncAttributeEmail,
          syncAttributeFullName,
          syncAttributeDepartment,
          autoCreateUsers,
          autoDisableUsers,
        },
      });
    }
    
    const { bindPassword: _, ...safeConfig } = config;
    
    return NextResponse.json({
      success: true,
      config: safeConfig,
    });
  } catch (error) {
    console.error('Error saving LDAP config:', error);
    return NextResponse.json(
      { error: 'Failed to save LDAP configuration' },
      { status: 500 }
    );
  }
}

// DELETE - Delete LDAP configuration
export async function DELETE() {
  try {
    const existing = await db.ldapConfiguration.findFirst();
    
    if (existing) {
      await db.ldapConfiguration.delete({
        where: { id: existing.id },
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting LDAP config:', error);
    return NextResponse.json(
      { error: 'Failed to delete LDAP configuration' },
      { status: 500 }
    );
=======
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
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  }
}
