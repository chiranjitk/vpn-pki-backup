<<<<<<< HEAD
// 24online VPN Server - Sidebar Navigation with Expandable Groups
=======
// 24online VPN Server - Sidebar Navigation
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  KeyRound,
  ShieldCheck,
  FileKey,
  Settings,
  History,
  Server,
  ChevronLeft,
  ChevronRight,
<<<<<<< HEAD
  ChevronDown,
  LogOut,
  User,
  Globe,
  Network,
  Shield,
  Activity,
  Lock,
  UserPlus,
  Router,
  Database,
  Key,
  Wifi,
  ArrowDownWideNarrow,
  Flame,
  Sparkles,
  CircleDot,
  BarChart3,
=======
  LogOut,
  User,
  Globe,
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuth } from '@/hooks/use-auth'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
<<<<<<< HEAD
import { useState, useCallback, useMemo, useEffect } from 'react'
import { useHydrated } from '@/hooks/use-local-storage'
=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

<<<<<<< HEAD
interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  description?: string
}

interface NavGroup {
  name: string
  icon: React.ComponentType<{ className?: string }>
  items: NavItem[]
}

const navigationGroups: NavGroup[] = [
  {
    name: 'Dashboard',
    icon: LayoutDashboard,
    items: [
      { name: 'Overview', href: '/', icon: LayoutDashboard, description: 'System overview and statistics' },
    ],
  },
  {
    name: 'Users',
    icon: Users,
    items: [
      { name: 'VPN Users', href: '/users', icon: Users, description: 'Manage VPN user accounts' },
      { name: 'Admin Users', href: '/admin-users', icon: Shield, description: 'Administrator accounts' },
      { name: 'Guest Users', href: '/guest-users', icon: UserPlus, description: 'Temporary access users' },
    ],
  },
  {
    name: 'Certificates',
    icon: FileKey,
    items: [
      { name: 'Client Certificates', href: '/certificates', icon: FileKey, description: 'Client certificate management' },
      { name: 'Server Certificates', href: '/server-certificates', icon: Server, description: 'VPN server certificates' },
      { name: 'CA Management', href: '/ca-management', icon: KeyRound, description: 'CA certificate list and management' },
    ],
  },
  {
    name: 'PKI',
    icon: KeyRound,
    items: [
      { name: 'CA Configuration', href: '/pki', icon: KeyRound, description: 'CA setup and management' },
      { name: 'CRL Management', href: '/revocation', icon: ShieldCheck, description: 'CRL and revocation' },
      { name: 'OCSP Settings', href: '/ocsp-settings', icon: CircleDot, description: 'OCSP responder configuration' },
    ],
  },
  {
    name: 'VPN',
    icon: Globe,
    items: [
      { name: 'Connection Profiles', href: '/vpn-config', icon: Settings, description: 'VPN configuration' },
      { name: 'IP Pools', href: '/ip-pools', icon: Database, description: 'IP address pools' },
      { name: 'Active Sessions', href: '/vpn-sessions', icon: Activity, description: 'Current connections' },
      { name: 'VPN Status', href: '/vpn', icon: Globe, description: 'strongSwan status' },
    ],
  },
  {
    name: 'Network',
    icon: Network,
    items: [
      { name: 'Interfaces', href: '/interfaces', icon: Wifi, description: 'Network interfaces' },
      { name: 'Routing', href: '/routes', icon: Router, description: 'Static routes' },
      { name: 'Diagnostics', href: '/diagnostics', icon: Activity, description: 'Network tools' },
    ],
  },
  {
    name: 'Security',
    icon: Shield,
    items: [
      { name: 'Firewall Rules', href: '/firewall', icon: Flame, description: 'Packet filtering' },
      { name: 'NAT Policies', href: '/nat', icon: ArrowDownWideNarrow, description: 'Network translation' },
      { name: 'Access Control', href: '/access-policies', icon: Lock, description: 'Access control rules' },
      { name: 'Geo/IP Restrictions', href: '/geo-restrictions', icon: Globe, description: 'Geographic access' },
    ],
  },
  {
    name: 'Audit',
    icon: History,
    items: [
      { name: 'Audit Logs', href: '/audit', icon: History, description: 'Activity logs' },
      { name: 'Session Reports', href: '/reports', icon: BarChart3, description: 'VPN session analytics' },
    ],
  },
  {
    name: 'Settings',
    icon: Settings,
    items: [
      { name: 'System Settings', href: '/settings', icon: Settings, description: 'System configuration' },
      { name: 'API Keys', href: '/api-keys', icon: Key, description: 'API management' },
      { name: 'Backup', href: '/backup', icon: Database, description: 'Backup and restore' },
    ],
  },
]

