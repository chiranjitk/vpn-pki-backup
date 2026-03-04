import { NextRequest, NextResponse } from 'next/server'

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
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
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
  }
}
