'use client'

import { useState, useEffect } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  Server,
  Activity,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Loader2,
  Play,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  Settings,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'

// Types
interface KernelFirewallRule {
  id: string
  name: string
  chain: string
  table: string
  protocol: string | null
  sourceIp: string | null
  sourcePort: string | null
  destIp: string | null
  destPort: string | null
  inInterface: string | null
  outInterface: string | null
  tcpFlags: string | null
  connectionState: string | null
  matchExtensions: string | null
  target: string
  targetParams: string | null
  priority: number
  isEnabled: boolean
  isApplied: boolean
  packetsMatched: number
  bytesMatched: number
  lastMatchedAt: string | null
  description: string | null
  isSystemRule: boolean
  createdAt: string
  updatedAt: string
  appliedAt: string | null
}

interface FirewallStatus {
  firewall: {
    iptables: string
    nftables: string
    hasIptables: boolean
    chainStatus: Record<string, { policy: string; rules: number }>
  }
  database: {
    totalRules: number
    enabledRules: number
    appliedRules: number
    unappliedRules: number
    systemRules: number
    totalPacketsMatched: number
    totalBytesMatched: number
  }
  breakdown: {
    byChain: Array<{ chain: string; count: number }>
    byTable: Array<{ table: string; count: number }>
  }
  lastApplied: {
    name: string
    appliedAt: string
  } | null
  timestamp: string
}

const defaultFormData = {
  name: '',
  chain: 'INPUT',
  table: 'filter',
  protocol: '',
  sourceIp: '',
  sourcePort: '',
  destIp: '',
  destPort: '',
  inInterface: '',
  outInterface: '',
  tcpFlags: '',
  connectionState: '',
  matchExtensions: '',
  target: 'ACCEPT',
  targetParams: '',
  priority: 100,
  isEnabled: true,
  description: '',
}

