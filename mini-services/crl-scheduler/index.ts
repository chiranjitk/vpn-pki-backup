/**
 * CRL Auto-fetch Scheduler Service
 * 
 * A background service that automatically fetches CRLs from external CAs
 * and deploys them to strongSwan.
 * 
 * Port: 3031
 * CRL Directory: /etc/swanctl/x509crl/
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import { execSync, exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Database client
const prisma = new PrismaClient()

// Configuration
const CONFIG = {
  port: 3031,
  crlDir: '/etc/swanctl/x509crl',
  defaultFetchIntervalHours: 24,
  maxRetries: 3,
  retryBaseDelayMs: 1000, // 1 second base delay, doubles each retry
}

// Scheduler state
interface SchedulerState {
  isRunning: boolean
  startTime: Date | null
  lastCheck: Date | null
  totalFetches: number
  successfulFetches: number
  failedFetches: number
  activeFetches: number
}

const schedulerState: SchedulerState = {
  isRunning: false,
  startTime: null,
  lastCheck: null,
  totalFetches: 0,
  successfulFetches: 0,
  failedFetches: 0,
  activeFetches: 0,
}

// CRL fetch log entry
interface CrlFetchLog {
  id: string
  caId: string
  caName: string
  url: string
  status: 'success' | 'failed' | 'skipped'
  timestamp: Date
  duration?: number
  errorMessage?: string
  crlSize?: number
  format?: 'PEM' | 'DER'
}

// In-memory log (last 100 entries)
const fetchLogs: CrlFetchLog[] = []
const MAX_LOG_ENTRIES = 100

// Timer reference
let schedulerInterval: Timer | null = null

/**
 * Add a log entry
 */
function addLog(entry: Omit<CrlFetchLog, 'id' | 'timestamp'>): void {
  const log: CrlFetchLog = {
    ...entry,
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
  }
  
  fetchLogs.unshift(log)
  if (fetchLogs.length > MAX_LOG_ENTRIES) {
    fetchLogs.pop()
  }
  
  // Log to console
  const statusIcon = entry.status === 'success' ? '✓' : entry.status === 'failed' ? '✗' : '○'
  console.log(`[${log.timestamp.toISOString()}] ${statusIcon} CRL Fetch: ${entry.caName} - ${entry.status}${entry.errorMessage ? ` (${entry.errorMessage})` : ''}`)
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Fetch CRL from URL with retry logic
 */
async function fetchCRLWithRetry(
  url: string,
  maxRetries: number = CONFIG.maxRetries
): Promise<{ success: boolean; data?: Buffer; error?: string; format?: 'PEM' | 'DER' }> {
  let lastError: string | undefined
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Use curl to fetch the CRL
      const result = execSync(`curl -sSL --max-time 30 "${url}"`, { 
        encoding: 'buffer',
        timeout: 35000 // 35 seconds total timeout
      })
      
      if (!result || result.length === 0) {
        throw new Error('Empty response received')
      }
      
      // Detect format
      const dataStr = result.toString('utf8', 0, Math.min(result.length, 100))
      let format: 'PEM' | 'DER' = 'DER'
      
      if (dataStr.includes('-----BEGIN X509 CRL-----')) {
        format = 'PEM'
      }
      
      return { success: true, data: result, format }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error'
      
      if (attempt < maxRetries) {
        const delay = CONFIG.retryBaseDelayMs * Math.pow(2, attempt - 1)
        console.log(`  Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`)
        await sleep(delay)
      }
    }
  }
  
  return { success: false, error: lastError }
}

/**
 * Convert DER format CRL to PEM
 */
function derToPem(derBuffer: Buffer): string {
  const base64 = derBuffer.toString('base64')
  const lines = base64.match(/.{1,64}/g) || []
  return `-----BEGIN X509 CRL-----\n${lines.join('\n')}\n-----END X509 CRL-----\n`
}

/**
 * Validate CRL format
 */
function validateCRL(crlPath: string): { valid: boolean; error?: string } {
  try {
    const result = execSync(`openssl crl -in "${crlPath}" -noout -text 2>&1`, { encoding: 'utf-8' })
    if (result.includes('unable to load CRL') || result.includes('error:')) {
      return { valid: false, error: 'Invalid CRL format' }
    }
    return { valid: true }
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Unknown validation error'
    return { valid: false, error: err }
  }
}

