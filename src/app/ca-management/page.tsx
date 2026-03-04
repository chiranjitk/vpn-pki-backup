'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { CAManagementContent } from '@/components/certificates/ca-management-content'

export default function CAManagementPage() {
  return (
    <AppLayout>
      <CAManagementContent />
    </AppLayout>
  )
}
