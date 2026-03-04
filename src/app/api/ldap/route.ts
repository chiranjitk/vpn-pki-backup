/**
 * LDAP Configuration API
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Retrieve LDAP configuration
export async function GET() {
  try {
    let config = await db.ldapConfiguration.findFirst();
    
    if (!config) {
      return NextResponse.json({
        config: {
          id: null,
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
  }
}
