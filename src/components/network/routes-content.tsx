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
import { Badge } from '@/components/ui/badge'
import {
  Router,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Loader2,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { toast } from 'sonner'

interface StaticRoute {
  id: string
  destination: string
  gateway: string
  interface: string
  metric: number
  isEnabled: boolean
  description?: string
  createdAt: string
}

export function RoutesContent() {
  const [routes, setRoutes] = useState<StaticRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingRoute, setEditingRoute] = useState<StaticRoute | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    destination: '',
    gateway: '',
    interface: 'eth0',
    metric: 100,
    isEnabled: true,
    description: '',
  })

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
      toast.error('Failed to load routes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRoutes()
  }, [])

  const openAddDialog = () => {
    setEditingRoute(null)
    setFormData({
      destination: '',
      gateway: '',
      interface: 'eth0',
      metric: 100,
      isEnabled: true,
      description: '',
    })
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
      description: route.description || '',
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
      const url = editingRoute
        ? `/api/network/routes/${editingRoute.id}`
        : '/api/network/routes'
      const method = editingRoute ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success(editingRoute ? 'Route updated' : 'Route created')
        setShowDialog(false)
        fetchRoutes()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save route')
      }
    } catch {
      toast.error('Failed to save route')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this route?')) return

    try {
      const response = await fetch(`/api/network/routes/${id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        toast.success('Route deleted')
        fetchRoutes()
      } else {
        toast.error('Failed to delete route')
      }
    } catch {
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
        fetchRoutes()
      }
    } catch {
      toast.error('Failed to toggle route')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Router className="h-6 w-6" />
            Routing
          </h2>
          <p className="text-muted-foreground">
            Manage static routes for network traffic
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchRoutes} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Route
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Static Routes</CardTitle>
          <CardDescription>
            Configure static routes to control network traffic routing
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No static routes configured. Click &quot;Add Route&quot; to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    routes.map((route) => (
                      <TableRow key={route.id}>
                        <TableCell className="font-mono">
                          {route.destination}
                        </TableCell>
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
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggle(route)}
                              title={route.isEnabled ? 'Disable' : 'Enable'}
                            >
                              {route.isEnabled ? (
                                <WifiOff className="h-4 w-4" />
                              ) : (
                                <Wifi className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(route)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(route.id)}
                            >
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
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRoute ? 'Edit Route' : 'Add Route'}</DialogTitle>
            <DialogDescription>
              {editingRoute
                ? 'Update the static route configuration'
                : 'Configure a new static route'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="destination">Destination Network *</Label>
              <Input
                id="destination"
                placeholder="192.168.2.0/24"
                value={formData.destination}
                onChange={(e) =>
                  setFormData({ ...formData, destination: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Network address with CIDR notation (e.g., 10.0.0.0/24)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gateway">Gateway *</Label>
              <Input
                id="gateway"
                placeholder="192.168.1.1"
                value={formData.gateway}
                onChange={(e) => setFormData({ ...formData, gateway: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                IP address of the next-hop router
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="interface">Interface</Label>
                <Select
                  value={formData.interface}
                  onValueChange={(v) => setFormData({ ...formData, interface: v })}
                >
                  <SelectTrigger id="interface">
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
                <Label htmlFor="metric">Metric</Label>
                <Input
                  id="metric"
                  type="number"
                  min={1}
                  max={65535}
                  value={formData.metric}
                  onChange={(e) =>
                    setFormData({ ...formData, metric: parseInt(e.target.value) || 100 })
                  }
                />
                <p className="text-xs text-muted-foreground">Lower = higher priority</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="Route description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="enabled">Enabled</Label>
                <p className="text-xs text-muted-foreground">
                  Enable or disable this route
                </p>
              </div>
              <Switch
                id="enabled"
                checked={formData.isEnabled}
                onCheckedChange={(v) => setFormData({ ...formData, isEnabled: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
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
