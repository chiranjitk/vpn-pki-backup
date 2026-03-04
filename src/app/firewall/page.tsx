'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { FirewallRulesContent } from '@/components/firewall/firewall-rules-content'

export default function FirewallPage() {
  return (
    <AppLayout>
      <FirewallRulesContent />
    </AppLayout>
  )
}
