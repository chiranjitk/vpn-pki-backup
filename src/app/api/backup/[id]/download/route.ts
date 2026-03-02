import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as fs from 'fs'

// GET - Download backup
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const backup = await db.backupRecord.findUnique({
      where: { id },
    })

    if (!backup) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 })
    }

    if (!fs.existsSync(backup.filepath)) {
      return NextResponse.json({ error: 'Backup file not found' }, { status: 404 })
    }

    const fileContent = fs.readFileSync(backup.filepath)

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'DOWNLOAD_BACKUP',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetId: id,
        targetType: 'Backup',
        details: JSON.stringify({ filename: backup.filename }),
        status: 'SUCCESS',
      },
    })

    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${backup.filename}"`,
        'Content-Length': fileContent.length.toString(),
      },
    })
  } catch (error) {
    console.error('Download backup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
