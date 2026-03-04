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
import { Textarea } from '@/components/ui/textarea'
import {
  Shield,
  Firewall,
  ArrowUp,
  ArrowDown,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Network,
  Globe,
} from 'lucide-react'
import { toast } from 'sonner'

// ============================================
// FIREWALL RULES
// ============================================

interface FirewallRule {
  id: string
  name: string
  action: 'ALLOW' | 'DENY'
  protocol: 'TCP' | 'UDP' | 'ICMP' | 'ALL'
  sourcePort?: string
  destPort?: string
  sourceIp: string
  destIp: string
  interface: string
  isEnabled: boolean
  priority: number
  description?: string
  createdAt: string
}

interface FirewallContentProps {
  rules: FirewallRule[]
  loading: boolean
  onRefresh: () => void
}

function FirewallContent({ rules, loading, onRefresh }: FirewallContentProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [editingRule, setEditingRule] = useState<FirewallRule | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    action: 'ALLOW' as 'ALLOW' | 'DENY',
    protocol: 'TCP' as 'TCP' | 'UDP' | 'ICMP' | 'ALL',
    sourcePort: '',
    destPort: '',
    sourceIp: '0.0.0.0/0',
    destIp: '0.0.0.0/0',
    interface: 'eth0',
    isEnabled: true,
    description: '',
  })

  const openAddDialog = () => {
    setEditingRule(null)
    setFormData({
      name: '',
      action: 'ALLOW',
      protocol: 'TCP',
      sourcePort: '',
      destPort: '',
      sourceIp: '0.0.0.0/0',
      destIp: '0.0.0.0/0',
      interface: 'eth0',
      isEnabled: true,
      description: '',
    })
    setShowDialog(true)
  }

  const openEditDialog = (rule: FirewallRule) => {
    setEditingRule(rule)
    setFormData({
      name: rule.name,
      action: rule.action,
      protocol: rule.protocol,
      sourcePort: rule.sourcePort || '',
      destPort: rule.destPort || '',
      sourceIp: rule.sourceIp,
      destIp: rule.destIp,
      interface: rule.interface,
      isEnabled: rule.isEnabled,
      description: rule.description || '',
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Rule name is required')
      return
    }

    setSaving(true)
    try {
      const url = editingRule ? `/api/firewall/rules/${editingRule.id}` : '/api/firewall/rules'
      const method = editingRule ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success(editingRule ? 'Rule updated' : 'Rule created')
        setShowDialog(false)
        onRefresh()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save rule')
      }
    } catch (error) {
      toast.error('Failed to save rule')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this firewall rule?')) return

    try {
      const response = await fetch(`/api/firewall/rules/${id}`, { method: 'DELETE' })
      if (response.ok) {
        toast.success('Rule deleted')
        onRefresh()
      }
    } catch (error) {
      toast.error('Failed to delete rule')
    }
  }

  const handleToggle = async (rule: FirewallRule) => {
    try {
      const response = await fetch(`/api/firewall/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !rule.isEnabled }),
      })
      if (response.ok) {
        toast.success(`Rule ${!rule.isEnabled ? 'enabled' : 'disabled'}`)
        onRefresh()
      }
    } catch (error) {
      toast.error('Failed to toggle rule')
    }
  }

  const handleMoveUp = async (rule: FirewallRule) => {
    try {
      const response = await fetch(`/api/firewall/rules/${rule.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: 'up' }),
      })
      if (response.ok) {
        onRefresh()
      }
    } catch (error) {
      toast.error('Failed to move rule')
    }
  }

  const handleMoveDown = async (rule: FirewallRule) => {
    try {
      const response = await fetch(`/api/firewall/rules/${rule.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: 'down' }),
      })
      if (response.ok) {
        onRefresh()
      }
    } catch (error) {
      toast.error('Failed to move rule')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Firewall Rules</h3>
          <p className="text-sm text-muted-foreground">Manage packet filtering rules</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
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
                <TableHead className="w-12">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Protocol</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No firewall rules configured
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((rule, index) => (
                  <TableRow key={rule.id}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      <Badge variant={rule.action === 'ALLOW' ? 'default' : 'destructive'}>
                        {rule.action}
                      </Badge>
                    </TableCell>
                    <TableCell>{rule.protocol}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {rule.sourceIp}
                      {rule.sourcePort && `:${rule.sourcePort}`}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {rule.destIp}
                      {rule.destPort && `:${rule.destPort}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.isEnabled ? 'default' : 'secondary'}>
                        {rule.isEnabled ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleMoveUp(rule)} disabled={index === 0}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleMoveDown(rule)} disabled={index === rules.length - 1}>
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleToggle(rule)}>
                          {rule.isEnabled ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(rule)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(rule.id)}>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Firewall Rule' : 'Add Firewall Rule'}</DialogTitle>
            <DialogDescription>Configure packet filtering rule</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rule Name</Label>
              <Input
                placeholder="e.g., Allow VPN Traffic"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Action</Label>
                <Select value={formData.action} onValueChange={(v: 'ALLOW' | 'DENY') => setFormData({ ...formData, action: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALLOW">ALLOW</SelectItem>
                    <SelectItem value="DENY">DENY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Protocol</Label>
                <Select value={formData.protocol} onValueChange={(v: 'TCP' | 'UDP' | 'ICMP' | 'ALL') => setFormData({ ...formData, protocol: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TCP">TCP</SelectItem>
                    <SelectItem value="UDP">UDP</SelectItem>
                    <SelectItem value="ICMP">ICMP</SelectItem>
                    <SelectItem value="ALL">ALL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Source IP</Label>
                <Input
                  placeholder="0.0.0.0/0"
                  value={formData.sourceIp}
                  onChange={(e) => setFormData({ ...formData, sourceIp: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Source Port</Label>
                <Input
                  placeholder="Any"
                  value={formData.sourcePort}
                  onChange={(e) => setFormData({ ...formData, sourcePort: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Destination IP</Label>
                <Input
                  placeholder="0.0.0.0/0"
                  value={formData.destIp}
                  onChange={(e) => setFormData({ ...formData, destIp: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Destination Port</Label>
                <Input
                  placeholder="e.g., 443, 500, 4500"
                  value={formData.destPort}
                  onChange={(e) => setFormData({ ...formData, destPort: e.target.value })}
                />
              </div>
            </div>
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
                  <SelectItem value="all">All Interfaces</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Optional description..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
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
              {editingRule ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// NAT POLICIES
// ============================================

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

interface NatContentProps {
  policies: NatPolicy[]
  loading: boolean
  onRefresh: () => void
}

function NatContent({ policies, loading, onRefresh }: NatContentProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<NatPolicy | null>(null)
  const [saving, setSaving] = useState(false)
  const [localPolicies, setLocalPolicies] = useState<NatPolicy[]>(policies)
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

  // Update local state when props change
  useEffect(() => {
    setLocalPolicies(policies)
  }, [policies])

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
        onRefresh()
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
        onRefresh()
      }
    } catch (error) {
      toast.error('Failed to delete NAT policy')
    }
  }

  const handleToggle = async (policy: NatPolicy) => {
    // Optimistic update - immediately update UI
    setLocalPolicies(prev => 
      prev.map(p => p.id === policy.id ? { ...p, isEnabled: !p.isEnabled } : p)
    )

    try {
      const response = await fetch(`/api/firewall/nat/${policy.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !policy.isEnabled }),
      })
      if (response.ok) {
        toast.success(`NAT policy ${!policy.isEnabled ? 'enabled' : 'disabled'}`)
        onRefresh()
      } else {
        // Revert on error
        setLocalPolicies(policies)
        toast.error('Failed to toggle NAT policy')
      }
    } catch (error) {
      // Revert on error
      setLocalPolicies(policies)
      toast.error('Failed to toggle NAT policy')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">NAT Policies</h3>
          <p className="text-sm text-muted-foreground">Network Address Translation rules</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Policy
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
              {localPolicies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No NAT policies configured
                  </TableCell>
                </TableRow>
              ) : (
                localPolicies.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="font-medium">{policy.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{policy.type}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{policy.sourceIp}</TableCell>
                    <TableCell className="font-mono text-xs">{policy.destIp}</TableCell>
                    <TableCell className="font-mono text-xs">{policy.translatedIp}</TableCell>
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

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
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
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eth0">eth0</SelectItem>
                    <SelectItem value="eth1">eth1</SelectItem>
                    <SelectItem value="tun0">tun0 (VPN)</SelectItem>
                  </SelectContent>
                </Select>
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
            <div className="space-y-2">
              <Label>Translated IP (for SNAT/DNAT)</Label>
              <Input
                placeholder="e.g., 192.168.1.100 or eth0 interface IP"
                value={formData.translatedIp}
                onChange={(e) => setFormData({ ...formData, translatedIp: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                For MASQUERADE, this is automatically set to the interface IP
              </p>
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
              {editingPolicy ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// MAIN SECURITY SETTINGS
// ============================================

interface SecuritySettingsNewProps {
  defaultTab?: 'firewall' | 'nat'
}

export function SecuritySettingsNew({ defaultTab = 'firewall' }: SecuritySettingsNewProps) {
  const [rules, setRules] = useState<FirewallRule[]>([])
  const [policies, setPolicies] = useState<NatPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [natLoading, setNatLoading] = useState(true)

  const fetchRules = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/firewall/rules')
      if (response.ok) {
        const data = await response.json()
        setRules(data.rules || [])
      }
    } catch (error) {
      console.error('Failed to fetch firewall rules:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPolicies = async () => {
    setNatLoading(true)
    try {
      const response = await fetch('/api/firewall/nat')
      if (response.ok) {
        const data = await response.json()
        setPolicies(data.policies || [])
      }
    } catch (error) {
      console.error('Failed to fetch NAT policies:', error)
    } finally {
      setNatLoading(false)
    }
  }

  useEffect(() => {
    fetchRules()
    fetchPolicies()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Security Settings</h2>
          <p className="text-muted-foreground">Firewall rules and NAT policies</p>
        </div>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="firewall">
            <Shield className="h-4 w-4 mr-2" />
            Firewall Rules
          </TabsTrigger>
          <TabsTrigger value="nat">
            <Network className="h-4 w-4 mr-2" />
            NAT Policies
          </TabsTrigger>
        </TabsList>

        <TabsContent value="firewall">
          <Card>
            <CardContent className="pt-6">
              <FirewallContent rules={rules} loading={loading} onRefresh={fetchRules} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nat">
          <Card>
            <CardContent className="pt-6">
              <NatContent policies={policies} loading={natLoading} onRefresh={fetchPolicies} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
