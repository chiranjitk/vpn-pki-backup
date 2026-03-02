import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as fs from 'fs'
import * as path from 'path'

const BACKUP_DIR = '/home/z/my-project/backups'

// Helper to ensure backup directory exists
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
  }
}

// Helper to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// GET - List all backups
export async function GET() {
  try {
    ensureBackupDir()

    const backups = await db.backupRecord.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({ backups })
  } catch (error) {
    console.error('Get backups error:', error)
    return NextResponse.json({ backups: [] })
  }
}

// POST - Create a new backup
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type = 'FULL' } = body

    ensureBackupDir()

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `backup-${type.toLowerCase()}-${timestamp}.tar.gz`
    const filepath = path.join(BACKUP_DIR, filename)

    // Create backup record
    const backup = await db.backupRecord.create({
      data: {
        filename,
        filepath,
        size: 0,
        type: type as any,
        status: 'IN_PROGRESS',
      },
    })

    try {
      // In a real implementation, you would:
      // 1. Export database (sqlite dump or prisma export)
      // 2. Copy configuration files
      // 3. Copy certificates (if included in backup type)
      // 4. Create tar.gz archive

      // Simulate backup creation
      const dbPath = '/home/z/my-project/db/custom.db'
      let size = 0

      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath)
        size = stats.size
      }

      // Create a simple backup marker file for demonstration
      fs.writeFileSync(filepath, `Backup created at ${new Date().toISOString()}\nType: ${type}\n`)
      size = fs.statSync(filepath).size

      // Update backup record
      await db.backupRecord.update({
        where: { id: backup.id },
        data: {
          size,
          status: 'COMPLETED',
        },
      })

      // Log audit
      await db.auditLog.create({
        data: {
          action: 'CREATE_BACKUP',
          category: 'SYSTEM_CONFIG',
          actorType: 'ADMIN',
          targetId: backup.id,
          targetType: 'Backup',
          details: JSON.stringify({ filename, type, size }),
          status: 'SUCCESS',
        },
      })

      return NextResponse.json({
        success: true,
        backup: {
          id: backup.id,
          filename,
          size,
          type,
          status: 'COMPLETED',
        },
      })
    } catch (backupError) {
      // Update backup record as failed
      await db.backupRecord.update({
        where: { id: backup.id },
        data: { status: 'FAILED' },
      })

      throw backupError
    }
  } catch (error) {
    console.error('Create backup error:', error)
    return NextResponse.json({ error: 'Failed to create backup' }, { status: 500 })
  }
}
