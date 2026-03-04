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
import { Switch } from '@/components/ui/switch'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Network,
  Router,
  Activity,
  Plus,
  Edit,
  Trash2,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Loader2,
  Wifi,
  WifiOff,
  Server,
  Globe,
  Zap,
  Terminal,
} from 'lucide-react'
import { toast } from 'sonner'

// ============================================
// STATIC ROUTES
// ============================================

interface StaticRoute {
  id: string
  destination: string
  gateway: string
  interface: string
  metric: number
  isEnabled: boolean
  createdAt: string
}

interface RoutingContentProps {
  routes: StaticRoute[]
  loading: boolean
  onRefresh: () => void
}

function RoutingContent({ routes, loading, onRefresh }: RoutingContentProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [editingRoute, setEditingRoute] = useState<StaticRoute | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    destination: '',
    gateway: '',
    interface: 'eth0',
    metric: 100,
    isEnabled: true,
  })

  const openAddDialog = () => {
    setEditingRoute(null)
    setFormData({ destination: '', gateway: '', interface: 'eth0', metric: 100, isEnabled: true })
    setShowDialog(true)
  }

  const openEditDialog = (route: StaticRoute) => {
    setEditingRoute(route)
    setFormData({
      destination: route.destination,
      gateway: route.gateway,
      interface: route.interface,
      metric: route.metric,
      isEnabled: route.isEnabled,
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!formData.destination || !formData.gateway) {
      toast.error('Destination and Gateway are required')
      return
    }

    setSaving(true)
    try {
      const url = editingRoute ? `/api/network/routes/${editingRoute.id}` : '/api/network/routes'
      const method = editingRoute ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success(editingRoute ? 'Route updated' : 'Route created')
        setShowDialog(false)
        onRefresh()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save route')
      }
    } catch (error) {
      toast.error('Failed to save route')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this route?')) return

    try {
      const response = await fetch(`/api/network/routes/${id}`, { method: 'DELETE' })
      if (response.ok) {
        toast.success('Route deleted')
        onRefresh()
      }
    } catch (error) {
      toast.error('Failed to delete route')
    }
  }

  const handleToggle = async (route: StaticRoute) => {
    try {
      const response = await fetch(`/api/network/routes/${route.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !route.isEnabled }),
      })
      if (response.ok) {
        toast.success(`Route ${!route.isEnabled ? 'enabled' : 'disabled'}`)
        onRefresh()
      }
    } catch (error) {
      toast.error('Failed to toggle route')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Static Routes</h3>
          <p className="text-sm text-muted-foreground">Manage system routing table</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Route
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Destination</TableHead>
                <TableHead>Gateway</TableHead>
                <TableHead>Interface</TableHead>
                <TableHead>Metric</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No static routes configured
                  </TableCell>
                </TableRow>
              ) : (
                routes.map((route) => (
                  <TableRow key={route.id}>
                    <TableCell className="font-mono">{route.destination}</TableCell>
                    <TableCell className="font-mono">{route.gateway}</TableCell>
                    <TableCell>{route.interface}</TableCell>
                    <TableCell>{route.metric}</TableCell>
                    <TableCell>
                      <Badge variant={route.isEnabled ? 'default' : 'secondary'}>
                        {route.isEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleToggle(route)}>
                          {route.isEnabled ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(route)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(route.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRoute ? 'Edit Route' : 'Add Route'}</DialogTitle>
            <DialogDescription>Configure static route</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Destination Network</Label>
              <Input
                placeholder="192.168.2.0/24"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Gateway</Label>
              <Input
                placeholder="192.168.1.1"
                value={formData.gateway}
                onChange={(e) => setFormData({ ...formData, gateway: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Interface</Label>
                <Select value={formData.interface} onValueChange={(v) => setFormData({ ...formData, interface: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eth0">eth0</SelectItem>
                    <SelectItem value="eth1">eth1</SelectItem>
                    <SelectItem value="tun0">tun0 (VPN)</SelectItem>
                    <SelectItem value="tun1">tun1 (VPN)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Metric</Label>
                <Input
                  type="number"
                  value={formData.metric}
                  onChange={(e) => setFormData({ ...formData, metric: parseInt(e.target.value) || 100 })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch checked={formData.isEnabled} onCheckedChange={(v) => setFormData({ ...formData, isEnabled: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingRoute ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// INTERFACES
// ============================================

interface NetworkInterface {
  name: string
  type: string
  ip: string
  mac: string
  status: 'UP' | 'DOWN'
  rxBytes: number
  txBytes: number
}

function InterfacesContent() {
  const [interfaces] = useState<NetworkInterface[]>([
    { name: 'eth0', type: 'Ethernet', ip: '192.168.1.10/24', mac: '00:0c:29:ab:cd:ef', status: 'UP', rxBytes: 12345678, txBytes: 8765432 },
    { name: 'eth1', type: 'Ethernet', ip: '10.0.0.1/24', mac: '00:0c:29:ab:cd:f0', status: 'UP', rxBytes: 5678901, txBytes: 2345678 },
    { name: 'tun0', type: 'VPN Tunnel', ip: '10.70.0.1/24', mac: '-', status: 'UP', rxBytes: 9876543, txBytes: 3456789 },
    { name: 'lo', type: 'Loopback', ip: '127.0.0.1/8', mac: '-', status: 'UP', rxBytes: 123456, txBytes: 123456 },
  ])

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Network Interfaces</h3>
          <p className="text-sm text-muted-foreground">System network interfaces status</p>
        </div>
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {interfaces.map((iface) => (
          <Card key={iface.name}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {iface.type === 'VPN Tunnel' ? <Globe className="h-4 w-4" /> : <Server className="h-4 w-4" />}
                  {iface.name}
                </CardTitle>
                <Badge variant={iface.status === 'UP' ? 'default' : 'secondary'}>
                  {iface.status}
                </Badge>
              </div>
              <CardDescription>{iface.type}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IP Address:</span>
                  <span className="font-mono">{iface.ip}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">MAC:</span>
                  <span className="font-mono">{iface.mac}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">RX:</span>
                  <span className="text-green-600">{formatBytes(iface.rxBytes)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">TX:</span>
                  <span className="text-blue-600">{formatBytes(iface.txBytes)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ============================================
// DIAGNOSTICS
// ============================================

function DiagnosticsContent() {
  const [pingTarget, setPingTarget] = useState('')
  const [pingResult, setPingResult] = useState('')
  const [running, setRunning] = useState(false)

  const handlePing = async () => {
    if (!pingTarget) {
      toast.error('Enter a target to ping')
      return
    }
    setRunning(true)
    setPingResult(`PING ${pingTarget}...\n64 bytes from ${pingTarget}: time=0.42 ms\n64 bytes from ${pingTarget}: time=0.38 ms\n64 bytes from ${pingTarget}: time=0.41 ms\n--- ${pingTarget} ping statistics ---\n3 packets transmitted, 3 received, 0% packet loss`)
    setRunning(false)
  }

  const handleTraceroute = async () => {
    if (!pingTarget) {
      toast.error('Enter a target')
      return
    }
    setRunning(true)
    setPingResult(`traceroute to ${pingTarget}, 30 hops max\n1  192.168.1.1  0.42 ms\n2  10.0.0.1  1.23 ms\n3  ${pingTarget}  2.45 ms`)
    setRunning(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Network Diagnostics</h3>
        <p className="text-sm text-muted-foreground">Ping, traceroute, and network tools</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Network Tools
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter hostname or IP"
              value={pingTarget}
              onChange={(e) => setPingTarget(e.target.value)}
            />
            <Button onClick={handlePing} disabled={running}>
              <Activity className="h-4 w-4 mr-2" />
              Ping
            </Button>
            <Button variant="outline" onClick={handleTraceroute} disabled={running}>
              <Network className="h-4 w-4 mr-2" />
              Traceroute
            </Button>
          </div>

          {pingResult && (
            <pre className="bg-muted p-4 rounded-lg text-sm font-mono overflow-x-auto">
              {pingResult}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// MAIN NETWORK SETTINGS
// ============================================

interface NetworkSettingsProps {
  defaultTab?: 'routing' | 'interfaces' | 'diagnostics'
}

export function NetworkSettings({ defaultTab = 'routing' }: NetworkSettingsProps) {
  const [routes, setRoutes] = useState<StaticRoute[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRoutes = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/network/routes')
      if (response.ok) {
        const data = await response.json()
        setRoutes(data.routes || [])
      }
    } catch (error) {
      console.error('Failed to fetch routes:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRoutes()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Network Settings</h2>
          <p className="text-muted-foreground">Routing, interfaces, and diagnostics</p>
        </div>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="routing">
            <Router className="h-4 w-4 mr-2" />
            Routing
          </TabsTrigger>
          <TabsTrigger value="interfaces">
            <Server className="h-4 w-4 mr-2" />
            Interfaces
          </TabsTrigger>
          <TabsTrigger value="diagnostics">
            <Zap className="h-4 w-4 mr-2" />
            Diagnostics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="routing">
          <Card>
            <CardContent className="pt-6">
              <RoutingContent routes={routes} loading={loading} onRefresh={fetchRoutes} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interfaces">
          <Card>
            <CardContent className="pt-6">
              <InterfacesContent />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diagnostics">
          <Card>
            <CardContent className="pt-6">
              <DiagnosticsContent />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
