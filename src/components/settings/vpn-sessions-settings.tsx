'use client'

import { useState, useEffect } from 'react'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Activity, Loader2, Users, Wifi, WifiOff, Clock, ArrowDownToLine, ArrowUpFromLine, Search, Globe, Monitor,
} from 'lucide-react'
import { toast } from 'sonner'

interface VpnSession {
  id: string
  sessionId: string
  username: string
  clientPublicIp: string
  clientVirtualIp: string | null
  connectedAt: string
  disconnectedAt: string | null
  duration: number | null
  bytesIn: number
  bytesOut: number
  status: 'ACTIVE' | 'DISCONNECTED' | 'TIMEOUT' | 'FAILED' | 'BLOCKED'
  deviceType: string | null
  deviceOs: string | null
  clientCountry: string | null
  mfaUsed: boolean
}

interface SessionStats {
  activeSessions: number
  totalToday: number
  totalBytesIn: number
  totalBytesOut: number
  avgDuration: number
}

export function VpnSessionsSettings() {
  const [sessions, setSessions] = useState<VpnSession[]>([])
  const [activeSessions, setActiveSessions] = useState<VpnSession[]>([])
  const [stats, setStats] = useState<SessionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchSessions()
    const interval = setInterval(fetchSessions, 30000)
    return () => clearInterval(interval)
  }, [filter])

  const fetchSessions = async () => {
    setLoading(true)
    try {
      const [sessionsRes, activeRes, statsRes] = await Promise.all([
        fetch(`/api/vpn-sessions?status=${filter}`),
        fetch('/api/vpn-sessions/active'),
        fetch('/api/vpn-sessions/stats?period=today'),
      ])

      if (sessionsRes.ok) {
        const data = await sessionsRes.json()
        setSessions(data.sessions || [])
      }
      if (activeRes.ok) {
        const data = await activeRes.json()
        setActiveSessions(data.sessions || [])
      }
      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data.stats || null)
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async (sessionId: string) => {
    if (!confirm('Disconnect this session?')) return
    try {
      const response = await fetch(`/api/vpn-sessions/${sessionId}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Admin disconnect' }),
      })
      if (response.ok) {
        toast.success('Session disconnected')
        fetchSessions()
      }
    } catch (error) {
      toast.error('Failed to disconnect session')
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE': return <Wifi className="h-4 w-4 text-green-500" />
      case 'DISCONNECTED': return <WifiOff className="h-4 w-4 text-gray-400" />
      case 'BLOCKED': return <WifiOff className="h-4 w-4 text-red-500" />
      default: return <WifiOff className="h-4 w-4 text-gray-400" />
    }
  }

  const filteredSessions = sessions.filter(s =>
    s.username.toLowerCase().includes(search.toLowerCase()) ||
    s.clientPublicIp.includes(search)
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold text-green-500">{stats?.activeSessions || activeSessions.length}</div>
                <p className="text-xs text-muted-foreground">Active Now</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{stats?.totalToday || 0}</div>
                <p className="text-xs text-muted-foreground">Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">{formatBytes(stats?.totalBytesIn || 0)}</div>
                <p className="text-xs text-muted-foreground">Download</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ArrowUpFromLine className="h-5 w-5 text-orange-500" />
              <div>
                <div className="text-2xl font-bold">{formatBytes(stats?.totalBytesOut || 0)}</div>
                <p className="text-xs text-muted-foreground">Upload</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <div>
                <div className="text-2xl font-bold">{formatDuration(stats?.avgDuration || 0)}</div>
                <p className="text-xs text-muted-foreground">Avg Duration</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {activeSessions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Active Sessions</CardTitle>
                <CardDescription>Currently connected VPN users</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchSessions}>
                <Activity className="mr-2 h-4 w-4" />Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {activeSessions.slice(0, 6).map((session) => (
                <div key={session.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                    <Wifi className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{session.username}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>{session.clientPublicIp}</span>
                      {session.clientCountry && (
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />{session.clientCountry}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Duration</div>
                    <div className="text-sm font-medium">
                      {formatDuration(Math.floor((Date.now() - new Date(session.connectedAt).getTime()) / 1000))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {activeSessions.length > 6 && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                And {activeSessions.length - 6} more active sessions...
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Session History</CardTitle>
              <CardDescription>All VPN connection sessions</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-[200px]" />
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="DISCONNECTED">Disconnected</SelectItem>
                  <SelectItem value="BLOCKED">Blocked</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Client IP</TableHead>
                    <TableHead>VPN IP</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Traffic</TableHead>
                    <TableHead>Connected</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No sessions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSessions.slice(0, 50).map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>{getStatusIcon(session.status)}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{session.username}</div>
                            {session.mfaUsed && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded">MFA</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <code className="text-sm">{session.clientPublicIp}</code>
                            {session.clientCountry && (
                              <div className="text-xs text-muted-foreground">{session.clientCountry}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell><code className="text-sm">{session.clientVirtualIp || '-'}</code></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Monitor className="h-3 w-3" />
                            <span className="text-sm">{session.deviceType || session.deviceOs || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {session.status === 'ACTIVE'
                            ? formatDuration(Math.floor((Date.now() - new Date(session.connectedAt).getTime()) / 1000))
                            : formatDuration(session.duration)
                          }
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="text-purple-500">↓{formatBytes(session.bytesIn)}</span>
                            {' / '}
                            <span className="text-orange-500">↑{formatBytes(session.bytesOut)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{new Date(session.connectedAt).toLocaleString()}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          {session.status === 'ACTIVE' && (
                            <Button variant="destructive" size="sm" onClick={() => handleDisconnect(session.sessionId)}>
                              Disconnect
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
