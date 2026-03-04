'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { OcspSettingsContent } from '@/components/pki/ocsp-settings-content'

export default function OcspSettingsPage() {
  return (
    <AppLayout>
      <OcspSettingsContent />
    </AppLayout>
  )
}
