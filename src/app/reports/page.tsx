'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  FileText,
  Download,
  Search,
  Calendar,
  Users,
  Clock,
  ArrowDownToLine,
  ArrowUpFromLine,
  Activity,
  Loader2,
  BarChart3,
  FileSpreadsheet,
  FileDown,
} from 'lucide-react'
import { toast } from 'sonner'

interface Session {
  id: string
  sessionId: string
  username: string
  clientPublicIp: string
  clientVirtualIp: string | null
  serverIp: string
  connectedAt: string
  disconnectedAt: string | null
  duration: number | null
  bytesIn: number
  bytesOut: number
  status: string
  deviceType: string | null
  deviceOs: string | null
  clientCountry: string | null
  clientCity: string | null
  disconnectReason: string | null
}

interface SessionStats {
  totalSessions: number
  uniqueUsers: number
  totalDuration: number
  totalBytesIn: number
  totalBytesOut: number
  avgDuration: number
  avgBytesPerSession: number
  byStatus: Record<string, number>
  byDevice: Record<string, number>
  byCountry: Record<string, number>
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString()
}

export default function ReportsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [stats, setStats] = useState<SessionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  
  // Filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [username, setUsername] = useState('')
  const [ipAddress, setIpAddress] = useState('')
  const [status, setStatus] = useState('all')
  const [country, setCountry] = useState('')
  
  // Available filter options
  const [countries, setCountries] = useState<string[]>([])
  const [usernames, setUsernames] = useState<string[]>([])

  const fetchSessions = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (username) params.append('username', username)
      if (ipAddress) params.append('clientIp', ipAddress)
      if (status !== 'all') params.append('status', status)
      if (country) params.append('country', country)
      params.append('limit', '100')

      const response = await fetch(`/api/reports/sessions?${params}`)
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions || [])
        setStats(data.stats || null)
        
        // Extract unique values for filters
        if (data.sessions) {
          const uniqueCountries = [...new Set(data.sessions.map((s: Session) => s.clientCountry).filter(Boolean))]
          const uniqueUsernames = [...new Set(data.sessions.map((s: Session) => s.username))]
          setCountries(uniqueCountries as string[])
          setUsernames(uniqueUsernames as string[])
        }
      }
    } catch (error) {
      console.error('Error fetching sessions:', error)
      toast.error('Failed to load session data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  const handleFilter = () => {
    fetchSessions()
  }

  const handleClearFilters = () => {
    setStartDate('')
    setEndDate('')
    setUsername('')
    setIpAddress('')
    setStatus('all')
    setCountry('')
    setTimeout(fetchSessions, 100)
  }

  const exportCSV = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (username) params.append('username', username)
      if (ipAddress) params.append('clientIp', ipAddress)
      if (status !== 'all') params.append('status', status)
      if (country) params.append('country', country)
      params.append('format', 'csv')

      const response = await fetch(`/api/reports/sessions?${params}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `vpn-sessions-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('CSV exported successfully')
      } else {
        toast.error('Failed to export CSV')
      }
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export')
    } finally {
      setExporting(false)
    }
  }

  const exportPDF = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (username) params.append('username', username)
      if (ipAddress) params.append('clientIp', ipAddress)
      if (status !== 'all') params.append('status', status)
      if (country) params.append('country', country)
      params.append('format', 'pdf')

      const response = await fetch(`/api/reports/sessions?${params}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `vpn-report-${new Date().toISOString().split('T')[0]}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('PDF exported successfully')
      } else {
        toast.error('Failed to export PDF')
      }
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export')
    } finally {
      setExporting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
      ACTIVE: 'default',
      DISCONNECTED: 'secondary',
      TIMEOUT: 'outline',
      FAILED: 'destructive',
      BLOCKED: 'destructive',
    }
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Session Reports</h1>
          <p className="text-muted-foreground">
            VPN session history, analytics, and export
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={exporting || sessions.length === 0}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
            Export CSV
          </Button>
          <Button onClick={exportPDF} disabled={exporting || sessions.length === 0}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            Export PDF
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold">{stats.totalSessions}</div>
                  <p className="text-xs text-muted-foreground">Total Sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">{stats.uniqueUsers}</div>
                  <p className="text-xs text-muted-foreground">Unique Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-500" />
                <div>
                  <div className="text-2xl font-bold">{formatDuration(stats.avgDuration)}</div>
                  <p className="text-xs text-muted-foreground">Avg Duration</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <ArrowDownToLine className="h-5 w-5 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">{formatBytes(stats.totalBytesIn)}</div>
                  <p className="text-xs text-muted-foreground">Total Download</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <ArrowUpFromLine className="h-5 w-5 text-orange-500" />
                <div>
                  <div className="text-2xl font-bold">{formatBytes(stats.totalBytesOut)}</div>
                  <p className="text-xs text-muted-foreground">Total Upload</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
          <CardDescription>Filter session history by date, user, IP, and more</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>IP Address</Label>
              <Input
                placeholder="Enter IP"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="DISCONNECTED">Disconnected</SelectItem>
                  <SelectItem value="TIMEOUT">Timeout</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                  <SelectItem value="BLOCKED">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="All countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Countries</SelectItem>
                  {countries.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleFilter}>
              <Search className="mr-2 h-4 w-4" />
              Apply Filters
            </Button>
            <Button variant="outline" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Session History Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Session History</CardTitle>
              <CardDescription>
                {sessions.length} sessions found
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchSessions}>
              <Activity className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No session data found</p>
              <p className="text-sm">Sessions will appear here when users connect to the VPN</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Client IP</TableHead>
                    <TableHead>VPN IP</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Traffic</TableHead>
                    <TableHead>Connected</TableHead>
                    <TableHead>Disconnected</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>{getStatusBadge(session.status)}</TableCell>
                      <TableCell className="font-medium">{session.username}</TableCell>
                      <TableCell>
                        <code className="text-sm">{session.clientPublicIp}</code>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm">{session.clientVirtualIp || '-'}</code>
                      </TableCell>
                      <TableCell>
                        {session.clientCountry ? (
                          <span>{session.clientCity ? `${session.clientCity}, ` : ''}{session.clientCountry}</span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {session.deviceOs || session.deviceType || '-'}
                      </TableCell>
                      <TableCell>{formatDuration(session.duration)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="text-green-600">↓{formatBytes(session.bytesIn)}</span>
                          {' / '}
                          <span className="text-orange-600">↑{formatBytes(session.bytesOut)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(session.connectedAt)}</TableCell>
                      <TableCell className="text-sm">
                        {session.disconnectedAt ? formatDate(session.disconnectedAt) : '-'}
                        {session.disconnectReason && (
                          <div className="text-xs text-muted-foreground">{session.disconnectReason}</div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analytics */}
      {stats && (Object.keys(stats.byDevice).length > 0 || Object.keys(stats.byCountry).length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* By Device */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sessions by Device</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.byDevice).map(([device, count]) => (
                  <div key={device} className="flex items-center justify-between">
                    <span className="text-sm">{device || 'Unknown'}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500" 
                          style={{ width: `${(count / stats.totalSessions) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* By Country */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sessions by Country</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.byCountry).map(([country, count]) => (
                  <div key={country} className="flex items-center justify-between">
                    <span className="text-sm">{country || 'Unknown'}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500" 
                          style={{ width: `${(count / stats.totalSessions) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
