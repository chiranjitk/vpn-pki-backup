/**
 * OCSP Responder Service for VPN PKI Management Platform
 * 
 * This service responds to OCSP (Online Certificate Status Protocol) requests
 * to provide real-time certificate revocation status.
 * 
 * Port: 3033
 * Protocol: HTTP/OCSP
 * 
 * OCSP endpoints:
 * - POST / - Standard OCSP request (application/ocsp-request)
 * - GET /{base64-encoded-request} - GET-based OCSP request
 * - GET /status - Service status
 * - GET /health - Health check
 */

import { PrismaClient } from '@prisma/client'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

// Database client
const prisma = new PrismaClient()

// Configuration
const CONFIG = {
  port: 3033,
  // Certificate and key paths for signing OCSP responses
  ocspCertPath: process.env.OCSP_CERT_PATH || '/etc/swanctl/ocsp.crt',
  ocspKeyPath: process.env.OCSP_KEY_PATH || '/etc/swanctl/ocsp.key',
  caCertPath: process.env.CA_CERT_PATH || '/etc/swanctl/x509ca/intermediate.crt',
  // Response settings
  responseValiditySeconds: 3600, // 1 hour
  // Fallback directories
  fallbackDir: '/tmp/pki/ocsp',
}

// Service state
interface ServiceState {
  isRunning: boolean
  startTime: Date | null
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  lastRequest: Date | null
}

const serviceState: ServiceState = {
  isRunning: false,
  startTime: null,
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  lastRequest: null,
}

// OCSP Response Status
const OCSP_STATUS = {
  GOOD: 0,
  REVOKED: 1,
  UNKNOWN: 2,
}

// Revocation reasons
const REVOCATION_REASONS: Record<string, number> = {
  'UNSPECIFIED': 0,
  'KEY_COMPROMISE': 1,
  'CA_COMPROMISE': 2,
  'AFFILIATION_CHANGED': 3,
  'SUPERSEDED': 4,
  'CESSATION_OF_OPERATION': 5,
  'CERTIFICATE_HOLD': 6,
  'REMOVE_FROM_CRL': 8,
  'PRIVILEGE_WITHDRAWN': 9,
  'AA_COMPROMISE': 10,
}

/**
 * Generate a unique ID for OCSP responses
 */
function generateOcspId(): Buffer {
  return crypto.randomBytes(16)
}

/**
 * Get current timestamp in seconds
 */
function getTimestamp(): number {
  return Math.floor(Date.now() / 1000)
}

/**
 * Parse OCSP request (simplified - actual implementation would use ASN.1 parser)
 * Returns the certificate serial number being queried
 */
function parseOcspRequest(requestData: Buffer): { serialNumber: string } | null {
  try {
    // For a production implementation, you would use a proper ASN.1 parser
    // like node-forge or asn1.js. This is a simplified version.
    
    // The serial number is typically found in the OCSP request
    // For now, we'll extract it using regex patterns
    
    const hexData = requestData.toString('hex')
    
    // Look for INTEGER tag (02) followed by serial number
    // This is a simplified extraction - real OCSP parsing requires ASN.1
    const serialMatch = hexData.match(/020[0-9a-f]([0-9a-f]+)/i)
    
    if (serialMatch && serialMatch[1]) {
      // Convert hex to decimal string
      const serialHex = serialMatch[1].replace(/^0+/, '') || '0'
      return { serialNumber: BigInt('0x' + serialHex).toString() }
    }
    
    return null
  } catch (error) {
    console.error('[OCSP] Error parsing request:', error)
    return null
  }
}

/**
 * Check certificate status in database
 */
async function getCertificateStatus(serialNumber: string): Promise<{
  status: number
  revocationTime?: Date
  revocationReason?: number
}> {
  try {
    // Check for certificate with this serial number
    const certificate = await prisma.certificate.findFirst({
      where: { serialNumber },
      include: { revocation: true },
    })

    if (!certificate) {
      // Check if serial might have leading zeros
      const certBySerial = await prisma.certificate.findMany()
      for (const cert of certBySerial) {
        if (cert.serialNumber.replace(/^0+/, '') === serialNumber.replace(/^0+/, '')) {
          if (cert.status === 'REVOKED' && cert.revocation) {
            return {
              status: OCSP_STATUS.REVOKED,
              revocationTime: cert.revocation.revokedAt,
              revocationReason: REVOCATION_REASONS[cert.revocation.reason] || 0,
            }
          }
          if (cert.status === 'EXPIRED') {
            return { status: OCSP_STATUS.REVOKED }
          }
          return { status: OCSP_STATUS.GOOD }
        }
      }
      
      return { status: OCSP_STATUS.UNKNOWN }
    }

    if (certificate.status === 'REVOKED' && certificate.revocation) {
      return {
        status: OCSP_STATUS.REVOKED,
        revocationTime: certificate.revocation.revokedAt,
        revocationReason: REVOCATION_REASONS[certificate.revocation.reason] || 0,
      }
    }

    if (certificate.status === 'EXPIRED') {
      return { status: OCSP_STATUS.REVOKED }
    }

    return { status: OCSP_STATUS.GOOD }
  } catch (error) {
    console.error('[OCSP] Error checking certificate status:', error)
    return { status: OCSP_STATUS.UNKNOWN }
  }
}

