'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { ApiKeysSettings } from '@/components/settings/api-keys-settings'

export default function ApiKeysPage() {
  return (
    <AppLayout>
      <ApiKeysSettings />
    </AppLayout>
  )
}
