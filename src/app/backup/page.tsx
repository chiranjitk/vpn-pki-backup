'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { BackupSettings } from '@/components/settings/backup-settings'

export default function BackupPage() {
  return (
    <AppLayout>
      <BackupSettings />
    </AppLayout>
  )
}
