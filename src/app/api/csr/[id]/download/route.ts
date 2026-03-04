import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as fs from 'fs'

/**
 * CSR Download API
 * Downloads CSR or key file for a pending certificate request
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'server' // 'server' or 'client'
    const format = searchParams.get('format') || 'csr' // 'csr' or 'key'
    
    let csrPath: string | null = null
    let keyPath: string | null = null
    let commonName: string = 'unknown'
    
    if (type === 'server') {
      const cert = await db.serverCertificate.findUnique({
        where: { id },
      })
      
      if (!cert) {
        return NextResponse.json(
          { error: 'Server CSR not found' },
          { status: 404 }
        )
      }
      
      csrPath = cert.csrPath
      keyPath = cert.keyPath
      commonName = cert.commonName
    } else {
      const cert = await db.certificate.findUnique({
        where: { id },
      })
      
      if (!cert) {
        return NextResponse.json(
          { error: 'Client CSR not found' },
          { status: 404 }
        )
      }
      
      csrPath = cert.csrPath
      keyPath = cert.keyPath
      commonName = cert.commonName
    }
    
    // Determine which file to download
    let filePath: string | null = null
    let filename: string = ''
    let contentType: string = 'application/x-pem-file'
    
    if (format === 'key') {
      filePath = keyPath
      filename = `${commonName}.key`
      
      // Log key download (security sensitive)
      await db.auditLog.create({
        data: {
          action: 'DOWNLOAD_PRIVATE_KEY',
          category: 'CERTIFICATE_OPERATIONS',
          actorType: 'ADMIN',
          targetId: id,
          targetType: type === 'server' ? 'ServerCertificate' : 'Certificate',
          details: JSON.stringify({
            commonName,
            type,
          }),
          status: 'SUCCESS',
        },
      })
    } else {
      filePath = csrPath
      filename = `${commonName}.csr`
      
      // Log CSR download
      await db.auditLog.create({
        data: {
          action: 'DOWNLOAD_CSR',
          category: 'CERTIFICATE_OPERATIONS',
          actorType: 'ADMIN',
          targetId: id,
          targetType: type === 'server' ? 'ServerCertificate' : 'Certificate',
          details: JSON.stringify({
            commonName,
            type,
          }),
          status: 'SUCCESS',
        },
      })
    }
    
    if (!filePath) {
      return NextResponse.json(
        { error: `No ${format} path found for this CSR` },
        { status: 404 }
      )
    }
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: `${format.toUpperCase()} file not found on disk` },
        { status: 404 }
      )
    }
    
    const fileContent = fs.readFileSync(filePath)
    
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileContent.length.toString(),
      },
    })
  } catch (error) {
    console.error('Download CSR error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
