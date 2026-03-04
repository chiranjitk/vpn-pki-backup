/**
 * CRL Scheduler API Endpoint
 * 
 * Communicates with the CRL Auto-fetch Scheduler mini-service running on port 3031
 * 
 * GET: Get scheduler status
 * POST: Control scheduler (start, stop, fetch_now)
 * PUT: Update fetch interval
 */

import { NextRequest, NextResponse } from 'next/server'

// Scheduler service URL
const SCHEDULER_URL = 'http://localhost:3031'

// Headers for cross-port communication
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Transform-Port': '3031',
})

/**
 * GET - Get scheduler status
 */
export async function GET() {
  try {
    const response = await fetch(`${SCHEDULER_URL}/status`, {
      method: 'GET',
      headers: getHeaders(),
    })
    
    if (!response.ok) {
      throw new Error(`Scheduler service returned ${response.status}`)
    }
    
    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      scheduler: data,
    })
  } catch (error) {
    console.error('Failed to get scheduler status:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to connect to scheduler service',
        hint: 'Make sure the CRL scheduler service is running on port 3031',
        scheduler: {
          isRunning: false,
          startTime: null,
          lastCheck: null,
          totalFetches: 0,
          successfulFetches: 0,
          failedFetches: 0,
          activeFetches: 0,
        },
      },
      { status: 503 }
    )
  }
}

/**
 * POST - Control scheduler
 * 
 * Actions:
 * - { action: 'start' } - Start the scheduler
 * - { action: 'stop' } - Stop the scheduler
 * - { action: 'fetch_now', caId: string } - Force fetch CRL for a specific CA
 * - { action: 'check' } - Run a check cycle
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, caId } = body
    
    let endpoint = ''
    let method = 'POST'
    
    switch (action) {
      case 'start':
        endpoint = '/start'
        break
      case 'stop':
        endpoint = '/stop'
        break
      case 'fetch_now':
        if (!caId) {
          return NextResponse.json(
            { success: false, error: 'caId is required for fetch_now action' },
            { status: 400 }
          )
        }
        endpoint = `/fetch/${caId}`
        break
      case 'check':
        endpoint = '/check'
        break
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: start, stop, fetch_now, or check' },
          { status: 400 }
        )
    }
    
    const response = await fetch(`${SCHEDULER_URL}${endpoint}`, {
      method,
      headers: getHeaders(),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      return NextResponse.json(
        { success: false, error: errorData.error || `Scheduler returned ${response.status}` },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      action,
      result: data,
    })
  } catch (error) {
    console.error('Failed to control scheduler:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to connect to scheduler service',
        hint: 'Make sure the CRL scheduler service is running on port 3031',
      },
      { status: 503 }
    )
  }
}

/**
 * PUT - Update fetch interval for a CA
 * 
 * Body: { caId: string, intervalHours: number }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { caId, intervalHours } = body
    
    if (!caId) {
      return NextResponse.json(
        { success: false, error: 'caId is required' },
        { status: 400 }
      )
    }
    
    if (!intervalHours || intervalHours < 1) {
      return NextResponse.json(
        { success: false, error: 'intervalHours must be at least 1' },
        { status: 400 }
      )
    }
    
    const response = await fetch(`${SCHEDULER_URL}/interval/${caId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ intervalHours }),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      return NextResponse.json(
        { success: false, error: errorData.error || `Scheduler returned ${response.status}` },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      result: data,
    })
  } catch (error) {
    console.error('Failed to update interval:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to connect to scheduler service',
        hint: 'Make sure the CRL scheduler service is running on port 3031',
      },
      { status: 503 }
    )
  }
}