export default function KernelFirewallPage() {
  const [rules, setRules] = useState<KernelFirewallRule[]>([])
  const [status, setStatus] = useState<FirewallStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusLoading, setStatusLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('INPUT')

  // Dialog states
  const [showDialog, setShowDialog] = useState(false)
  const [editingRule, setEditingRule] = useState<KernelFirewallRule | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState(defaultFormData)

  // Delete confirmation
  const [deleteRule, setDeleteRule] = useState<KernelFirewallRule | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Apply confirmation
  const [showApplyDialog, setShowApplyDialog] = useState(false)
  const [applying, setApplying] = useState(false)

  const fetchRules = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/kernel-firewall')
      if (response.ok) {
        const data = await response.json()
        setRules(data.rules || [])
      }
    } catch (error) {
      console.error('Failed to fetch rules:', error)
      toast.error('Failed to fetch firewall rules')
    } finally {
      setLoading(false)
    }
  }

  const fetchStatus = async () => {
    setStatusLoading(true)
    try {
      const response = await fetch('/api/kernel-firewall/status')
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
      }
    } catch (error) {
      console.error('Failed to fetch status:', error)
    } finally {
      setStatusLoading(false)
    }
  }

  useEffect(() => {
    fetchRules()
    fetchStatus()
  }, [])

  const openAddDialog = () => {
    setEditingRule(null)
    setFormData({ ...defaultFormData, priority: (rules.length + 1) * 10 })
    setShowDialog(true)
  }

  const openEditDialog = (rule: KernelFirewallRule) => {
    if (rule.isSystemRule) {
      toast.error('Cannot edit system rules')
      return
    }
    setEditingRule(rule)
    setFormData({
      name: rule.name,
      chain: rule.chain,
      table: rule.table,
      protocol: rule.protocol || '',
      sourceIp: rule.sourceIp || '',
      sourcePort: rule.sourcePort || '',
      destIp: rule.destIp || '',
      destPort: rule.destPort || '',
      inInterface: rule.inInterface || '',
      outInterface: rule.outInterface || '',
      tcpFlags: rule.tcpFlags || '',
      connectionState: rule.connectionState || '',
      matchExtensions: rule.matchExtensions || '',
      target: rule.target,
      targetParams: rule.targetParams || '',
      priority: rule.priority,
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
      const url = editingRule
        ? `/api/kernel-firewall/${editingRule.id}`
        : '/api/kernel-firewall'
      const method = editingRule ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success(editingRule ? 'Rule updated' : 'Rule created')
        setShowDialog(false)
        fetchRules()
        fetchStatus()
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

  const handleDelete = async () => {
    if (!deleteRule) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/kernel-firewall/${deleteRule.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Rule deleted')
        setDeleteRule(null)
        fetchRules()
        fetchStatus()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete rule')
      }
    } catch (error) {
      toast.error('Failed to delete rule')
    } finally {
      setDeleting(false)
    }
  }

  const handleToggle = async (rule: KernelFirewallRule) => {
    if (rule.isSystemRule) {
      toast.error('Cannot modify system rules')
      return
    }

    try {
      const response = await fetch(`/api/kernel-firewall/${rule.id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !rule.isEnabled }),
      })

      if (response.ok) {
        toast.success(`Rule ${!rule.isEnabled ? 'enabled' : 'disabled'}`)
        fetchRules()
        fetchStatus()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to toggle rule')
      }
    } catch (error) {
      toast.error('Failed to toggle rule')
    }
  }

  const handleApplyRules = async () => {
    setApplying(true)
    try {
      const response = await fetch('/api/kernel-firewall/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'replace' }),
      })

      const data = await response.json()
      if (response.ok) {
        toast.success(data.message || 'Rules applied successfully')
        setShowApplyDialog(false)
        fetchRules()
        fetchStatus()
      } else {
        toast.error(data.error || 'Failed to apply rules')
      }
    } catch (error) {
      toast.error('Failed to apply rules')
    } finally {
      setApplying(false)
    }
  }

  // Filter rules by chain
  const filteredRules = rules.filter((rule) => rule.chain === activeTab)

  // Get target badge variant
  const getTargetBadge = (target: string) => {
    switch (target) {
      case 'ACCEPT':
        return <Badge variant="default" className="bg-green-600">{target}</Badge>
      case 'DROP':
        return <Badge variant="destructive">{target}</Badge>
      case 'REJECT':
        return <Badge variant="destructive">{target}</Badge>
      case 'LOG':
        return <Badge variant="secondary">{target}</Badge>
      case 'MASQUERADE':
      case 'SNAT':
      case 'DNAT':
        return <Badge variant="outline" className="border-blue-500 text-blue-500">{target}</Badge>
      default:
        return <Badge variant="secondary">{target}</Badge>
    }
  }

  // Format bytes
  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return bytes > 0 ? parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i] : '0 B'
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Kernel Firewall
            </h1>
            <p className="text-muted-foreground">
              Manage iptables/nftables rules for VPN server
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { fetchRules(); fetchStatus(); }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowApplyDialog(true)}
              disabled={status?.database.unappliedRules === 0}
            >
              <Play className="h-4 w-4 mr-2" />
              Apply Rules
            </Button>
            <Button size="sm" onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">iptables Status</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {status?.firewall.iptables === 'active' ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-xl font-bold text-green-600">Active</span>
                  </>
                ) : status?.firewall.iptables === 'inactive' ? (
                  <>
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="text-xl font-bold text-red-600">Inactive</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    <span className="text-xl font-bold text-yellow-600">Unknown</span>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                nftables: {status?.firewall.nftables || 'unknown'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Rules</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{status?.database.totalRules || 0}</div>
              <p className="text-xs text-muted-foreground">
                {status?.database.systemRules || 0} system rules
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Applied Rules</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{status?.database.appliedRules || 0}</div>
              <p className="text-xs text-muted-foreground">
                {status?.database.unappliedRules || 0} pending changes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Traffic Matched</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatBytes(status?.database.totalBytesMatched || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {(status?.database.totalPacketsMatched || 0).toLocaleString()} packets
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Rules Table */}
        <Card>
          <CardHeader>
            <CardTitle>Firewall Rules</CardTitle>
            <CardDescription>
              Configure kernel-level firewall rules for traffic filtering
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="INPUT">INPUT</TabsTrigger>
                <TabsTrigger value="OUTPUT">OUTPUT</TabsTrigger>
                <TabsTrigger value="FORWARD">FORWARD</TabsTrigger>
                <TabsTrigger value="PREROUTING">PREROUTING</TabsTrigger>
                <TabsTrigger value="POSTROUTING">POSTROUTING</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab}>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Prio</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Protocol</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Destination</TableHead>
                          <TableHead>Target</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRules.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                              No rules configured for {activeTab} chain
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredRules.map((rule) => (
                            <TableRow key={rule.id} className={!rule.isEnabled ? 'opacity-50' : ''}>
                              <TableCell className="font-mono text-sm">{rule.priority}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{rule.name}</span>
                                  {rule.isSystemRule && (
                                    <Badge variant="outline" className="text-xs">System</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {rule.protocol || 'all'}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {rule.sourceIp || '0.0.0.0/0'}
                                {rule.sourcePort && `:${rule.sourcePort}`}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {rule.destIp || '0.0.0.0/0'}
                                {rule.destPort && `:${rule.destPort}`}
                              </TableCell>
                              <TableCell>{getTargetBadge(rule.target)}</TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <Badge variant={rule.isEnabled ? 'default' : 'secondary'}>
                                    {rule.isEnabled ? 'Enabled' : 'Disabled'}
                                  </Badge>
                                  <Badge variant={rule.isApplied ? 'default' : 'outline'} className="text-xs">
                                    {rule.isApplied ? 'Applied' : 'Pending'}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggle(rule)}
                                    disabled={rule.isSystemRule}
                                    title={rule.isEnabled ? 'Disable' : 'Enable'}
                                  >
                                    {rule.isEnabled ? (
                                      <XCircle className="h-4 w-4" />
                                    ) : (
                                      <CheckCircle className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditDialog(rule)}
                                    disabled={rule.isSystemRule}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteRule(rule)}
                                    disabled={rule.isSystemRule}
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
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRule ? 'Edit Rule' : 'Add Rule'}</DialogTitle>
              <DialogDescription>
                Configure firewall rule for kernel-level traffic filtering
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rule Name *</Label>
                  <Input
                    placeholder="e.g., Allow HTTPS"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 100 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Chain</Label>
                  <Select
                    value={formData.chain}
                    onValueChange={(v) => setFormData({ ...formData, chain: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INPUT">INPUT</SelectItem>
                      <SelectItem value="OUTPUT">OUTPUT</SelectItem>
                      <SelectItem value="FORWARD">FORWARD</SelectItem>
                      <SelectItem value="PREROUTING">PREROUTING</SelectItem>
                      <SelectItem value="POSTROUTING">POSTROUTING</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Table</Label>
                  <Select
                    value={formData.table}
                    onValueChange={(v) => setFormData({ ...formData, table: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="filter">filter</SelectItem>
                      <SelectItem value="nat">nat</SelectItem>
                      <SelectItem value="mangle">mangle</SelectItem>
                      <SelectItem value="raw">raw</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Protocol</Label>
                  <Select
                    value={formData.protocol}
                    onValueChange={(v) => setFormData({ ...formData, protocol: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All protocols" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All</SelectItem>
                      <SelectItem value="tcp">TCP</SelectItem>
                      <SelectItem value="udp">UDP</SelectItem>
                      <SelectItem value="icmp">ICMP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Action</Label>
                  <Select
                    value={formData.target}
                    onValueChange={(v) => setFormData({ ...formData, target: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACCEPT">ACCEPT</SelectItem>
                      <SelectItem value="DROP">DROP</SelectItem>
                      <SelectItem value="REJECT">REJECT</SelectItem>
                      <SelectItem value="LOG">LOG</SelectItem>
                      <SelectItem value="MASQUERADE">MASQUERADE</SelectItem>
                      <SelectItem value="SNAT">SNAT</SelectItem>
                      <SelectItem value="DNAT">DNAT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source IP</Label>
                  <Input
                    placeholder="e.g., 192.168.1.0/24"
                    value={formData.sourceIp}
                    onChange={(e) => setFormData({ ...formData, sourceIp: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Source Port</Label>
                  <Input
                    placeholder="e.g., 80 or 1000:2000"
                    value={formData.sourcePort}
                    onChange={(e) => setFormData({ ...formData, sourcePort: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Destination IP</Label>
                  <Input
                    placeholder="e.g., 10.0.0.0/8"
                    value={formData.destIp}
                    onChange={(e) => setFormData({ ...formData, destIp: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Destination Port</Label>
                  <Input
                    placeholder="e.g., 443 or 8000:9000"
                    value={formData.destPort}
                    onChange={(e) => setFormData({ ...formData, destPort: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>In Interface</Label>
                  <Input
                    placeholder="e.g., eth0"
                    value={formData.inInterface}
                    onChange={(e) => setFormData({ ...formData, inInterface: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Out Interface</Label>
                  <Input
                    placeholder="e.g., tun0"
                    value={formData.outInterface}
                    onChange={(e) => setFormData({ ...formData, outInterface: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>TCP Flags</Label>
                  <Input
                    placeholder="e.g., SYN,RST SYN"
                    value={formData.tcpFlags}
                    onChange={(e) => setFormData({ ...formData, tcpFlags: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Connection State</Label>
                  <Select
                    value={formData.connectionState}
                    onValueChange={(v) => setFormData({ ...formData, connectionState: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any state" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any</SelectItem>
                      <SelectItem value="NEW">NEW</SelectItem>
                      <SelectItem value="ESTABLISHED">ESTABLISHED</SelectItem>
                      <SelectItem value="RELATED">RELATED</SelectItem>
                      <SelectItem value="INVALID">INVALID</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Target Parameters</Label>
                <Input
                  placeholder="e.g., --to-source 192.168.1.1"
                  value={formData.targetParams}
                  onChange={(e) => setFormData({ ...formData, targetParams: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Rule description..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Enabled</Label>
                <Switch
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
                {editingRule ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteRule} onOpenChange={() => setDeleteRule(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Rule</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the rule &quot;{deleteRule?.name}&quot;? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Apply Confirmation */}
        <AlertDialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apply Firewall Rules</AlertDialogTitle>
              <AlertDialogDescription>
                This will apply all enabled rules to the kernel firewall. Existing rules
                will be replaced. Are you sure you want to continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={applying}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleApplyRules} disabled={applying}>
                {applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Apply Rules
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  )
}
