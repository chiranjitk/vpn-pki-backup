import { NextRequest, NextResponse } from 'next/server'

<<<<<<< HEAD
const OCSP_PORT = 3033

export async function GET(request: NextRequest) {
  try {
    // Try to connect to OCSP responder service
    const response = await fetch(`http://localhost:${OCSP_PORT}/status`, {
      method: 'GET',
      headers: {
        'X-Transform-Port': OCSP_PORT.toString(),
      },
    })

    if (!response.ok) {
      return NextResponse.json({
        isRunning: false,
        error: 'OCSP responder not responding',
      })
    }

    const status = await response.json()
    return NextResponse.json({
      isRunning: true,
      ...status,
    })
  } catch (error) {
    return NextResponse.json({
      isRunning: false,
      error: error instanceof Error ? error.message : 'Unknown error',
=======
export async function GET() {
  try {
    // Check OCSP responder status via port 3033
    const response = await fetch('http://localhost:3033/status', {
      signal: AbortSignal.timeout(5000),
    }).catch(() => null)
    
    if (!response) {
      return NextResponse.json({
        isRunning: false,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        lastRequest: null,
      })
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to get OCSP status:', error)
    return NextResponse.json({
      isRunning: false,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      lastRequest: null,
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
<<<<<<< HEAD
    const { action } = body

    if (action === 'check-certificate') {
      const { serialNumber } = body
      if (!serialNumber) {
        return NextResponse.json(
          { error: 'Serial number is required' },
          { status: 400 }
        )
      }

      const response = await fetch(`http://localhost:${OCSP_PORT}/check/${serialNumber}`, {
        method: 'GET',
        headers: {
          'X-Transform-Port': OCSP_PORT.toString(),
        },
      })

      if (!response.ok) {
        return NextResponse.json(
          { error: 'Failed to check certificate' },
          { status: 500 }
        )
      }

      const result = await response.json()
      return NextResponse.json(result)
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('OCSP status error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
=======
    const { action, serialNumber } = body
    
    if (action === 'check-certificate' && serialNumber) {
      const response = await fetch(`http://localhost:3033/check/${serialNumber}`, {
        signal: AbortSignal.timeout(5000),
      }).catch(() => null)
      
      if (!response) {
        return NextResponse.json({ error: 'OCSP responder not available' }, { status: 503 })
      }
      
      const data = await response.json()
      return NextResponse.json(data)
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('OCSP check failed:', error)
    return NextResponse.json({ error: 'OCSP check failed' }, { status: 500 })
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  }
}
