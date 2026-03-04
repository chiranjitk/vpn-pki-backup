'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Users,
  FileKey,
  ShieldCheck,
  AlertTriangle,
  Server,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Plus,
  TrendingUp,
  TrendingDown,
  Globe,
  Zap,
  Wifi,
  WifiOff,
  Database,
  Cpu,
  HardDrive,
  ArrowUpRight,
  ArrowDownRight,
  MemoryStick,
} from 'lucide-react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// Types
interface DashboardStats {
  totalUsers: number
  activeUsers: number
  totalCertificates: number
  activeCertificates: number
  expiredCertificates: number
  revokedCertificates: number
  expiringSoon: number
}

interface VpnStatus {
  status: string
  uptime?: number
  activeConnections: number
  version: string
}

interface CrlInfo {
  lastUpdate: string | null
  nextUpdate: string | null
  revokedCount: number
}

interface SystemHealth {
  cpu: { usage: number; cores: number; loadAverage: { '1min': string; '5min': string; '15min': string } }
  memory: { total: number; used: number; free: number; percent: number }
  disk: { total: number; used: number; available: number; percent: number }
  uptime: { seconds: number; formatted: string }
}

interface TrafficDataPoint {
  time: string
  bytesIn: number
  bytesOut: number
}

interface CertTrendData {
  month: string
  issued: number
  expired: number
  revoked: number
}

interface GeoDataPoint {
  country: string
  countryCode: string
  flag: string
  connections: number
}

// Animated Counter Component
function AnimatedCounter({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let startTime: number
    let animationFrame: number

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      setCount(Math.floor(progress * value))
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [value, duration])

  return <span>{count.toLocaleString()}</span>
}

// Live Indicator Component
function LiveIndicator({ isLive }: { isLive: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn(
        "w-2 h-2 rounded-full animate-pulse",
        isLive ? "bg-green-500" : "bg-red-500"
      )} />
      <span className={cn(
        "text-xs font-medium",
        isLive ? "text-green-600" : "text-red-600"
      )}>
        {isLive ? 'LIVE' : 'OFFLINE'}
      </span>
    </div>
  )
}

// Colors for charts
const PIE_COLORS = ['#22c55e', '#eab308', '#ef4444', '#6b7280']

// Country colors for geographic chart
const COUNTRY_COLORS: { [key: string]: string } = {
  US: '#3b82f6', // Blue
  GB: '#8b5cf6', // Purple
  DE: '#f59e0b', // Amber
  FR: '#ec4899', // Pink
  JP: '#ef4444', // Red
  CN: '#dc2626', // Dark Red
  RU: '#06b6d4', // Cyan
  BR: '#22c55e', // Green
  IN: '#f97316', // Orange
  AU: '#14b8a6', // Teal
  CA: '#6366f1', // Indigo
  KR: '#a855f7', // Violet
  IT: '#10b981', // Emerald
  ES: '#f43f5e', // Rose
  MX: '#84cc16', // Lime
  NL: '#0ea5e9', // Sky
  SG: '#d946ef', // Fuchsia
  HK: '#e11d48', // Rose
  TW: '#059669', // Emerald
  PL: '#7c3aed', // Violet
  LOCAL: '#6b7280', // Gray
  XX: '#6b7280', // Gray
}

// Fallback colors for countries not in the map
const FALLBACK_COLORS = [
  '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#ef4444',
  '#22c55e', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
]

function getCountryColor(countryCode: string, index: number): string {
  return COUNTRY_COLORS[countryCode] || FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}

