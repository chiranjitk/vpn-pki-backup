'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { DiagnosticsContent } from '@/components/network/diagnostics-content'

export default function DiagnosticsPage() {
  return (
    <AppLayout>
      <DiagnosticsContent />
    </AppLayout>
  )
}
