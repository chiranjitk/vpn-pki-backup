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
  Network,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Loader2,
  ToggleLeft,
  ToggleRight,
  ArrowDownWideNarrow,
} from 'lucide-react'
import { toast } from 'sonner'

interface NetworkInterface {
  name: string
  type: string
  status: string
  ipAddress?: string
  description?: string
}

interface NatPolicy {
  id: string
  name: string
  type: 'SNAT' | 'DNAT' | 'MASQUERADE'
  sourceIp: string
  destIp: string
  interface: string
  translatedIp: string
  isEnabled: boolean
  description?: string
  createdAt: string
}

export function NatPoliciesContent() {
  const [policies, setPolicies] = useState<NatPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<NatPolicy | null>(null)
  const [saving, setSaving] = useState(false)
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([])
  const [loadingInterfaces, setLoadingInterfaces] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    type: 'SNAT' as 'SNAT' | 'DNAT' | 'MASQUERADE',
    sourceIp: '0.0.0.0/0',
    destIp: '0.0.0.0/0',
    interface: 'eth0',
    translatedIp: '',
    isEnabled: true,
    description: '',
  })

  useEffect(() => {
    fetchPolicies()
    fetchInterfaces()
  }, [])

  const fetchInterfaces = async () => {
    setLoadingInterfaces(true)
    try {
      const response = await fetch('/api/network/interfaces')
      if (response.ok) {
        const data = await response.json()
        setInterfaces(data.interfaces || [])
      }
    } catch (error) {
      console.error('Failed to fetch interfaces:', error)
    } finally {
      setLoadingInterfaces(false)
    }
  }

  const fetchPolicies = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/firewall/nat')
      if (response.ok) {
        const data = await response.json()
        setPolicies(data.policies || [])
      }
    } catch (error) {
      console.error('Failed to fetch NAT policies:', error)
    } finally {
      setLoading(false)
    }
  }

  const openAddDialog = () => {
    setEditingPolicy(null)
    setFormData({
      name: '',
      type: 'SNAT',
      sourceIp: '0.0.0.0/0',
      destIp: '0.0.0.0/0',
      interface: 'eth0',
      translatedIp: '',
      isEnabled: true,
      description: '',
    })
    setShowDialog(true)
  }

  const openEditDialog = (policy: NatPolicy) => {
    setEditingPolicy(policy)
    setFormData({
      name: policy.name,
      type: policy.type,
      sourceIp: policy.sourceIp,
      destIp: policy.destIp,
      interface: policy.interface,
      translatedIp: policy.translatedIp,
      isEnabled: policy.isEnabled,
      description: policy.description || '',
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Policy name is required')
      return
    }

    setSaving(true)
    try {
      const url = editingPolicy ? `/api/firewall/nat/${editingPolicy.id}` : '/api/firewall/nat'
      const method = editingPolicy ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success(editingPolicy ? 'NAT policy updated' : 'NAT policy created')
        setShowDialog(false)
        fetchPolicies()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save NAT policy')
      }
    } catch (error) {
      toast.error('Failed to save NAT policy')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this NAT policy?')) return

    try {
      const response = await fetch(`/api/firewall/nat/${id}`, { method: 'DELETE' })
      if (response.ok) {
        toast.success('NAT policy deleted')
        fetchPolicies()
      }
    } catch (error) {
      toast.error('Failed to delete NAT policy')
    }
  }

  const handleToggle = async (policy: NatPolicy) => {
    try {
      const response = await fetch(`/api/firewall/nat/${policy.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !policy.isEnabled }),
      })
      if (response.ok) {
        toast.success(`NAT policy ${!policy.isEnabled ? 'enabled' : 'disabled'}`)
        fetchPolicies()
      }
    } catch (error) {
      toast.error('Failed to toggle NAT policy')
    }
  }

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'SNAT': return 'bg-blue-500'
      case 'DNAT': return 'bg-purple-500'
      case 'MASQUERADE': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ArrowDownWideNarrow className="h-6 w-6 text-purple-500" />
            NAT Policies
          </h1>
          <p className="text-muted-foreground">
            Network Address Translation rules for traffic routing
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPolicies} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Policy
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Network className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{policies.filter(p => p.type === 'SNAT' && p.isEnabled).length}</div>
                <p className="text-xs text-muted-foreground">SNAT Rules</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Network className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{policies.filter(p => p.type === 'DNAT' && p.isEnabled).length}</div>
                <p className="text-xs text-muted-foreground">DNAT Rules</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Network className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{policies.filter(p => p.type === 'MASQUERADE' && p.isEnabled).length}</div>
                <p className="text-xs text-muted-foreground">Masquerade</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <ToggleRight className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{policies.filter(p => p.isEnabled).length}</div>
                <p className="text-xs text-muted-foreground">Active Policies</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Policies Table */}
      <Card>
        <CardHeader>
          <CardTitle>NAT Policies</CardTitle>
          <CardDescription>
            Configure Source NAT, Destination NAT, and Masquerade rules
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
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Translated IP</TableHead>
                    <TableHead>Interface</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No NAT policies configured. Click &quot;Add Policy&quot; to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    policies.map((policy) => (
                      <TableRow key={policy.id} className={!policy.isEnabled ? 'opacity-50' : ''}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{policy.name}</div>
                            {policy.description && (
                              <div className="text-xs text-muted-foreground">{policy.description}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getTypeBadgeColor(policy.type)} text-white`}>
                            {policy.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{policy.sourceIp}</TableCell>
                        <TableCell className="font-mono text-xs">{policy.destIp}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {policy.type === 'MASQUERADE' ? '(auto)' : policy.translatedIp || '-'}
                        </TableCell>
                        <TableCell>{policy.interface}</TableCell>
                        <TableCell>
                          <Badge variant={policy.isEnabled ? 'default' : 'secondary'}>
                            {policy.isEnabled ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleToggle(policy)}>
                              {policy.isEnabled ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(policy)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(policy.id)}>
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
            <DialogTitle>{editingPolicy ? 'Edit NAT Policy' : 'Add NAT Policy'}</DialogTitle>
            <DialogDescription>Configure Network Address Translation</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Policy Name</Label>
              <Input
                placeholder="e.g., VPN NAT"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(v: 'SNAT' | 'DNAT' | 'MASQUERADE') => setFormData({ ...formData, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SNAT">SNAT (Source NAT)</SelectItem>
                    <SelectItem value="DNAT">DNAT (Destination NAT)</SelectItem>
                    <SelectItem value="MASQUERADE">MASQUERADE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Interface</Label>
                <Select value={formData.interface} onValueChange={(v) => setFormData({ ...formData, interface: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select interface" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingInterfaces ? (
                      <SelectItem value="_loading" disabled>Loading interfaces...</SelectItem>
                    ) : interfaces.length === 0 ? (
                      <SelectItem value="_none" disabled>No interfaces found</SelectItem>
                    ) : (
                      interfaces.map((iface) => (
                        <SelectItem key={iface.name} value={iface.name}>
                          {iface.name} {iface.ipAddress ? `(${iface.ipAddress})` : ''} {iface.description ? `- ${iface.description}` : ''}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {interfaces.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {interfaces.length} interface{interfaces.length !== 1 ? 's' : ''} detected
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Source IP</Label>
                <Input
                  placeholder="10.70.0.0/24"
                  value={formData.sourceIp}
                  onChange={(e) => setFormData({ ...formData, sourceIp: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Destination IP</Label>
                <Input
                  placeholder="0.0.0.0/0"
                  value={formData.destIp}
                  onChange={(e) => setFormData({ ...formData, destIp: e.target.value })}
                />
              </div>
            </div>
            {formData.type !== 'MASQUERADE' && (
              <div className="space-y-2">
                <Label>Translated IP</Label>
                <Input
                  placeholder="e.g., 192.168.1.100"
                  value={formData.translatedIp}
                  onChange={(e) => setFormData({ ...formData, translatedIp: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  The IP address to translate to
                </p>
              </div>
            )}
            {formData.type === 'MASQUERADE' && (
              <div className="p-3 rounded-lg bg-muted text-sm">
                <strong>MASQUERADE</strong> automatically uses the interface IP for translation.
                No translated IP needed.
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch checked={formData.isEnabled} onCheckedChange={(v) => setFormData({ ...formData, isEnabled: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingPolicy ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