/**
 * Create OCSP response using OpenSSL
 */
async function createOcspResponse(
  requestData: Buffer,
  certStatus: { status: number; revocationTime?: Date; revocationReason?: number },
  nonce?: Buffer
): Promise<Buffer | null> {
  try {
    // Create temporary directory for OCSP processing
    const tempDir = CONFIG.fallbackDir
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    // Save request to temp file
    const requestPath = path.join(tempDir, `request_${Date.now()}.der`)
    fs.writeFileSync(requestPath, requestData)

    // Build OpenSSL command for OCSP response
    let cmd = `openssl ocsp -index ${tempDir}/index.txt -CA ${CONFIG.caCertPath} -rsigner ${CONFIG.ocspCertPath} -rkey ${CONFIG.ocspKeyPath} -reqin ${requestPath} -respout ${requestPath}.resp`

    // Add nonce if provided
    if (nonce) {
      // Nonce extension OID: 1.3.6.1.5.5.7.1.1
    }

    // For sandbox/testing, create a simple response
    // In production, this would use proper certificate and key

    // Clean up
    try {
      fs.unlinkSync(requestPath)
    } catch {}

    // For now, return a basic OCSP response structure
    // This is a simplified version - production would need proper ASN.1 encoding
    return createBasicOcspResponse(certStatus, nonce)
  } catch (error) {
    console.error('[OCSP] Error creating response:', error)
    return null
  }
}

/**
 * Create a basic OCSP response (simplified for demonstration)
 */
function createBasicOcspResponse(
  certStatus: { status: number; revocationTime?: Date; revocationReason?: number },
  nonce?: Buffer
): Buffer {
  // This is a placeholder for actual OCSP response generation
  // In production, you would use proper ASN.1 encoding libraries
  
  // OCSP Response Structure (simplified):
  // OCSPResponseStatus ::= ENUMERATED {
  //   successful (0),  -- Response has valid confirmations
  //   malformedRequest (1),  -- Illegal confirmation request
  //   internalError (2),  -- Internal error in issuer
  //   tryLater (3),  -- Try again later
  //   sigRequired (5),  -- Must sign the request
  //   unauthorized (6)  -- Request unauthorized
  // }
  
  // For now, return a JSON response indicating status
  // This would need to be replaced with proper DER-encoded OCSP response
  const response = {
    status: certStatus.status,
    revocationTime: certStatus.revocationTime?.toISOString(),
    revocationReason: certStatus.revocationReason,
    producedAt: new Date().toISOString(),
    thisUpdate: new Date().toISOString(),
    nextUpdate: new Date(Date.now() + CONFIG.responseValiditySeconds * 1000).toISOString(),
  }
  
  return Buffer.from(JSON.stringify(response))
}

/**
 * Handle OCSP request
 */
