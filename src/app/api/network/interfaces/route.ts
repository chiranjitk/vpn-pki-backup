import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getSystemInterfaces,
  getInterfaceConfig,
  applyInterfaceConfig,
  setInterfaceState,
  type InterfaceConfig,
} from '@/lib/network/interfaces'

// GET - List all network interfaces (real data from system)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')

    // If specific interface requested
    if (name) {
      const config = await getInterfaceConfig(name)
      if (!config) {
        return NextResponse.json({ error: `Interface ${name} not found` }, { status: 404 })
      }
      return NextResponse.json({ interface: config })
    }

    // Get all system interfaces
    const interfaces = await getSystemInterfaces()

    // Get saved configurations from database
    const configSetting = await db.systemSetting.findUnique({
      where: { key: 'network_interfaces' }
    })

    let savedConfigs: Record<string, {
      type?: string
      description?: string
      updatedAt?: string
    }> = {}
    if (configSetting?.value) {
      try {
        savedConfigs = JSON.parse(configSetting.value)
      } catch {
        savedConfigs = {}
      }
    }

    // Merge saved configs with detected interfaces
    const mergedInterfaces = interfaces.map(iface => {
      const savedConfig = savedConfigs[iface.name] || {}
      return {
        ...iface,
        type: savedConfig.type || iface.type,
        description: savedConfig.description || iface.description || '',
      }
    })

    // Create audit log for viewing interfaces
    await db.auditLog.create({
      data: {
        action: 'VIEW_NETWORK_INTERFACES',
        category: 'NETWORK',
        actorId: 'system',
        actorType: 'ADMIN',
        targetId: 'all',
        targetType: 'INTERFACE',
        details: JSON.stringify({ count: interfaces.length }),
        status: 'SUCCESS',
      }
    }).catch(() => {}) // Ignore audit log failures

    return NextResponse.json({ 
      interfaces: mergedInterfaces,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to fetch interfaces:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch network interfaces',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// PUT - Update interface configuration
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      name, 
      type, 
      ipMethod, 
      ipAddress, 
      subnetMask, 
      gateway, 
      dnsServers, 
      mtu, 
      isDefaultGateway, 
      isEnabled, 
      pppoeUsername,
      pppoePassword,
      description,
      applyNow = false, // Whether to apply immediately or just save config
    } = body

    if (!name) {
      return NextResponse.json({ error: 'Interface name is required' }, { status: 400 })
    }

    // Validate IP method
    const validMethods = ['DHCP', 'STATIC', 'PPPOE', 'MANUAL']
    if (ipMethod && !validMethods.includes(ipMethod)) {
      return NextResponse.json({ 
        error: `Invalid IP method. Must be one of: ${validMethods.join(', ')}` 
      }, { status: 400 })
    }

    // Validate IP address format if provided
    if (ipAddress && ipMethod === 'STATIC') {
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
      if (!ipRegex.test(ipAddress)) {
        return NextResponse.json({ error: 'Invalid IP address format' }, { status: 400 })
      }
    }

    // Validate subnet mask if provided
    if (subnetMask && ipMethod === 'STATIC') {
      const maskRegex = /^(\d{1,3}\.){3}\d{1,3}$/
      if (!maskRegex.test(subnetMask)) {
        return NextResponse.json({ error: 'Invalid subnet mask format' }, { status: 400 })
      }
    }

    // Build config object
    const config: InterfaceConfig = {
      name,
      type: type || 'LAN',
      ipMethod: ipMethod || 'DHCP',
      ipAddress: ipAddress || '',
      subnetMask: subnetMask || '255.255.255.0',
      gateway: gateway || '',
      dnsServers: typeof dnsServers === 'string' 
        ? dnsServers.split(',').map((s: string) => s.trim()).filter(Boolean) 
        : (dnsServers || []),
      mtu: mtu || 1500,
      isDefaultGateway: isDefaultGateway || false,
      isEnabled: isEnabled !== false, // Default to true
      pppoeUsername: pppoeUsername || '',
      pppoePassword: pppoePassword || '',
      description: description || '',
    }

    // Get existing interface configurations from database
    const configSetting = await db.systemSetting.findUnique({
      where: { key: 'network_interfaces' }
    })

    let configs: Record<string, unknown> = {}
    if (configSetting?.value) {
      try {
        configs = JSON.parse(configSetting.value)
      } catch {
        configs = {}
      }
    }

    // Update configuration in database
    configs[name] = {
      ...config,
      dnsServers: config.dnsServers,
      updatedAt: new Date().toISOString(),
    }

    // Save to database
    await db.systemSetting.upsert({
      where: { key: 'network_interfaces' },
      create: { key: 'network_interfaces', value: JSON.stringify(configs) },
      update: { value: JSON.stringify(configs) }
    })

    // Apply to system if requested
    let applyResult = null
    if (applyNow) {
      applyResult = await applyInterfaceConfig(config)
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        action: applyNow ? 'APPLY_INTERFACE_CONFIG' : 'UPDATE_INTERFACE_CONFIG',
        category: 'NETWORK',
        actorId: 'system',
        actorType: 'ADMIN',
        targetId: name,
        targetType: 'INTERFACE',
        details: JSON.stringify({ 
          type, 
          ipMethod, 
          ipAddress,
          subnetMask,
          gateway,
          mtu,
          applyNow,
          applySuccess: applyResult?.success,
        }),
        status: applyNow && !applyResult?.success ? 'FAILURE' : 'SUCCESS',
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: applyNow 
        ? (applyResult?.message || `Interface ${name} configuration applied`)
        : `Interface ${name} configuration saved`,
      config: configs[name],
      applied: applyNow ? applyResult : null,
    })
  } catch (error) {
    console.error('Failed to update interface:', error)
    return NextResponse.json({ 
      error: 'Failed to update interface configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST - Apply saved configuration or perform actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, name } = body

    switch (action) {
      case 'apply': {
        // Apply saved configuration for an interface
        if (!name) {
          return NextResponse.json({ error: 'Interface name is required' }, { status: 400 })
        }

        // Get saved config from database
        const configSetting = await db.systemSetting.findUnique({
          where: { key: 'network_interfaces' }
        })

        if (!configSetting?.value) {
          return NextResponse.json({ error: 'No saved configuration found' }, { status: 404 })
        }

        const configs = JSON.parse(configSetting.value)
        const savedConfig = configs[name]

        if (!savedConfig) {
          return NextResponse.json({ error: `No saved configuration for interface ${name}` }, { status: 404 })
        }

        // Apply the configuration
        const result = await applyInterfaceConfig(savedConfig as InterfaceConfig)

        // Create audit log
        await db.auditLog.create({
          data: {
            action: 'APPLY_INTERFACE_CONFIG',
            category: 'NETWORK',
            actorId: 'system',
            actorType: 'ADMIN',
            targetId: name,
            targetType: 'INTERFACE',
            details: JSON.stringify({ success: result.success, message: result.message }),
            status: result.success ? 'SUCCESS' : 'FAILURE',
          }
        })

        return NextResponse.json({
          success: result.success,
          message: result.message,
          details: result.details,
        })
      }

      case 'enable': {
        if (!name) {
          return NextResponse.json({ error: 'Interface name is required' }, { status: 400 })
        }

        const result = await setInterfaceState(name, true)
        
        await db.auditLog.create({
          data: {
            action: 'ENABLE_INTERFACE',
            category: 'NETWORK',
            actorId: 'system',
            actorType: 'ADMIN',
            targetId: name,
            targetType: 'INTERFACE',
            details: JSON.stringify({ success: result.success }),
            status: result.success ? 'SUCCESS' : 'FAILURE',
          }
        })

        return NextResponse.json(result)
      }

      case 'disable': {
        if (!name) {
          return NextResponse.json({ error: 'Interface name is required' }, { status: 400 })
        }

        const result = await setInterfaceState(name, false)
        
        await db.auditLog.create({
          data: {
            action: 'DISABLE_INTERFACE',
            category: 'NETWORK',
            actorId: 'system',
            actorType: 'ADMIN',
            targetId: name,
            targetType: 'INTERFACE',
            details: JSON.stringify({ success: result.success }),
            status: result.success ? 'SUCCESS' : 'FAILURE',
          }
        })

        return NextResponse.json(result)
      }

      case 'apply_all': {
        // Apply all saved configurations
        const configSetting = await db.systemSetting.findUnique({
          where: { key: 'network_interfaces' }
        })

        if (!configSetting?.value) {
          return NextResponse.json({ error: 'No saved configurations found' }, { status: 404 })
        }

        const configs = JSON.parse(configSetting.value)
        const results: Array<{ name: string; success: boolean; message: string }> = []

        for (const [interfaceName, config] of Object.entries(configs)) {
          const result = await applyInterfaceConfig(config as InterfaceConfig)
          results.push({
            name: interfaceName,
            success: result.success,
            message: result.message,
          })
        }

        await db.auditLog.create({
          data: {
            action: 'APPLY_ALL_INTERFACE_CONFIGS',
            category: 'NETWORK',
            actorId: 'system',
            actorType: 'ADMIN',
            targetId: 'all',
            targetType: 'INTERFACE',
            details: JSON.stringify({ results }),
            status: results.every(r => r.success) ? 'SUCCESS' : 'PARTIAL',
          }
        })

        return NextResponse.json({
          success: true,
          message: 'Applied all configurations',
          results,
        })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    console.error('Failed to perform network action:', error)
    return NextResponse.json({ 
      error: 'Failed to perform action',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