// LocalStorage key for persisting sidebar state
const SIDEBAR_STATE_KEY = 'vpn-pki-sidebar-state'

=======
const navigation = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    description: 'Overview and statistics',
  },
  {
    name: 'VPN Users',
    href: '/users',
    icon: Users,
    description: 'Manage VPN user accounts',
  },
  {
    name: 'Certificates',
    href: '/certificates',
    icon: FileKey,
    description: 'Certificate lifecycle management',
  },
  {
    name: 'Server Certificates',
    href: '/server-certificates',
    icon: Server,
    description: 'VPN server certificate management',
  },
  {
    name: 'PKI Management',
    href: '/pki',
    icon: KeyRound,
    description: 'CA and PKI configuration',
  },
  {
    name: 'Revocation',
    href: '/revocation',
    icon: ShieldCheck,
    description: 'Certificate revocation & CRL',
  },
  {
    name: 'VPN Integration',
    href: '/vpn',
    icon: Globe,
    description: 'strongSwan configuration',
  },
  {
    name: 'Audit Logs',
    href: '/audit',
    icon: History,
    description: 'System activity logs',
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'System configuration',
  },
]

>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
export function AppSidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()

<<<<<<< HEAD
  // Track hydration state
  const hydrated = useHydrated()
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])
  const [initialized, setInitialized] = useState(false)

  // Compute active group for highlighting
  const activeGroup = useMemo(() => {
    return navigationGroups.find(g => g.items.some(item => pathname === item.href))
  }, [pathname])

  // Initialize expanded groups from localStorage ONCE on first hydration
  // This is a valid pattern for hydrating state from localStorage after SSR
  useEffect(() => {
    if (hydrated && !initialized) {
      try {
        const savedState = localStorage.getItem(SIDEBAR_STATE_KEY)
        if (savedState) {
          const parsed = JSON.parse(savedState)
          // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrating from localStorage
          setExpandedGroups(parsed.expandedGroups || [])
        } else if (activeGroup) {
          // Only auto-expand active group if no saved state exists
          setExpandedGroups([activeGroup.name])
        }
      } catch {
        // Ignore errors - start with empty
        if (activeGroup) {
          setExpandedGroups([activeGroup.name])
        }
      }
      setInitialized(true)
    }
  }, [hydrated, initialized, activeGroup])

  // Ensure active group is always expanded when navigating to a new page
  // This is a valid pattern for syncing sidebar state with current route
  useEffect(() => {
    if (initialized && activeGroup && !expandedGroups.includes(activeGroup.name)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Valid pattern for syncing with route
      setExpandedGroups(prev => [...prev, activeGroup.name])
    }
  }, [initialized, activeGroup, expandedGroups])

  // Save to localStorage when expandedGroups changes (after initialization)
  useEffect(() => {
    if (hydrated && initialized) {
      localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify({
        expandedGroups,
      }))
    }
  }, [expandedGroups, hydrated, initialized])

  const toggleGroup = useCallback((groupName: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupName)
        ? prev.filter(g => g !== groupName)
        : [...prev, groupName]
    )
  }, [])

  const isGroupActive = useCallback((group: NavGroup) => {
    return group.items.some(item => pathname === item.href)
  }, [pathname])

  // Use expandedGroups directly (user has full control, but active group is auto-added)
  const effectiveExpandedGroups = expandedGroups

=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
<<<<<<< HEAD
          'flex h-full flex-col border-r border-border/50 bg-gradient-to-b from-card to-card/95 backdrop-blur-sm transition-all duration-300 ease-in-out',
=======
          'flex h-full flex-col border-r bg-card transition-all duration-300',
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Header */}
<<<<<<< HEAD
        <div className="flex h-14 items-center justify-between border-b border-border/50 px-3 bg-gradient-to-r from-primary/5 to-transparent">
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25">
                <Globe className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm leading-tight tracking-tight">24online</span>
                <span className="text-[10px] text-muted-foreground leading-tight">VPN Server</span>
