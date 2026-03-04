'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { NatPoliciesContent } from '@/components/nat/nat-policies-content'

export default function NatPage() {
  return (
    <AppLayout>
      <NatPoliciesContent />
    </AppLayout>
  )
}