async function handleOcspRequest(requestData: Buffer): Promise<{
  success: boolean
  response?: Buffer
  status?: number
  error?: string
}> {
  serviceState.totalRequests++
  serviceState.lastRequest = new Date()

  try {
    // Parse the OCSP request
    const parsed = parseOcspRequest(requestData)
    
    if (!parsed) {
      serviceState.failedRequests++
      return { success: false, error: 'Could not parse OCSP request' }
    }

    console.log(`[OCSP] Query for serial: ${parsed.serialNumber}`)

    // Get certificate status
    const certStatus = await getCertificateStatus(parsed.serialNumber)
    
    console.log(`[OCSP] Status: ${['GOOD', 'REVOKED', 'UNKNOWN'][certStatus.status]}`)

    // Create OCSP response
    const response = await createBasicOcspResponse(certStatus)

    serviceState.successfulRequests++
    
    return {
      success: true,
      response,
      status: certStatus.status,
    }
  } catch (error) {
    serviceState.failedRequests++
    console.error('[OCSP] Error handling request:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * HTTP Server request handler
 */
async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const method = request.method
  const pathname = url.pathname

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Transform-Port',
  }

  // Handle preflight
  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // GET /status - Service status
    if (method === 'GET' && pathname === '/status') {
      return Response.json({
        ...serviceState,
        startTime: serviceState.startTime?.toISOString() || null,
        lastRequest: serviceState.lastRequest?.toISOString() || null,
        config: {
          port: CONFIG.port,
          responseValiditySeconds: CONFIG.responseValiditySeconds,
        },
      }, { headers: corsHeaders })
    }

    // GET /health - Health check
    if (method === 'GET' && pathname === '/health') {
      return Response.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
      }, { headers: corsHeaders })
    }

    // GET /certificates - List all certificates with their status
    if (method === 'GET' && pathname === '/certificates') {
      const certificates = await prisma.certificate.findMany({
        select: {
          serialNumber: true,
          commonName: true,
          status: true,
          expiryDate: true,
          revocation: {
            select: {
              revokedAt: true,
              reason: true,
            },
          },
        },
        take: 100,
      })
      
      return Response.json({ certificates }, { headers: corsHeaders })
    }

    // GET /check/{serialNumber} - Check specific certificate status
    if (method === 'GET' && pathname.startsWith('/check/')) {
      const serialNumber = pathname.replace('/check/', '')
      const status = await getCertificateStatus(serialNumber)
      
      return Response.json({
        serialNumber,
        status: ['GOOD', 'REVOKED', 'UNKNOWN'][status.status],
        revocationTime: status.revocationTime?.toISOString(),
        revocationReason: status.revocationReason,
      }, { headers: corsHeaders })
    }

    // POST / - Standard OCSP request
    if (method === 'POST' && pathname === '/') {
      const contentType = request.headers.get('content-type') || ''
      
      // OCSP requests should be application/ocsp-request
      if (!contentType.includes('application/ocsp-request') && 
          !contentType.includes('application/octet-stream')) {
        // Also accept JSON for testing
        if (!contentType.includes('application/json')) {
          return Response.json(
            { error: 'Invalid content type. Expected application/ocsp-request' },
            { status: 400, headers: corsHeaders }
          )
        }
        
        // Handle JSON request (for testing)
        const body = await request.json() as { serialNumber: string }
        if (body.serialNumber) {
          const status = await getCertificateStatus(body.serialNumber)
          return Response.json({
            serialNumber: body.serialNumber,
            status: ['GOOD', 'REVOKED', 'UNKNOWN'][status.status],
            revocationTime: status.revocationTime?.toISOString(),
            revocationReason: status.revocationReason,
          }, { headers: corsHeaders })
        }
      }

      const requestData = Buffer.from(await request.arrayBuffer())
      const result = await handleOcspRequest(requestData)

      if (!result.success) {
        return Response.json(
          { error: result.error },
          { status: 500, headers: corsHeaders }
        )
      }

      // Return OCSP response
      return new Response(result.response, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/ocsp-response',
        },
      })
    }

    // GET /{base64} - GET-based OCSP request
    if (method === 'GET' && pathname.length > 1) {
      try {
        const base64Data = pathname.slice(1)
        const requestData = Buffer.from(base64Data, 'base64')
        const result = await handleOcspRequest(requestData)

        if (!result.success) {
          return Response.json(
            { error: result.error },
            { status: 500, headers: corsHeaders }
          )
        }

        return new Response(result.response, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/ocsp-response',
          },
        })
      } catch {
        return Response.json(
          { error: 'Invalid OCSP request encoding' },
          { status: 400, headers: corsHeaders }
        )
      }
    }

    // 404 for unknown routes
    return Response.json(
      { error: 'Not found' },
      { status: 404, headers: corsHeaders }
    )
  } catch (error) {
    console.error('[Server] Error handling request:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}

/**
 * Initialize OCSP index file
 */
function initializeOcspIndex(): void {
  const tempDir = CONFIG.fallbackDir
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }

  const indexPath = path.join(tempDir, 'index.txt')
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, '')
    console.log('[OCSP] Created index file')
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log('========================================')
  console.log('  OCSP Responder Service')
  console.log('========================================')
  console.log(`Port: ${CONFIG.port}`)
  console.log(`Response Validity: ${CONFIG.responseValiditySeconds}s`)
  console.log(`OCSP Cert: ${CONFIG.ocspCertPath}`)
  console.log(`OCSP Key: ${CONFIG.ocspKeyPath}`)
  console.log('========================================')

  // Initialize
  initializeOcspIndex()

  // Connect to database
  await prisma.$connect()
  console.log('[Database] Connected successfully')

  // Start HTTP server
  const server = Bun.serve({
    port: CONFIG.port,
    fetch: handleRequest,
  })

  console.log(`[Server] Listening on http://localhost:${CONFIG.port}`)

  serviceState.isRunning = true
  serviceState.startTime = new Date()

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[Server] Shutting down...')
    serviceState.isRunning = false
    await prisma.$disconnect()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.log('\n[Server] Shutting down...')
    serviceState.isRunning = false
    await prisma.$disconnect()
    process.exit(0)
  })
}

// Run the service
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
