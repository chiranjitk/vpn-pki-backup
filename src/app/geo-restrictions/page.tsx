'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { GeoIpSettings } from '@/components/settings/geo-ip-settings'

export default function GeoRestrictionsPage() {
  return (
    <AppLayout>
      <GeoIpSettings />
    </AppLayout>
  )
}
