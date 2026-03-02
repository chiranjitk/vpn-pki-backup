import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Fetch notifications
export async function GET() {
  try {
    // First, generate notifications based on current system state
    await generateSystemNotifications()

    // Then fetch all non-dismissed notifications
    // @ts-ignore - Notification model might not exist in older db
    const notifications = await db.notification?.findMany({
      where: {
        isDismissed: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    }) || []

    return NextResponse.json({
      notifications: notifications.map((n: any) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.severity as 'success' | 'warning' | 'error' | 'info',
        timestamp: n.createdAt.toISOString(),
        read: n.isRead,
      })),
    })
  } catch (error) {
    console.error('Failed to fetch notifications:', error)
    return NextResponse.json({ notifications: [] })
  }
}

// Helper function to generate system notifications
async function generateSystemNotifications() {
  try {
    // Check if notification model exists
    // @ts-ignore
    if (!db.notification) return

    // Check for certificates expiring in the next 7 days
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

    const expiringCertificates = await db.certificate.findMany({
      where: {
        status: 'ACTIVE',
        expiryDate: {
          lte: sevenDaysFromNow,
          gte: new Date(),
        },
      },
    })

    for (const cert of expiringCertificates) {
      const daysUntilExpiry = Math.ceil(
        (cert.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )

      // Check if notification already exists
      // @ts-ignore
      const existing = await db.notification.findFirst({
        where: {
          type: 'cert-expire',
          referenceId: cert.id,
          isDismissed: false,
        },
      })

      if (!existing) {
        // @ts-ignore
        await db.notification.create({
          data: {
            type: 'cert-expire',
            referenceId: cert.id,
            title: 'Certificate Expiring',
            message: `Certificate for ${cert.commonName} expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`,
            severity: 'warning',
          },
        })
      }
    }

    // Check for already expired certificates that are still marked as ACTIVE
    const expiredCertificates = await db.certificate.findMany({
      where: {
        status: 'ACTIVE',
        expiryDate: {
          lt: new Date(),
        },
      },
    })

    for (const cert of expiredCertificates) {
      // @ts-ignore
      const existing = await db.notification.findFirst({
        where: {
          type: 'cert-expired',
          referenceId: cert.id,
          isDismissed: false,
        },
      })

      if (!existing) {
        // @ts-ignore
        await db.notification.create({
          data: {
            type: 'cert-expired',
            referenceId: cert.id,
            title: 'Certificate Expired',
            message: `Certificate for ${cert.commonName} has expired`,
            severity: 'error',
          },
        })
      }
    }

    // Check if CA is about to expire
    const caInfo = await db.certificateAuthority.findFirst({
      where: {
        status: 'ACTIVE',
        isDefault: true,
      },
    })

    if (caInfo?.expiryDate) {
      const caExpiryDays = Math.ceil(
        (caInfo.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )

      if (caExpiryDays <= 30 && caExpiryDays > 0) {
        // @ts-ignore
        const existing = await db.notification.findFirst({
          where: {
            type: 'ca-expire',
            referenceId: caInfo.id,
            isDismissed: false,
          },
        })

        if (!existing) {
          // @ts-ignore
          await db.notification.create({
            data: {
              type: 'ca-expire',
              referenceId: caInfo.id,
              title: 'CA Certificate Expiring',
              message: `CA certificate expires in ${caExpiryDays} days. Plan renewal.`,
              severity: 'warning',
            },
          })
        }
      } else if (caExpiryDays <= 0) {
        // @ts-ignore
        const existing = await db.notification.findFirst({
          where: {
            type: 'ca-expired',
            referenceId: caInfo.id,
            isDismissed: false,
          },
        })

        if (!existing) {
          // @ts-ignore
          await db.notification.create({
            data: {
              type: 'ca-expired',
              referenceId: caInfo.id,
              title: 'CA Certificate Expired',
              message: `CA certificate has expired. Certificates cannot be issued.`,
              severity: 'error',
            },
          })
        }
      }
    }

    // Check CRL status
    const crlInfo = await db.crlInfo.findFirst()
    if (crlInfo?.nextUpdate && new Date() > crlInfo.nextUpdate) {
      // @ts-ignore
      const existing = await db.notification.findFirst({
        where: {
          type: 'crl-outdated',
          isDismissed: false,
        },
      })

      if (!existing) {
        // @ts-ignore
        await db.notification.create({
          data: {
            type: 'crl-outdated',
            title: 'CRL Needs Update',
            message: 'Certificate Revocation List is past its next update time',
            severity: 'warning',
          },
        })
      }
    }

    // Check for recent audit failures
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    const recentFailures = await db.auditLog.findMany({
      where: {
        status: 'FAILURE',
        createdAt: { gte: oneDayAgo },
      },
      take: 3,
    })

    for (const log of recentFailures) {
      // @ts-ignore
      const existing = await db.notification.findFirst({
        where: {
          type: 'audit-failure',
          referenceId: log.id,
          isDismissed: false,
        },
      })

      if (!existing) {
        // @ts-ignore
        await db.notification.create({
          data: {
            type: 'audit-failure',
            referenceId: log.id,
            title: log.action.replace(/_/g, ' '),
            message: log.errorMessage || `${log.action} failed`,
            severity: 'error',
          },
        })
      }
    }
  } catch (error) {
    console.error('Failed to generate notifications:', error)
  }
}