/**
 * Ensure CRL directory exists
 */
function ensureCrlDirectory(): void {
  try {
    if (!fs.existsSync(CONFIG.crlDir)) {
      fs.mkdirSync(CONFIG.crlDir, { recursive: true, mode: 0o755 })
    }
  } catch (error) {
    console.warn(`[Warning] Could not create CRL directory: ${error}`)
    // Use fallback directory in sandbox
    const fallbackDir = '/tmp/swanctl/x509crl'
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true, mode: 0o755 })
    }
    CONFIG.crlDir = fallbackDir
    console.log(`[Fallback] Using CRL directory: ${fallbackDir}`)
  }
}

/**
 * Reload strongSwan to pick up new CRL
 */
async function reloadStrongSwan(): Promise<{ success: boolean; message: string }> {
  try {
    await execAsync('swanctl --load-all 2>/dev/null || systemctl reload strongswan 2>/dev/null || systemctl reload strongswan-starter 2>/dev/null')
    return { success: true, message: 'strongSwan reloaded successfully' }
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, message: `Failed to reload strongSwan: ${err}` }
  }
}

/**
 * Fetch CRL for a specific CA
 */
async function fetchCRLForCA(ca: {
  id: string
  name: string
  crlUrl: string | null
  crlLastFetch: Date | null
  crlNextFetch: Date | null
}): Promise<{ success: boolean; error?: string }> {
  if (!ca.crlUrl) {
    return { success: false, error: 'No CRL URL configured' }
  }
  
  const startTime = Date.now()
  schedulerState.activeFetches++
  schedulerState.totalFetches++
  
  try {
    // Fetch CRL
    const fetchResult = await fetchCRLWithRetry(ca.crlUrl)
    
    if (!fetchResult.success || !fetchResult.data) {
      schedulerState.failedFetches++
      addLog({
        caId: ca.id,
        caName: ca.name,
        url: ca.crlUrl,
        status: 'failed',
        errorMessage: fetchResult.error,
        duration: Date.now() - startTime,
      })
      return { success: false, error: fetchResult.error }
    }
    
    // Ensure CRL directory exists
    ensureCrlDirectory()
    
    // Convert to PEM if needed
    let crlContent: string
    if (fetchResult.format === 'DER') {
      crlContent = derToPem(fetchResult.data)
    } else {
      crlContent = fetchResult.data.toString('utf-8')
    }
    
    // Save CRL file
    const crlFileName = `ca_${ca.id}.crl`
    const crlPath = path.join(CONFIG.crlDir, crlFileName)
    fs.writeFileSync(crlPath, crlContent, { mode: 0o644 })
    
    // Validate CRL
    const validation = validateCRL(crlPath)
    if (!validation.valid) {
      schedulerState.failedFetches++
      addLog({
        caId: ca.id,
        caName: ca.name,
        url: ca.crlUrl,
        status: 'failed',
        errorMessage: `CRL validation failed: ${validation.error}`,
        duration: Date.now() - startTime,
        crlSize: crlContent.length,
        format: fetchResult.format,
      })
      return { success: false, error: `CRL validation failed: ${validation.error}` }
    }
    
    // Update database
    const now = new Date()
    const nextFetch = new Date(now.getTime() + CONFIG.defaultFetchIntervalHours * 60 * 60 * 1000)
    
    await prisma.certificateAuthority.update({
      where: { id: ca.id },
      data: {
        crlLastFetch: now,
        crlNextFetch: nextFetch,
        crlPath: crlPath,
      },
    })
    
    // Update CrlInfo if exists
    await prisma.crlInfo.upsert({
      where: { caId: ca.id },
      create: {
        caId: ca.id,
        version: 1,
        thisUpdate: now,
        nextUpdate: nextFetch,
        revokedCount: 0,
        filePath: crlPath,
        generatedAt: now,
      },
      update: {
        version: { increment: 1 },
        thisUpdate: now,
        nextUpdate: nextFetch,
        filePath: crlPath,
        generatedAt: now,
      },
    })
    
    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'CRL_AUTO_FETCH',
        category: 'CRL_OPERATIONS',
        actorType: 'SCHEDULED_TASK',
        targetId: ca.id,
        targetType: 'CertificateAuthority',
        details: JSON.stringify({
          caName: ca.name,
          url: ca.crlUrl,
          crlPath,
          format: fetchResult.format,
          size: crlContent.length,
        }),
        status: 'SUCCESS',
      },
    })
    
    schedulerState.successfulFetches++
    addLog({
      caId: ca.id,
      caName: ca.name,
      url: ca.crlUrl,
      status: 'success',
      duration: Date.now() - startTime,
      crlSize: crlContent.length,
      format: fetchResult.format,
    })
    
    // Reload strongSwan
    const reloadResult = await reloadStrongSwan()
    if (!reloadResult.success) {
      console.log(`  Warning: ${reloadResult.message}`)
    }
    
    return { success: true }
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Unknown error'
    schedulerState.failedFetches++
    addLog({
      caId: ca.id,
      caName: ca.name,
      url: ca.crlUrl,
      status: 'failed',
      errorMessage: err,
      duration: Date.now() - startTime,
    })
    return { success: false, error: err }
  } finally {
    schedulerState.activeFetches--
  }
}

