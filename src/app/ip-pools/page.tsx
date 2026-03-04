'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { IpPoolsContent } from '@/components/vpn/ip-pools-content'

export default function IpPoolsPage() {
  return (
    <AppLayout>
      <IpPoolsContent />
    </AppLayout>
  )
}
