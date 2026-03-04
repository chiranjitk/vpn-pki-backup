'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { GuestUsersSettings } from '@/components/settings/guest-users-settings'

export default function GuestUsersPage() {
  return (
    <AppLayout>
      <GuestUsersSettings />
    </AppLayout>
  )
}
