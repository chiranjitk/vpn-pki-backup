'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { ConnectionProfilesContent } from '@/components/vpn/connection-profiles-content'

export default function VpnConfigPage() {
  return (
    <AppLayout>
      <ConnectionProfilesContent />
    </AppLayout>
  )
}
