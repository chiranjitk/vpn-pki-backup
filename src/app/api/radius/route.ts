/**
 * RADIUS Configuration API
 * 
 * Manages RADIUS server configuration for VPN authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Retrieve RADIUS configuration
export async function GET() {
  try {
    let config = await db.radiusConfiguration.findFirst();
    
    if (!config) {
      // Return default configuration
      return NextResponse.json({
        config: {
          id: null,
          host: '',
          port: 1812,
          secret: '',
          timeout: 5,
          accountingEnabled: false,
          accountingPort: 1813,
          isEnabled: false,
          lastTestAt: null,
          lastTestSuccess: null,
          lastTestError: null,
        }
      });
    }
    
    // Don't return the secret in the response
    const { secret: _, ...safeConfig } = config;
    
    return NextResponse.json({
      config: {
        ...safeConfig,
        secret: '••••••••', // Placeholder
      }
    });
  } catch (error) {
    console.error('Error fetching RADIUS config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RADIUS configuration' },
      { status: 500 }
    );
  }
}

// POST - Create or update RADIUS configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      host,
      port = 1812,
      secret,
      timeout = 5,
      accountingEnabled = false,
      accountingPort = 1813,
      isEnabled = false,
    } = body;
    
    if (!host) {
      return NextResponse.json(
        { error: 'Host is required' },
        { status: 400 }
      );
    }
    
    // Check if config exists
    const existing = await db.radiusConfiguration.findFirst();
    
    let config;
    if (existing) {
      // Update existing config
      const updateData: Record<string, unknown> = {
        host,
        port,
        timeout,
        accountingEnabled,
        accountingPort,
        isEnabled,
      };
      
      // Only update secret if provided and not placeholder
      if (secret && secret !== '••••••••') {
        updateData.secret = secret;
      }
      
      config = await db.radiusConfiguration.update({
        where: { id: existing.id },
        data: updateData,
      });
    } else {
      // Create new config
      if (!secret) {
        return NextResponse.json(
          { error: 'Secret is required for new configuration' },
          { status: 400 }
        );
      }
      
      config = await db.radiusConfiguration.create({
        data: {
          host,
          port,
          secret,
          timeout,
          accountingEnabled,
          accountingPort,
          isEnabled,
        },
      });
    }
    
    const { secret: _, ...safeConfig } = config;
    
    return NextResponse.json({
      success: true,
      config: safeConfig,
    });
  } catch (error) {
    console.error('Error saving RADIUS config:', error);
    return NextResponse.json(
      { error: 'Failed to save RADIUS configuration' },
      { status: 500 }
    );
  }
}

// DELETE - Delete RADIUS configuration
export async function DELETE() {
  try {
    const existing = await db.radiusConfiguration.findFirst();
    
    if (existing) {
      await db.radiusConfiguration.delete({
        where: { id: existing.id },
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting RADIUS config:', error);
    return NextResponse.json(
      { error: 'Failed to delete RADIUS configuration' },
      { status: 500 }
    );
  }
}
