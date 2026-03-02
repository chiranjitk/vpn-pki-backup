'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Server,
  RefreshCw,
  Play,
  CheckCircle2,
  XCircle,
  Activity,
  Settings,
} from 'lucide-react'
import { toast } from 'sonner'

interface VpnStatus {
  running: boolean
  uptime?: number
  activeConnections: number
  version: string
  lastError?: string
}

interface Connection {
  name: string
  localId: string
  remoteId: string
  localAddr: string
  remoteAddr: string
  state: string
  established: number
}

function formatUptime(seconds: number): string {
  if (!seconds) return 'N/A'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${days}d ${hours}h ${mins}m`
}

export function VPNContent() {
  const [status, setStatus] = useState<VpnStatus | null>(null)
  const [connections, setConnections] = useState<Connection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchData = async () => {
    try {
      const response = await fetch('/api/vpn')
      if (!response.ok) throw new Error('Failed to fetch VPN status')
      const data = await response.json()
      setStatus(data.status)
      setConnections(data.connections)
    } catch (error) {
      console.error('Error fetching VPN status:', error)
      toast.error('Failed to load VPN status')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const handleReload = async () => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/vpn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reload' }),
      })
      const result = await response.json()
      if (result.success) {
        toast.success('VPN configuration reloaded successfully')
      } else {
        toast.error(result.message || 'Failed to reload')
      }
    } catch (error) {
      toast.error('Failed to reload VPN')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRestart = async () => {
    if (!confirm('Are you sure you want to restart the VPN service? This will disconnect all users.')) return

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/vpn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart' }),
      })
      const result = await response.json()
      if (result.success) {
        toast.success('VPN service restarted successfully')
        setTimeout(fetchData, 3000) // Refresh after restart
      } else {
        toast.error(result.message || 'Failed to restart')
      }
    } catch (error) {
      toast.error('Failed to restart VPN service')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTerminateConnection = async (name: string) => {
    if (!confirm(`Terminate connection ${name}?`)) return

    try {
      const response = await fetch('/api/vpn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'terminate', connectionName: name }),
      })
      const result = await response.json()
      if (result.success) {
        toast.success(`Connection ${name} terminated`)
        fetchData()
      } else {
        toast.error(result.message || 'Failed to terminate')
      }
    } catch (error) {
      toast.error('Failed to terminate connection')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">VPN Integration</h1>
          <p className="text-muted-foreground">
            strongSwan configuration and monitoring
          </p>
        </div>
        <Badge variant={status?.running ? 'default' : 'destructive'}>
          {status?.running ? 'RUNNING' : 'STOPPED'}
        </Badge>
      </div>

      {/* VPN Status Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Service Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {status?.running ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className="text-lg font-semibold">{status?.running ? 'RUNNING' : 'STOPPED'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{formatUptime(status?.uptime || 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{connections.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Version</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold">{status?.version || 'Unknown'}</div>
          </CardContent>
        </Card>
      </div>

      {/* Service Control */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Service Control
            </CardTitle>
            <CardDescription>Manage the strongSwan VPN service</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleReload}
                disabled={isSubmitting}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isSubmitting ? 'animate-spin' : ''}`} />
                Reload Config
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleRestart}
                disabled={isSubmitting}
              >
                <Play className="mr-2 h-4 w-4" />
                Restart Service
              </Button>
            </div>

            <Alert>
              <Settings className="h-4 w-4" />
              <AlertTitle>Note</AlertTitle>
              <AlertDescription>
                Reloading configuration will not disconnect active VPN sessions.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Connection Stats
            </CardTitle>
            <CardDescription>Real-time VPN connection statistics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Active Connections</p>
                <p className="font-semibold">{connections.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Error</p>
                <p className="font-semibold text-sm">{status?.lastError || 'None'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Connections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Active Connections
          </CardTitle>
          <CardDescription>Currently connected VPN clients</CardDescription>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No active connections</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left text-sm font-medium">User</th>
                    <th className="p-3 text-left text-sm font-medium">Remote IP</th>
                    <th className="p-3 text-left text-sm font-medium">State</th>
                    <th className="p-3 text-right text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {connections.map((conn, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-3 text-sm font-medium">{conn.name || conn.remoteId}</td>
                      <td className="p-3 text-sm font-mono">{conn.remoteAddr}</td>
                      <td className="p-3">
                        <Badge variant="default">{conn.state}</Badge>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTerminateConnection(conn.name)}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuration Paths
          </CardTitle>
          <CardDescription>strongSwan configuration file locations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">swanctl Directory</Label>
              <div className="rounded-md bg-muted p-2 font-mono text-sm">
                /etc/swanctl
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">strongswan.conf</Label>
              <div className="rounded-md bg-muted p-2 font-mono text-sm">
                /etc/strongswan.conf
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <label className={className}>{children}</label>
}
