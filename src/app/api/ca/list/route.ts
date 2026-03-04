import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as fs from 'fs'

// GET - List all CA certificates
export async function GET() {
  try {
    // Get all Certificate Authorities with their CRL info
    const cas = await db.certificateAuthority.findMany({
      include: {
        crlInfo: true,
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    // Process each CA and check file existence
    const processedCAs = cas.map(ca => {
      let filesExist = false
      if (ca.certificatePath) {
        filesExist = fs.existsSync(ca.certificatePath)
      }

      return {
        id: ca.id,
        name: ca.name,
        type: ca.type,
        status: ca.status,
        isDefault: ca.isDefault,
        isExternal: ca.isExternal,
        subject: ca.subject,
        serialNumber: ca.serialNumber,
        issueDate: ca.issueDate,
        expiryDate: ca.expiryDate,
        keySize: ca.keySize,
        crlUrl: ca.crlUrl,
        certificatePath: ca.certificatePath,
        filesExist,
        crlInfo: ca.crlInfo ? {
          version: ca.crlInfo.version,
          thisUpdate: ca.crlInfo.thisUpdate,
          nextUpdate: ca.crlInfo.nextUpdate,
          revokedCount: ca.crlInfo.revokedCount,
        } : null,
      }
    })

    // Calculate stats
    const stats = {
      total: cas.length,
      active: cas.filter(ca => ca.status === 'ACTIVE').length,
      expired: cas.filter(ca => ca.status === 'EXPIRED').length,
      external: cas.filter(ca => ca.isExternal).length,
      managed: cas.filter(ca => !ca.isExternal).length,
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'LIST_CA_CERTIFICATES',
        category: 'CA_OPERATIONS',
        actorType: 'ADMIN',
        targetId: 'all',
        targetType: 'CertificateAuthority',
        details: JSON.stringify({ count: cas.length }),
        status: 'SUCCESS',
      },
    }).catch(() => {}) // Ignore audit log failures

    return NextResponse.json({
      cas: processedCAs,
      stats,
    })
  } catch (error) {
    console.error('List CAs error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
