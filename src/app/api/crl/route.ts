import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as fs from 'fs'

// GET - Download CRL
export async function GET(request: NextRequest) {
  try {
    const ca = await db.certificateAuthority.findFirst({
      where: { isDefault: true, status: 'ACTIVE' }
    })

    if (!ca || !ca.crlPath) {
      return NextResponse.json(
        { error: 'CRL not configured. Generate CRL first.' },
        { status: 404 }
      )
    }

    if (!fs.existsSync(ca.crlPath)) {
      return NextResponse.json(
        { error: 'CRL file not found. Generate CRL first.' },
        { status: 404 }
      )
    }

    const fileContent = fs.readFileSync(ca.crlPath)

    // Log download
    await db.auditLog.create({
      data: {
        action: 'DOWNLOAD_CRL',
        category: 'CRL_OPERATIONS',
        actorType: 'ADMIN',
        targetType: 'CRL',
        details: JSON.stringify({ caId: ca.id, caName: ca.name }),
        status: 'SUCCESS',
      },
    })

    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': 'application/x-pem-file',
        'Content-Disposition': 'attachment; filename="ca.crl.pem"',
        'Content-Length': fileContent.length.toString(),
      },
    })
  } catch (error) {
    console.error('CRL download error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
