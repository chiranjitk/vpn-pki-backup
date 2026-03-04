'use client'

<<<<<<< HEAD
import { useState, useEffect } from 'react'
import { AppSidebar } from './app-sidebar'
import { AppHeader } from './app-header'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { useHydrated } from '@/hooks/use-local-storage'
=======
import { useState } from 'react'
import { AppSidebar } from './app-sidebar'
import { AppHeader } from './app-header'
import { cn } from '@/lib/utils'
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124

interface AppLayoutProps {
  children: React.ReactNode
}

<<<<<<< HEAD
const SIDEBAR_COLLAPSED_KEY = 'vpn-pki-sidebar-collapsed'

export function AppLayout({ children }: AppLayoutProps) {
  const hydrated = useHydrated()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Load saved state after hydration
  useEffect(() => {
    if (hydrated) {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
      if (saved === 'true') {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- This is a valid pattern for hydrating from localStorage after SSR
        setSidebarCollapsed(true)
      }
    }
  }, [hydrated])

  // Save collapsed state when it changes
  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed))
    }
  }, [sidebarCollapsed, hydrated])

  // Handle sidebar toggle
  const handleToggleSidebar = () => {
    setSidebarCollapsed(prev => !prev)
  }

  // Show consistent loading state during SSR and initial hydration
  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - Desktop */}
      <div className="hidden lg:block shrink-0">
        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggle={handleToggleSidebar}
=======
export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - Desktop */}
      <div className="hidden lg:block">
        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
<<<<<<< HEAD
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity duration-300"
=======
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={cn(
<<<<<<< HEAD
          'fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-out lg:hidden',
=======
          'fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:hidden',
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <AppSidebar collapsed={false} onToggle={() => setMobileMenuOpen(false)} />
      </div>

      {/* Main Content Area */}
<<<<<<< HEAD
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
=======
      <div className="flex flex-1 flex-col overflow-hidden">
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
        <AppHeader
          showMenuButton={true}
          onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>

        {/* Footer */}
<<<<<<< HEAD
        <footer className="mt-auto border-t border-border/50 bg-card/80 backdrop-blur-sm px-4 py-3">
          <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
            <div className="flex items-center gap-4">
              <span className="font-semibold text-primary">24online</span>
              <span className="hidden sm:inline text-border">•</span>
              <span className="hidden sm:inline">VPN Server Management Platform</span>
=======
        <footer className="mt-auto border-t bg-card px-4 py-3">
          <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
            <div className="flex items-center gap-4">
              <span className="font-medium text-primary">24online</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">VPN Server Management</span>
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
            </div>
            <div className="flex items-center gap-4">
              <span>© 2026 24online</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