/**
 * Check all CAs and fetch CRLs if needed
 */
async function checkAndFetchCRLs(): Promise<void> {
  schedulerState.lastCheck = new Date()
  
  try {
    // Find all external CAs with CRL URLs
    const externalCAs = await prisma.certificateAuthority.findMany({
      where: {
        isExternal: true,
        status: 'ACTIVE',
        crlUrl: { not: null },
      },
    })
    
    if (externalCAs.length === 0) {
      console.log('[Scheduler] No external CAs with CRL URLs found')
      return
    }
    
    console.log(`[Scheduler] Checking ${externalCAs.length} external CAs for CRL updates...`)
    
    const now = new Date()
    
    for (const ca of externalCAs) {
      // Check if fetch is needed
      const needsFetch = !ca.crlNextFetch || now >= ca.crlNextFetch
      
      if (needsFetch) {
        console.log(`[Scheduler] Fetching CRL for ${ca.name}...`)
        await fetchCRLForCA(ca)
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error checking CAs:', error)
  }
}

/**
 * Start the scheduler
 */
function startScheduler(): { success: boolean; message: string } {
  if (schedulerState.isRunning) {
    return { success: false, message: 'Scheduler is already running' }
  }
  
  schedulerState.isRunning = true
  schedulerState.startTime = new Date()
  
  // Run initial check immediately
  checkAndFetchCRLs().catch(console.error)
  
  // Set up interval for periodic checks (every hour)
  schedulerInterval = setInterval(() => {
    checkAndFetchCRLs().catch(console.error)
  }, 60 * 60 * 1000) // 1 hour
  
  console.log('[Scheduler] CRL auto-fetch scheduler started')
  
  return { success: true, message: 'Scheduler started successfully' }
}

/**
 * Stop the scheduler
 */
function stopScheduler(): { success: boolean; message: string } {
  if (!schedulerState.isRunning) {
    return { success: false, message: 'Scheduler is not running' }
  }
  
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
  }
  
  schedulerState.isRunning = false
  
  console.log('[Scheduler] CRL auto-fetch scheduler stopped')
  
  return { success: true, message: 'Scheduler stopped successfully' }
}

/**
 * Force fetch CRL for a specific CA
 */
async function forceFetchCRL(caId: string): Promise<{ success: boolean; message: string }> {
  const ca = await prisma.certificateAuthority.findUnique({
    where: { id: caId },
  })
  
  if (!ca) {
    return { success: false, message: 'CA not found' }
  }
  
  if (!ca.isExternal) {
    return { success: false, message: 'CA is not an external CA' }
  }
  
  if (!ca.crlUrl) {
    return { success: false, message: 'CA does not have a CRL URL configured' }
  }
  
  const result = await fetchCRLForCA(ca)
  
  return {
    success: result.success,
    message: result.success ? 'CRL fetched successfully' : `Failed to fetch CRL: ${result.error}`,
  }
}

/**
 * Update fetch interval for a CA
 */
async function updateFetchInterval(
  caId: string,
  intervalHours: number
): Promise<{ success: boolean; message: string }> {
  try {
    const ca = await prisma.certificateAuthority.findUnique({
      where: { id: caId },
    })
    
    if (!ca) {
      return { success: false, message: 'CA not found' }
    }
    
    const now = new Date()
    const nextFetch = new Date(now.getTime() + intervalHours * 60 * 60 * 1000)
    
    await prisma.certificateAuthority.update({
      where: { id: caId },
      data: { crlNextFetch: nextFetch },
    })
    
    return { success: true, message: `Fetch interval updated to ${intervalHours} hours` }
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, message: `Failed to update interval: ${err}` }
  }
}

