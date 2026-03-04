import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - List audit logs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || 'all'
    const action = searchParams.get('action')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const where: any = {}

    if (category !== 'all') {
      where.category = category
    }

    if (action) {
      where.action = action
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate)
      }
    }

    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { details: { contains: search, mode: 'insensitive' } },
        { errorMessage: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              username: true,
              email: true,
<<<<<<< HEAD
              role: true,
=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.auditLog.count({ where }),
    ])

    // Get stats
    const stats = await db.auditLog.groupBy({
      by: ['status'],
      _count: true,
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    })

    return NextResponse.json({
      logs: logs.map((log) => {
        // Safely parse details JSON
        let parsedDetails = null
        if (log.details) {
          try {
            parsedDetails = JSON.parse(log.details)
          } catch {
            parsedDetails = log.details // Keep as string if not valid JSON
          }
        }
        
        return {
          id: log.id,
          action: log.action,
          category: log.category,
          actor: log.actor?.username || log.actorType,
<<<<<<< HEAD
          actorType: log.actor?.role || log.actorType,
=======
          actorType: log.actorType,
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
          targetId: log.targetId,
          targetType: log.targetType,
          details: parsedDetails,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          status: log.status,
          errorMessage: log.errorMessage,
          createdAt: log.createdAt,
        }
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        todayTotal: stats.reduce((acc, s) => acc + s._count, 0),
        todaySuccess: stats.find((s) => s.status === 'SUCCESS')?._count || 0,
        todayFailure: stats.find((s) => s.status === 'FAILURE')?._count || 0,
      },
    })
  } catch (error) {
    console.error('Get audit logs error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Export audit logs as CSV
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const exportFormat = searchParams.get('format') || 'csv'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const category = searchParams.get('category')

    const where: any = {}

    if (category && category !== 'all') {
      where.category = category
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate)
      }
    }

    const logs = await db.auditLog.findMany({
      where,
      include: {
        actor: {
          select: {
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000, // Limit export size
    })

    if (exportFormat === 'csv') {
      const headers = ['Timestamp', 'Action', 'Category', 'Actor', 'Status', 'Details']
      const rows = logs.map((log) => [
        log.createdAt.toISOString(),
        log.action,
        log.category,
        log.actor?.username || log.actorType,
        log.status,
        log.details || '',
      ])

      const csv = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Export audit logs error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Clear audit logs
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'all' // 'all', 'before-date', 'keep-recent'
    const beforeDate = searchParams.get('beforeDate')
    const keepDays = parseInt(searchParams.get('keepDays') || '30')

    let deletedCount = 0

    if (mode === 'all') {
      const result = await db.auditLog.deleteMany({})
      deletedCount = result.count
    } else if (mode === 'before-date' && beforeDate) {
      const result = await db.auditLog.deleteMany({
        where: {
          createdAt: { lt: new Date(beforeDate) }
        }
      })
      deletedCount = result.count
    } else if (mode === 'keep-recent') {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - keepDays)
      const result = await db.auditLog.deleteMany({
        where: {
          createdAt: { lt: cutoffDate }
        }
      })
      deletedCount = result.count
    }

    return NextResponse.json({ 
      success: true, 
      deletedCount,
      message: `Deleted ${deletedCount} audit log record(s)` 
    })
  } catch (error) {
    console.error('Clear audit logs error:', error)
    return NextResponse.json(
      { error: 'Failed to clear audit logs' },
      { status: 500 }
    )
  }
}
