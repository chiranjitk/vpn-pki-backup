'use client'

// VPN PKI Management Platform - Main Entry Point
import { useAuth } from '@/hooks/use-auth'
import { AppLayout } from '@/components/layout/app-layout'
import { DashboardContent } from '@/components/dashboard/dashboard-content'
import { LoginPage } from '@/components/auth/login-page'
import { Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function HomePage() {
  const { isAuthenticated } = useAuth()
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect
    const timer = setTimeout(() => setHydrated(true), 0)
    return () => clearTimeout(timer)
  }, [])

  // Show loading while hydrating from localStorage
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />
  }

  // Show dashboard if authenticated
  return (
    <AppLayout>
      <DashboardContent />
    </AppLayout>
  )
}
