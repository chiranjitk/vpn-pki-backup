'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { VpnSessionsSettings } from '@/components/settings/vpn-sessions-settings'

export default function VpnSessionsPage() {
  return (
    <AppLayout>
      <VpnSessionsSettings />
    </AppLayout>
  )
}
