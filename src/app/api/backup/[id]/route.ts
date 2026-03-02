import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as fs from 'fs'

// DELETE - Delete a backup
export async function DELETE(
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

    // Delete file if exists
    if (fs.existsSync(backup.filepath)) {
      fs.unlinkSync(backup.filepath)
    }

    // Delete record from database
    await db.backupRecord.delete({
      where: { id },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        action: 'DELETE_BACKUP',
        category: 'SYSTEM_CONFIG',
        actorType: 'ADMIN',
        targetId: id,
        targetType: 'Backup',
        details: JSON.stringify({ filename: backup.filename }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete backup error:', error)
    return NextResponse.json({ error: 'Failed to delete backup' }, { status: 500 })
  }
}
