import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { db } from '@/lib/db'

const execAsync = promisify(exec)

// Timeout for commands in milliseconds
const COMMAND_TIMEOUT = 30000

// Allowed commands for security
const ALLOWED_COMMANDS = {
  ping: (target: string, count: number) => `ping -c ${count} -W 5 ${sanitizeInput(target)}`,
  traceroute: (target: string) => `traceroute -m 30 -w 3 ${sanitizeInput(target)}`,
  dig: (target: string, type: string) => `dig ${sanitizeInput(target)} ${sanitizeInput(type)} +short`,
  nc: (target: string, port: number) => `nc -zv -w 3 ${sanitizeInput(target)} ${port}`,
}

// Sanitize input to prevent command injection
function sanitizeInput(input: string): string {
  // Remove any characters that could be used for command injection
  // Allow only alphanumeric, dots, dashes, and underscores
  return input.replace(/[^a-zA-Z0-9.\-_]/g, '')
}

// Execute command with timeout
async function executeCommand(command: string): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execAsync(command, {
      timeout: COMMAND_TIMEOUT,
      maxBuffer: 1024 * 1024, // 1MB buffer
    })
    return result
  } catch (error: unknown) {
    // Handle timeout or command failure
    if (error instanceof Error) {
      if (error.message.includes('ETIMEDOUT')) {
        throw new Error('Command timed out')
      }
      // For commands that exit with non-zero code, we still want the output
      const execError = error as { stdout?: string; stderr?: string; message?: string }
      if (execError.stdout || execError.stderr) {
        return {
          stdout: execError.stdout || '',
          stderr: execError.stderr || '',
        }
      }
      throw error
    }
    throw new Error('Unknown error occurred')
  }
}

// POST - Run diagnostic command
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { tool, target, options = {} } = body

    // Validate required fields
    if (!tool || !target) {
      return NextResponse.json(
        { success: false, error: 'Tool and target are required' },
        { status: 400 }
      )
    }

    // Validate tool type
    if (!['ping', 'traceroute', 'dns', 'port'].includes(tool)) {
      return NextResponse.json(
        { success: false, error: 'Invalid tool type' },
        { status: 400 }
      )
    }

    let command: string
    let output = ''
    let errorOutput = ''

    switch (tool) {
      case 'ping': {
        const count = Math.min(Math.max(options.count || 4, 1), 20)
        command = ALLOWED_COMMANDS.ping(target, count)
        const result = await executeCommand(command)
        output = result.stdout
        errorOutput = result.stderr
        break
      }

      case 'traceroute': {
        command = ALLOWED_COMMANDS.traceroute(target)
        const result = await executeCommand(command)
        output = result.stdout
        errorOutput = result.stderr
        break
      }

      case 'dns': {
        const dnsType = (options.dnsType || 'A').toUpperCase()
        const validTypes = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA']
        if (!validTypes.includes(dnsType)) {
          return NextResponse.json(
            { success: false, error: 'Invalid DNS record type' },
            { status: 400 }
          )
        }
        command = ALLOWED_COMMANDS.dig(target, dnsType)
        const result = await executeCommand(command)
        output = result.stdout
        errorOutput = result.stderr

        // If dig output is empty, provide helpful message
        if (!output.trim() && !errorOutput.trim()) {
          output = `No ${dnsType} records found for ${target}`
        }
        break
      }

      case 'port': {
        const port = parseInt(options.port)
        if (isNaN(port) || port < 1 || port > 65535) {
          return NextResponse.json(
            { success: false, error: 'Invalid port number (must be 1-65535)' },
            { status: 400 }
          )
        }
        command = ALLOWED_COMMANDS.nc(target, port)
        try {
          const result = await executeCommand(command)
          output = result.stdout + '\n' + result.stderr
        } catch {
          // nc often returns non-zero when port is closed
          output = `Port ${port} appears to be closed on ${target}`
        }
        break
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown tool type' },
          { status: 400 }
        )
    }

    const duration = Date.now() - startTime

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'RUN_NETWORK_DIAGNOSTIC',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'NetworkDiagnostic',
        details: JSON.stringify({ tool, target, options, duration }),
        status: 'SUCCESS',
      },
    }).catch(() => {
      // Ignore audit log errors
    })

    return NextResponse.json({
      success: true,
      output: output || errorOutput || 'Command completed with no output',
      duration,
    })
  } catch (error: unknown) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    console.error('Diagnostic error:', error)

    // Log audit for failed attempt
    await db.auditLog.create({
      data: {
        action: 'RUN_NETWORK_DIAGNOSTIC',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetType: 'NetworkDiagnostic',
        details: JSON.stringify({ error: errorMessage, duration }),
        status: 'FAILURE',
      },
    }).catch(() => {
      // Ignore audit log errors
    })

    return NextResponse.json({
      success: false,
      output: '',
      error: errorMessage,
      duration,
    })
  }
}

// GET - Get diagnostic tools info
export async function GET() {
  return NextResponse.json({
    tools: [
      {
        id: 'ping',
        name: 'Ping',
        description: 'Test reachability and measure round-trip time',
        options: {
          count: {
            type: 'number',
            default: 4,
            min: 1,
            max: 20,
            description: 'Number of ping packets to send',
          },
        },
      },
      {
        id: 'traceroute',
        name: 'Traceroute',
        description: 'Trace the path packets take to a destination',
        options: {},
      },
      {
        id: 'dns',
        name: 'DNS Lookup',
        description: 'Query DNS records for a domain',
        options: {
          dnsType: {
            type: 'string',
            default: 'A',
            allowed: ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA'],
            description: 'DNS record type to query',
          },
        },
      },
      {
        id: 'port',
        name: 'Port Scanner',
        description: 'Check if a specific port is open',
        options: {
          port: {
            type: 'number',
            default: 80,
            min: 1,
            max: 65535,
            description: 'Port number to check',
          },
        },
      },
    ],
    timeout: COMMAND_TIMEOUT,
  })
}
