'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { AccessPoliciesSettings } from '@/components/settings/access-policies-settings'

export default function AccessPoliciesPage() {
  return (
    <AppLayout>
      <AccessPoliciesSettings />
    </AppLayout>
  )
}