=======
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Globe className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm leading-tight">24online</span>
                <span className="text-xs text-muted-foreground leading-tight">VPN Server</span>
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
              </div>
            </div>
          )}
          {collapsed && (
<<<<<<< HEAD
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 mx-auto">
=======
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground mx-auto">
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
              <Globe className="h-5 w-5" />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
<<<<<<< HEAD
            className={cn(
              'h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors',
              collapsed && 'mx-auto mt-1'
            )}
=======
            className={cn('h-8 w-8', collapsed && 'mx-auto mt-2')}
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

<<<<<<< HEAD
        {/* Navigation - Scrollable */}
        <ScrollArea className="flex-1 min-h-0">
          <nav className="space-y-0.5 p-2">
            {navigationGroups.map((group) => {
              const GroupIcon = group.icon
              const isExpanded = effectiveExpandedGroups.includes(group.name)
              const isActive = isGroupActive(group)

              if (collapsed) {
                return (
                  <Tooltip key={group.name}>
                    <TooltipTrigger asChild>
                      <div className="flex justify-center py-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'h-10 w-10 rounded-xl transition-all duration-200',
                            isActive 
                              ? 'bg-primary/15 text-primary shadow-sm' 
                              : 'hover:bg-muted/80 text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <GroupIcon className="h-5 w-5" />
                        </Button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="ml-2">
                      <div className="px-1">
                        <p className="font-semibold text-sm">{group.name}</p>
                        <div className="mt-1.5 space-y-0.5">
                          {group.items.map(item => (
                            <p key={item.href} className="text-xs text-muted-foreground">
                              • {item.name}
                            </p>
                          ))}
                        </div>
                      </div>
=======
        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className="space-y-1 px-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              
              const linkContent = (
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    collapsed && 'justify-center px-2'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              )

              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
                    </TooltipContent>
                  </Tooltip>
                )
              }

<<<<<<< HEAD
              return (
                <div 
                  key={group.name} 
                  className="space-y-0.5"
                >
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(group.name)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-gradient-to-r from-primary/15 via-primary/10 to-transparent text-primary'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                        isActive 
                          ? 'bg-primary/20 text-primary' 
                          : 'bg-muted/50 text-muted-foreground group-hover:bg-muted'
                      )}>
                        <GroupIcon className="h-4 w-4" />
                      </div>
                      <span className="tracking-wide">{group.name}</span>
                    </div>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 transition-transform duration-200 ease-out',
                        isExpanded && 'rotate-180'
                      )}
                    />
                  </button>

                  {/* Group Items with Animation */}
                  <div
                    className={cn(
                      'overflow-hidden transition-all duration-200 ease-out',
                      isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    )}
                  >
                    <div className="ml-4 border-l-2 border-border/50 pl-2 py-1 space-y-0.5">
                      {group.items.map((item) => {
                        const ItemIcon = item.icon
                        const isItemActive = pathname === item.href

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-200',
                              isItemActive
                                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:translate-x-0.5'
                            )}
                          >
                            <ItemIcon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{item.name}</span>
                            {isItemActive && (
                              <Sparkles className="h-3 w-3 ml-auto shrink-0 opacity-70" />
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
=======
              return <div key={item.href}>{linkContent}</div>
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
            })}
          </nav>
        </ScrollArea>

        {/* User Section */}
<<<<<<< HEAD
        <div className="border-t border-border/50 p-3 bg-gradient-to-r from-transparent to-primary/5">
=======
        <div className="border-t p-4">
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center">
<<<<<<< HEAD
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 text-primary"
                  >
                    <User className="h-5 w-5" />
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="ml-2">
                <div className="px-1">
                  <p className="font-semibold">{user?.username}</p>
                  <p className="text-xs text-muted-foreground">{user?.role}</p>
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <LogOut className="h-3 w-3" /> Click to logout
                    </p>
                  </div>
                </div>
=======
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="h-5 w-5" />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-medium">{user?.username}</p>
                <p className="text-xs text-muted-foreground">{user?.role}</p>
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center justify-between">
<<<<<<< HEAD
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                  <User className="h-4 w-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">{user?.username}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{user?.role}</span>
=======
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{user?.username}</span>
                  <span className="text-xs text-muted-foreground">{user?.role}</span>
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
                </div>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={logout}
<<<<<<< HEAD
                    className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
=======
                    className="h-8 w-8"
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Logout</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
