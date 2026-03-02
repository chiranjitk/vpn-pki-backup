'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { ServerCertificatesContent } from '@/components/server-certificates/server-certificates-content'

export default function ServerCertificatesPage() {
  return (
    <AppLayout>
      <ServerCertificatesContent />
    </AppLayout>
  )
}
