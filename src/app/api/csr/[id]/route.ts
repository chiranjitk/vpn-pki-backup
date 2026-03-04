import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as fs from 'fs'

/**
 * Individual CSR Operations API
 * GET: Get CSR details
 * DELETE: Delete a pending CSR and its associated key
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'server'
    
    let record: any = null
    
    if (type === 'server') {
      record = await db.serverCertificate.findUnique({
        where: { id },
      })
    } else {
      record = await db.certificate.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              fullName: true,
            },
          },
        },
      })
    }
    
    if (!record) {
      return NextResponse.json(
        { error: 'CSR not found' },
        { status: 404 }
      )
    }
    
    // Read CSR content if file exists
    let csrPem: string | null = null
    if (record.csrPath && fs.existsSync(record.csrPath)) {
      csrPem = fs.readFileSync(record.csrPath, 'utf-8')
    }
    
    // Check if key exists
    const keyExists = record.keyPath && fs.existsSync(record.keyPath)
    
    return NextResponse.json({
      success: true,
      csr: {
        id: record.id,
        type,
        commonName: record.commonName,
        subject: record.subject,
        status: record.status,
        createdAt: record.createdAt,
        csrPath: record.csrPath,
        keyPath: record.keyPath,
        csrPem,
        keyExists,
        user: record.user || undefined,
      },
    })
  } catch (error) {
    console.error('Get CSR error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'server'
    
    let record: any = null
    
    if (type === 'server') {
      record = await db.serverCertificate.findUnique({
        where: { id },
      })
    } else {
      record = await db.certificate.findUnique({
        where: { id },
      })
    }
    
    if (!record) {
      return NextResponse.json(
        { error: 'CSR not found' },
        { status: 404 }
      )
    }
    
    // Only allow deletion of pending CSRs
    if (record.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Cannot delete CSR that is not in PENDING status' },
        { status: 400 }
      )
    }
    
    // Delete files from disk
    if (record.csrPath && fs.existsSync(record.csrPath)) {
      fs.unlinkSync(record.csrPath)
      console.log(`[CSR] Deleted CSR file: ${record.csrPath}`)
    }
    
    if (record.keyPath && fs.existsSync(record.keyPath)) {
      fs.unlinkSync(record.keyPath)
      console.log(`[CSR] Deleted key file: ${record.keyPath}`)
    }
    
    // Delete database record
    if (type === 'server') {
      await db.serverCertificate.delete({
        where: { id },
      })
    } else {
      await db.certificate.delete({
        where: { id },
      })
    }
    
    // Log audit
    await db.auditLog.create({
      data: {
        action: 'DELETE_CSR',
        category: 'CERTIFICATE_OPERATIONS',
        actorType: 'ADMIN',
        targetId: id,
        targetType: type === 'server' ? 'ServerCertificate' : 'Certificate',
        details: JSON.stringify({
          commonName: record.commonName,
          type,
          csrPath: record.csrPath,
          keyPath: record.keyPath,
        }),
        status: 'SUCCESS',
      },
    })
    
    return NextResponse.json({
      success: true,
      message: 'CSR deleted successfully',
    })
  } catch (error) {
    console.error('Delete CSR error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