function formatUptime(seconds: number): string {
  if (!seconds) return 'N/A'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${days}d ${hours}h ${mins}m`
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatBandwidth(bytesPerSec: number): string {
  if (bytesPerSec === 0) return '0 B/s'
  const k = 1024
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s']
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(k))
  return parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) return `${diffDays}d ago`
  if (diffHours > 0) return `${diffHours}h ago`
  if (diffMins > 0) return `${diffMins}m ago`
  return 'Just now'
}

export function DashboardContent() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  
  // Dashboard data states
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [vpnStatus, setVpnStatus] = useState<VpnStatus | null>(null)
  const [crlInfo, setCrlInfo] = useState<CrlInfo | null>(null)
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  
  // Real data states
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [trafficHistory, setTrafficHistory] = useState<TrafficDataPoint[]>([])
  const [certTrends, setCertTrends] = useState<CertTrendData[]>([])
  const [geoData, setGeoData] = useState<GeoDataPoint[]>([])

  // Fetch all data
  const fetchAllData = async () => {
    setIsLoading(true)
    try {
      // Fetch dashboard stats
      const dashRes = await fetch('/api/dashboard')
      if (dashRes.ok) {
        const dashData = await dashRes.json()
        setStats(dashData.stats)
        setVpnStatus(dashData.vpn)
        setCrlInfo(dashData.crl)
        setRecentActivity(dashData.recentActivity || [])
      }
      
      // Fetch system health
      const healthRes = await fetch('/api/system/health')
      if (healthRes.ok) {
        const healthData = await healthRes.json()
        setSystemHealth(healthData)
      }
      
      // Fetch certificate trends
      const trendsRes = await fetch('/api/metrics/cert-trends')
      if (trendsRes.ok) {
        const trendsData = await trendsRes.json()
        setCertTrends(trendsData.monthly || [])
      }
      
      // Fetch VPN traffic
      const trafficRes = await fetch('/api/metrics/vpn-traffic')
      if (trafficRes.ok) {
        const trafficData = await trafficRes.json()
        setTrafficHistory(trafficData.traffic || [])
      }
      
      // Fetch GeoIP data
      const geoRes = await fetch('/api/metrics/geoip')
      if (geoRes.ok) {
        const geoDataRes = await geoRes.json()
        setGeoData(geoDataRes.countries || [])
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch live traffic updates
  const fetchTrafficUpdate = useCallback(async () => {
    try {
      const res = await fetch('/api/metrics/vpn-traffic')
      if (res.ok) {
        const data = await res.json()
        if (data.traffic && data.traffic.length > 0) {
          setTrafficHistory(data.traffic.slice(-20))
        }
      }
    } catch {
      // Ignore errors during live updates
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchAllData()
  }, [])

  // Live traffic refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchTrafficUpdate, 5000)
    return () => clearInterval(interval)
  }, [fetchTrafficUpdate])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/system/health').then(res => res.json()).then(setSystemHealth).catch(() => {})
      fetch('/api/metrics/geoip').then(res => res.json()).then(d => setGeoData(d.countries || [])).catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-12 w-12 text-yellow-500" />
        <p className="text-muted-foreground">Failed to load dashboard data</p>
        <Button onClick={fetchAllData}>Retry</Button>
      </div>
    )
  }

  // Certificate status data for pie chart
  const certStatusData = [
    { name: 'Active', value: stats.activeCertificates, color: '#22c55e' },
    { name: 'Expiring', value: stats.expiringSoon, color: '#eab308' },
    { name: 'Expired', value: stats.expiredCertificates, color: '#ef4444' },
    { name: 'Revoked', value: stats.revokedCertificates, color: '#6b7280' },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            VPN PKI Management Platform Overview
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LiveIndicator isLive={vpnStatus?.status === 'RUNNING'} />
          <Button variant="outline" size="sm" onClick={fetchAllData} disabled={isLoading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => router.push('/certificates')}>
            <Plus className="mr-2 h-4 w-4" />
            New Certificate
          </Button>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            <div className="p-2 bg-green-500/10 rounded-full">
              <Wifi className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">
              <AnimatedCounter value={vpnStatus?.activeConnections || 0} />
            </div>
            <div className="flex items-center gap-1 mt-1">
              {vpnStatus?.status === 'RUNNING' ? (
                <>
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-green-600">VPN Active</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-red-500" />
                  <span className="text-xs text-red-600">VPN Offline</span>
                </>
              )}
            </div>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500/50 to-green-500" />
        </Card>

        <Card className="relative overflow-hidden border-l-4 border-l-blue-500 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/users')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-full">
              <Users className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              <AnimatedCounter value={stats.totalUsers} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.activeUsers} active
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-l-4 border-l-purple-500 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/certificates')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Certificates</CardTitle>
            <div className="p-2 bg-purple-500/10 rounded-full">
              <FileKey className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              <AnimatedCounter value={stats.totalCertificates} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.activeCertificates} active
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-l-4 border-l-amber-500 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/certificates')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <div className="p-2 bg-amber-500/10 rounded-full">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              <AnimatedCounter value={stats.expiringSoon} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              within 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Traffic & Certificate Status */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Live Traffic Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Server Network Traffic
                </CardTitle>
                <CardDescription>Real-time network interface bandwidth</CardDescription>
              </div>
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2" />
                Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {trafficHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trafficHistory}>
                    <defs>
                      <linearGradient id="colorBytesIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorBytesOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis tickFormatter={(value) => formatBandwidth(value)} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip 
                      formatter={(value: number) => [formatBandwidth(value), '']}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    />
                    <Area type="monotone" dataKey="bytesIn" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#colorBytesIn)" name="Download" />
                    <Area type="monotone" dataKey="bytesOut" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorBytesOut)" name="Upload" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <Activity className="h-8 w-8 mr-2" /> Waiting for traffic data...
                </div>
              )}
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm text-muted-foreground">Download</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm text-muted-foreground">Upload</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Certificate Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Certificate Status
            </CardTitle>
            <CardDescription>Distribution by status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={certStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                    {certStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {certStatusData.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-muted-foreground">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Certificate Trend & Geographic Distribution */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Certificate Issuance Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Certificate Trends
            </CardTitle>
            <CardDescription>Issuance and expiration over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={certTrends.length > 0 ? certTrends : [
                  { month: 'Jan', issued: 12, expired: 2, revoked: 1 },
                  { month: 'Feb', issued: 15, expired: 3, revoked: 0 },
                  { month: 'Mar', issued: 8, expired: 4, revoked: 2 },
                  { month: 'Apr', issued: 22, expired: 1, revoked: 1 },
                  { month: 'May', issued: 18, expired: 2, revoked: 0 },
                  { month: 'Jun', issued: 25, expired: 3, revoked: 2 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="issued" fill="#22c55e" radius={[4, 4, 0, 0]} name="Issued" />
                  <Bar dataKey="expired" fill="#eab308" radius={[4, 4, 0, 0]} name="Expired" />
                  <Bar dataKey="revoked" fill="#ef4444" radius={[4, 4, 0, 0]} name="Revoked" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Geographic Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Connection Origins
            </CardTitle>
            <CardDescription>Active connections by country</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {geoData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={geoData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis 
                      dataKey="country" 
                      type="category" 
                      tick={{ fontSize: 11 }} 
                      tickLine={false} 
                      axisLine={false} 
                      width={120}
                      tickFormatter={(_value, index) => {
                        const item = geoData[index]
                        return item ? `${item.flag} ${item.country}` : ''
                      }}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                      formatter={(value: number, _name, props) => [`${value} connections`, props.payload?.country]}
                    />
                    <Bar dataKey="connections" radius={[0, 4, 4, 0]}>
                      {geoData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getCountryColor(entry.countryCode, index)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <Globe className="h-8 w-8 mr-2" /> No geographic data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health & VPN Status */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* VPN Service Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              VPN Service
            </CardTitle>
            <CardDescription>strongSwan 6.0.1 IKEv2</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={vpnStatus?.status === 'RUNNING' ? 'default' : 'destructive'} className="font-mono">
                {vpnStatus?.status === 'RUNNING' ? (
                  <><CheckCircle2 className="h-3 w-3 mr-1" /> RUNNING</>
                ) : (
                  <><XCircle className="h-3 w-3 mr-1" /> {vpnStatus?.status}</>
                )}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Uptime</span>
              <span className="font-mono text-sm">{formatUptime(vpnStatus?.uptime || 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">CRL Revoked</span>
              <span className="font-mono text-sm">{crlInfo?.revokedCount || 0}</span>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                fetch('/api/vpn', { method: 'POST', body: JSON.stringify({ action: 'reload' }) }).then(() => toast.success('VPN reload initiated'))
              }}>
                <RefreshCw className="mr-2 h-3 w-3" />
                Reload
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => router.push('/audit')}>
                <Activity className="mr-2 h-3 w-3" />
                Logs
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              System Health
            </CardTitle>
            <CardDescription>Resource utilization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  CPU
                </span>
                <span className="text-sm font-mono">{systemHealth?.cpu.usage || 0}%</span>
              </div>
              <Progress value={systemHealth?.cpu.usage || 0} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <MemoryStick className="h-4 w-4 text-muted-foreground" />
                  Memory
                </span>
                <span className="text-sm font-mono">{systemHealth?.memory.percent || 0}%</span>
              </div>
              <Progress value={systemHealth?.memory.percent || 0} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  Disk
                </span>
                <span className="text-sm font-mono">{systemHealth?.disk.percent || 0}%</span>
              </div>
              <Progress value={systemHealth?.disk.percent || 0} className="h-2" />
            </div>
            <div className="pt-2 text-xs text-muted-foreground">
              System Uptime: {systemHealth?.uptime.formatted || 'N/A'}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Quick Actions
            </CardTitle>
            <CardDescription>Common operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" onClick={() => router.push('/users')}>
              <Users className="mr-2 h-4 w-4" />
              Manage Users
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => router.push('/certificates')}>
              <FileKey className="mr-2 h-4 w-4" />
              View Certificates
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => router.push('/pki')}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              PKI Management
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => router.push('/settings')}>
              <Server className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest system events and operations</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push('/audit')}>
              View All
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.slice(0, 5).map((activity, index) => (
                <div
                  key={activity.id || index}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      activity.status === 'success' ? "bg-green-500" :
                      activity.status === 'failure' ? "bg-red-500" : "bg-yellow-500"
                    )} />
                    <div>
                      <p className="text-sm font-medium">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">by {activity.user}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(activity.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
