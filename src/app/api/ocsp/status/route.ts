import { NextRequest, NextResponse } from 'next/server'

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
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
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
  }
}