/**
 * HTTP Server request handler
 */
async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const method = request.method
  const pathname = url.pathname
  
  // CORS headers for cross-origin requests
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Transform-Port',
  }
  
  // Handle preflight requests
  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    // GET /status - Get scheduler status
    if (method === 'GET' && pathname === '/status') {
      const status = {
        ...schedulerState,
        startTime: schedulerState.startTime?.toISOString() || null,
        lastCheck: schedulerState.lastCheck?.toISOString() || null,
        config: {
          port: CONFIG.port,
          crlDir: CONFIG.crlDir,
          defaultFetchIntervalHours: CONFIG.defaultFetchIntervalHours,
          maxRetries: CONFIG.maxRetries,
        },
        recentLogs: fetchLogs.slice(0, 10),
      }
      
      return Response.json(status, { headers: corsHeaders })
    }
    
    // GET /logs - Get all fetch logs
    if (method === 'GET' && pathname === '/logs') {
      return Response.json(fetchLogs, { headers: corsHeaders })
    }
    
    // GET /cas - Get all external CAs with CRL URLs
    if (method === 'GET' && pathname === '/cas') {
      const cas = await prisma.certificateAuthority.findMany({
        where: {
          isExternal: true,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          name: true,
          crlUrl: true,
          crlLastFetch: true,
          crlNextFetch: true,
          status: true,
        },
      })
      
      return Response.json(cas, { headers: corsHeaders })
    }
    
    // POST /start - Start scheduler
    if (method === 'POST' && pathname === '/start') {
      const result = startScheduler()
      return Response.json(result, { headers: corsHeaders })
    }
    
    // POST /stop - Stop scheduler
    if (method === 'POST' && pathname === '/stop') {
      const result = stopScheduler()
      return Response.json(result, { headers: corsHeaders })
    }
    
    // POST /fetch/:caId - Force fetch CRL for a specific CA
    if (method === 'POST' && pathname.startsWith('/fetch/')) {
      const caId = pathname.replace('/fetch/', '')
      const result = await forceFetchCRL(caId)
      return Response.json(result, { headers: corsHeaders })
    }
    
    // POST /check - Run a check cycle
    if (method === 'POST' && pathname === '/check') {
      await checkAndFetchCRLs()
      return Response.json({ success: true, message: 'Check cycle completed' }, { headers: corsHeaders })
    }
    
    // PUT /interval/:caId - Update fetch interval for a CA
    if (method === 'PUT' && pathname.startsWith('/interval/')) {
      const caId = pathname.replace('/interval/', '')
      const body = await request.json() as { intervalHours: number }
      const result = await updateFetchInterval(caId, body.intervalHours)
      return Response.json(result, { headers: corsHeaders })
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
 * Main entry point
 */
async function main() {
  console.log('========================================')
  console.log('  CRL Auto-fetch Scheduler Service')
  console.log('========================================')
  console.log(`Port: ${CONFIG.port}`)
  console.log(`CRL Directory: ${CONFIG.crlDir}`)
  console.log(`Default Interval: ${CONFIG.defaultFetchIntervalHours} hours`)
  console.log(`Max Retries: ${CONFIG.maxRetries}`)
  console.log('========================================')
  
  // Ensure CRL directory exists
  ensureCrlDirectory()
  
  // Connect to database
  await prisma.$connect()
  console.log('[Database] Connected successfully')
  
  // Start the HTTP server
  const server = Bun.serve({
    port: CONFIG.port,
    fetch: handleRequest,
  })
  
  console.log(`[Server] Listening on http://localhost:${CONFIG.port}`)
  
  // Auto-start scheduler
  const autoStartResult = startScheduler()
  console.log(`[Scheduler] Auto-start: ${autoStartResult.message}`)
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[Server] Shutting down...')
    stopScheduler()
    await prisma.$disconnect()
    process.exit(0)
  })
  
  process.on('SIGTERM', async () => {
    console.log('\n[Server] Shutting down...')
    stopScheduler()
    await prisma.$disconnect()
    process.exit(0)
  })
}

// Run the service
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
