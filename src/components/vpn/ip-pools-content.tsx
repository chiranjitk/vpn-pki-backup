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
import { Progress } from '@/components/ui/progress'
import {
  Network,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Globe,
  Server,
  Users,
  Activity,
} from 'lucide-react'
import { toast } from 'sonner'

interface IpPool {
  id: string
  name: string
  cidr: string
  gateway: string
  dnsServers: string[]
  status: 'ACTIVE' | 'DISABLED'
  usedIps: number
  totalIps: number
  profileId?: string
  profileName?: string
  createdAt: string
}

interface ConnectionProfile {
  id: string
  name: string
}

export function IpPoolsContent() {
  const [pools, setPools] = useState<IpPool[]>([])
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingPool, setEditingPool] = useState<IpPool | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    cidr: '',
    gateway: '',
    dnsServers: '',
    profileId: '',
    isEnabled: true,
  })

  useEffect(() => {
    fetchPools()
    fetchProfiles()
  }, [])

  const fetchPools = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/vpn/ip-pools')
      if (response.ok) {
        const data = await response.json()
        setPools(data.pools || [])
      }
    } catch (error) {
      console.error('Failed to fetch IP pools:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProfiles = async () => {
    try {
      const response = await fetch('/api/vpn/profiles')
      if (response.ok) {
        const data = await response.json()
        setProfiles(data.profiles || [])
      }
    } catch (error) {
      console.error('Failed to fetch profiles:', error)
    }
  }

  const openAddDialog = () => {
    setEditingPool(null)
    setFormData({
      name: '',
      cidr: '',
      gateway: '',
      dnsServers: '',
      profileId: '',
      isEnabled: true,
    })
    setShowDialog(true)
  }

  const openEditDialog = (pool: IpPool) => {
    setEditingPool(pool)
    setFormData({
      name: pool.name,
      cidr: pool.cidr,
      gateway: pool.gateway,
      dnsServers: pool.dnsServers.join(', '),
      profileId: pool.profileId || '',
      isEnabled: pool.status === 'ACTIVE',
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.cidr) {
      toast.error('Pool name and CIDR range are required')
      return
    }

    // Validate CIDR format
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
    if (!cidrRegex.test(formData.cidr)) {
      toast.error('Invalid CIDR format (e.g., 10.70.1.0/24)')
      return
    }

    setSaving(true)
    try {
      const url = editingPool ? `/api/vpn/ip-pools/${editingPool.id}` : '/api/vpn/ip-pools'
      const method = editingPool ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          dnsServers: formData.dnsServers.split(',').map(s => s.trim()).filter(Boolean),
        }),
      })

      if (response.ok) {
        toast.success(editingPool ? 'IP Pool updated' : 'IP Pool created')
        setShowDialog(false)
        fetchPools()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save IP pool')
      }
    } catch {
      toast.error('Failed to save IP pool')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this IP pool?')) return

    try {
      const response = await fetch(`/api/vpn/ip-pools/${id}`, { method: 'DELETE' })
      if (response.ok) {
        toast.success('IP Pool deleted')
        fetchPools()
      }
    } catch {
      toast.error('Failed to delete IP pool')
    }
  }

  const handleToggle = async (pool: IpPool) => {
    try {
      const response = await fetch(`/api/vpn/ip-pools/${pool.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: pool.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' }),
      })
      if (response.ok) {
        toast.success(`IP Pool ${pool.status === 'ACTIVE' ? 'disabled' : 'enabled'}`)
        fetchPools()
      }
    } catch {
      toast.error('Failed to toggle IP pool')
    }
  }

  const getUsagePercentage = (pool: IpPool) => {
    if (pool.totalIps === 0) return 0
    return Math.round((pool.usedIps / pool.totalIps) * 100)
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-500'
    if (percentage >= 70) return 'text-yellow-500'
    return 'text-green-500'
  }

  // Calculate total IPs from CIDR
  const calculateTotalIps = (cidr: string): number => {
    const parts = cidr.split('/')
    if (parts.length !== 2) return 0
    const prefix = parseInt(parts[1])
    if (isNaN(prefix) || prefix < 0 || prefix > 32) return 0
    return Math.pow(2, 32 - prefix) - 2 // Subtract network and broadcast
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Network className="h-6 w-6 text-purple-500" />
            IP Pools
          </h1>
          <p className="text-muted-foreground">
            Manage VPN IP address pools for client assignment
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPools} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Pool
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Network className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{pools.length}</div>
                <p className="text-xs text-muted-foreground">Total Pools</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <ToggleRight className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{pools.filter(p => p.status === 'ACTIVE').length}</div>
                <p className="text-xs text-muted-foreground">Active Pools</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Server className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {pools.reduce((sum, p) => sum + p.usedIps, 0)}
                </div>
                <p className="text-xs text-muted-foreground">Used IPs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {pools.reduce((sum, p) => sum + (p.totalIps - p.usedIps), 0)}
                </div>
                <p className="text-xs text-muted-foreground">Available IPs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pools Table */}
      <Card>
        <CardHeader>
          <CardTitle>IP Address Pools</CardTitle>
          <CardDescription>
            Virtual IP address pools assigned to VPN clients
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
                    <TableHead>Pool Name</TableHead>
                    <TableHead>CIDR Range</TableHead>
                    <TableHead>Gateway</TableHead>
                    <TableHead>DNS Servers</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Profile</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pools.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No IP pools configured. Click &quot;Add Pool&quot; to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pools.map((pool) => (
                      <TableRow key={pool.id} className={pool.status === 'DISABLED' ? 'opacity-50' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-purple-500" />
                            <span className="font-medium">{pool.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{pool.cidr}</TableCell>
                        <TableCell className="font-mono text-sm">{pool.gateway || '-'}</TableCell>
                        <TableCell className="text-sm">
                          {pool.dnsServers.length > 0 ? (
                            <span className="font-mono">{pool.dnsServers.join(', ')}</span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className={getUsageColor(getUsagePercentage(pool))}>
                                {pool.usedIps} / {pool.totalIps}
                              </span>
                              <span className="text-muted-foreground">
                                {getUsagePercentage(pool)}%
                              </span>
                            </div>
                            <Progress value={getUsagePercentage(pool)} className="h-1" />
                          </div>
                        </TableCell>
                        <TableCell>
                          {pool.profileName ? (
                            <Badge variant="outline">{pool.profileName}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={pool.status === 'ACTIVE' ? 'default' : 'secondary'}>
                            {pool.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleToggle(pool)}>
                              {pool.status === 'ACTIVE' ? (
                                <ToggleRight className="h-4 w-4 text-green-600" />
                              ) : (
                                <ToggleLeft className="h-4 w-4" />
                              )}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(pool)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(pool.id)}>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPool ? 'Edit IP Pool' : 'Add IP Pool'}</DialogTitle>
            <DialogDescription>Configure VPN IP address pool</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pool Name</Label>
              <Input
                placeholder="e.g., VPN Clients Pool"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CIDR Range</Label>
                <Input
                  placeholder="10.70.1.0/24"
                  value={formData.cidr}
                  onChange={(e) => setFormData({ ...formData, cidr: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  {formData.cidr && `${calculateTotalIps(formData.cidr)} usable IPs`}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Gateway IP</Label>
                <Input
                  placeholder="10.70.1.1"
                  value={formData.gateway}
                  onChange={(e) => setFormData({ ...formData, gateway: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>DNS Servers (pushed to clients)</Label>
              <Input
                placeholder="8.8.8.8, 8.8.4.4"
                value={formData.dnsServers}
                onChange={(e) => setFormData({ ...formData, dnsServers: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Comma-separated list</p>
            </div>
            <div className="space-y-2">
              <Label>Connection Profile (optional)</Label>
              <Select 
                value={formData.profileId || 'none'} 
                onValueChange={(v) => setFormData({ ...formData, profileId: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Assign to profile..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Global Pool)</SelectItem>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enabled</Label>
                <p className="text-xs text-muted-foreground">Activate this IP pool</p>
              </div>
              <Switch
                checked={formData.isEnabled}
                onCheckedChange={(v) => setFormData({ ...formData, isEnabled: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingPool ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
