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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Shield,
  ArrowUp,
  ArrowDown,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Flame,
  Server,
  ArrowRightLeft,
  Network,
  AlertCircle,
  CheckCircle,
  Hash,
  Settings,
} from 'lucide-react'
import { toast } from 'sonner'

interface FirewallRule {
  id: string
  name: string
  action: 'ALLOW' | 'DENY'
  protocol: 'TCP' | 'UDP' | 'ICMP' | 'ALL'
  sourcePort?: string | null
  destPort?: string | null
  sourceIp: string
  destIp: string
  interface: string
  isEnabled: boolean
  priority: number
  description?: string | null
  handle?: number | null
  tableName: string
  family: string
  chainName: string
  ruleType: string
  packets: number
  bytes: number
  createdAt: string
}

interface NftablesTable {
  family: string
  name: string
  handle: number
  chains?: Array<{
    family: string
    table: string
    name: string
    handle: number
    type: string
    hook?: string
    priority: number
    policy: string
  }>
}

interface NftablesStatus {
  available: boolean
  version: string
  tables: NftablesTable[]
}

// Table family options
const FAMILY_OPTIONS = [
  { value: 'inet', label: 'inet (IPv4 + IPv6)' },
  { value: 'ip', label: 'ip (IPv4 only)' },
  { value: 'ip6', label: 'ip6 (IPv6 only)' },
]

// Table name options
const TABLE_OPTIONS = [
  { value: 'filter', label: 'filter (Packet filtering)' },
  { value: 'nat', label: 'nat (Network Address Translation)' },
  { value: 'mangle', label: 'mangle (Packet manipulation)' },
  { value: 'raw', label: 'raw (Before connection tracking)' },
]

// Chain options based on table
const getChainOptions = (tableName: string) => {
  if (tableName === 'filter') {
    return [
      { value: 'input', label: 'input (Incoming packets)' },
      { value: 'output', label: 'output (Outgoing packets)' },
      { value: 'forward', label: 'forward (Forwarded packets)' },
    ]
  }
  if (tableName === 'nat') {
    return [
      { value: 'prerouting', label: 'prerouting (DNAT, before routing)' },
      { value: 'postrouting', label: 'postrouting (SNAT, after routing)' },
      { value: 'output', label: 'output (Local generated)' },
    ]
  }
  return [
    { value: 'prerouting', label: 'prerouting' },
    { value: 'postrouting', label: 'postrouting' },
    { value: 'output', label: 'output' },
    { value: 'input', label: 'input' },
    { value: 'forward', label: 'forward' },
  ]
}

// Rule type options
const RULE_TYPE_OPTIONS = [
  { value: 'filter', label: 'Filter Rule' },
  { value: 'nat', label: 'NAT Rule' },
  { value: 'forward', label: 'Forward Rule' },
]

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Format number with commas
function formatNumber(num: number): string {
  return num.toLocaleString()
}

export function FirewallRulesContent() {
  const [rules, setRules] = useState<FirewallRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [showNatDialog, setShowNatDialog] = useState(false)
  const [editingRule, setEditingRule] = useState<FirewallRule | null>(null)
  const [saving, setSaving] = useState(false)
  const [nftStatus, setNftStatus] = useState<NftablesStatus | null>(null)
  const [activeTab, setActiveTab] = useState('filter')
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
    tableName: 'filter',
    family: 'inet',
    chainName: 'input',
    ruleType: 'filter',
  })
  const [natFormData, setNatFormData] = useState({
    name: '',
    type: 'SNAT' as 'SNAT' | 'DNAT' | 'MASQUERADE',
    sourceIp: '0.0.0.0/0',
    destIp: '0.0.0.0/0',
    translatedIp: '',
    translatedPort: '',
    protocol: 'TCP' as 'TCP' | 'UDP',
    interface: 'eth0',
    description: '',
    family: 'inet',
  })

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/firewall/rules')
      if (response.ok) {
        const data = await response.json()
        setRules(data.rules || [])
        // Set nftables status asynchronously
        if (data.nftables) {
          Promise.resolve(data.nftables.available).then(available => {
            Promise.resolve(data.nftables.version).then(version => {
              setNftStatus({
                available,
                version,
                tables: data.nftables.tables || [],
              })
            })
          })
        }
      }
    } catch (error) {
      console.error('Failed to fetch firewall rules:', error)
    } finally {
      setLoading(false)
    }
  }

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
      tableName: 'filter',
      family: 'inet',
      chainName: 'input',
      ruleType: 'filter',
    })
    setShowDialog(true)
  }

  const openNatDialog = () => {
    setNatFormData({
      name: '',
      type: 'SNAT',
      sourceIp: '0.0.0.0/0',
      destIp: '0.0.0.0/0',
      translatedIp: '',
      translatedPort: '',
      protocol: 'TCP',
      interface: 'eth0',
      description: '',
      family: 'inet',
    })
    setShowNatDialog(true)
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
      tableName: rule.tableName || 'filter',
      family: rule.family || 'inet',
      chainName: rule.chainName || 'input',
      ruleType: rule.ruleType || 'filter',
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
        const result = await response.json()
        toast.success(editingRule ? 'Rule updated' : 'Rule created')
        if (result.nftablesApplied === false) {
          toast.warning('Rule saved but not applied to nftables')
        }
        setShowDialog(false)
        fetchRules()
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

  const handleSaveNat = async () => {
    if (!natFormData.name || !natFormData.translatedIp) {
      toast.error('Name and translated IP are required')
      return
    }

    setSaving(true)
    try {
      // Create NAT rule
      const response = await fetch('/api/firewall/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: natFormData.name,
          action: natFormData.type === 'DNAT' ? 'DNAT' : 'ACCEPT',
          protocol: natFormData.protocol,
          sourceIp: natFormData.sourceIp,
          destIp: natFormData.destIp,
          destPort: natFormData.translatedPort || undefined,
          interface: natFormData.interface,
          description: natFormData.description,
          tableName: 'nat',
          family: natFormData.family,
          chainName: natFormData.type === 'DNAT' ? 'prerouting' : 'postrouting',
          ruleType: 'nat',
          isEnabled: true,
        }),
      })

      if (response.ok) {
        toast.success('NAT rule created')
        setShowNatDialog(false)
        fetchRules()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create NAT rule')
      }
    } catch (error) {
      toast.error('Failed to create NAT rule')
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
        fetchRules()
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
        fetchRules()
      }
    } catch (error) {
      toast.error('Failed to toggle rule')
    }
  }

  const handleMoveUp = async (rule: FirewallRule, index: number) => {
    if (index === 0) return
    try {
      const response = await fetch(`/api/firewall/rules/${rule.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: 'up' }),
      })
      if (response.ok) {
        fetchRules()
      }
    } catch (error) {
      toast.error('Failed to move rule')
    }
  }

  const handleMoveDown = async (rule: FirewallRule, index: number) => {
    if (index === rules.length - 1) return
    try {
      const response = await fetch(`/api/firewall/rules/${rule.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: 'down' }),
      })
      if (response.ok) {
        fetchRules()
      }
    } catch (error) {
      toast.error('Failed to move rule')
    }
  }

  // Filter rules by type
  const filterRules = rules.filter(r => r.tableName !== 'nat')
  const natRules = rules.filter(r => r.tableName === 'nat' || r.ruleType === 'nat')
  const forwardRules = rules.filter(r => r.chainName === 'forward')

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Flame className="h-6 w-6 text-orange-500" />
            Firewall Rules
          </h1>
          <p className="text-muted-foreground">
            Manage nftables v1.1.3 rules for Debian 13
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchRules} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={openNatDialog}>
            <Network className="h-4 w-4 mr-2" />
            Add NAT
          </Button>
          <Button size="sm" onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
          </Button>
        </div>
      </div>

      {/* nftables Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Server className="h-4 w-4" />
            nftables Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              {nftStatus?.available ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
              <span className="text-sm">
                {nftStatus?.available ? `nftables v${nftStatus.version}` : 'nftables not available (demo mode)'}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">{rules.length}</span> rules configured
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">{rules.filter(r => r.handle).length}</span> active in kernel
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{rules.filter(r => r.action === 'ALLOW' && r.isEnabled).length}</div>
                <p className="text-xs text-muted-foreground">Allow Rules</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{rules.filter(r => r.action === 'DENY' && r.isEnabled).length}</div>
                <p className="text-xs text-muted-foreground">Deny Rules</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <ToggleRight className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{rules.filter(r => r.isEnabled).length}</div>
                <p className="text-xs text-muted-foreground">Active Rules</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <ArrowRightLeft className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{natRules.length}</div>
                <p className="text-xs text-muted-foreground">NAT Rules</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="filter">
            <Shield className="h-4 w-4 mr-2" />
            Filter Rules
          </TabsTrigger>
          <TabsTrigger value="nat">
            <Network className="h-4 w-4 mr-2" />
            NAT Rules
          </TabsTrigger>
          <TabsTrigger value="forward">
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Forward Rules
          </TabsTrigger>
        </TabsList>

        {/* Filter Rules Tab */}
        <TabsContent value="filter" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Packet Filtering Rules</CardTitle>
              <CardDescription>
                Rules are processed in order. First matching rule wins.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="rounded-md border">
                  <ScrollArea className="max-h-[600px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Table/Chain</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Protocol</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Destination</TableHead>
                          <TableHead>Stats</TableHead>
                          <TableHead>Handle</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filterRules.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                              No filter rules configured. Click &quot;Add Rule&quot; to create one.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filterRules.map((rule, index) => (
                            <TableRow key={rule.id} className={!rule.isEnabled ? 'opacity-50' : ''}>
                              <TableCell className="text-muted-foreground font-mono">{index + 1}</TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{rule.name}</div>
                                  {rule.description && (
                                    <div className="text-xs text-muted-foreground">{rule.description}</div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-xs font-mono">
                                  <Badge variant="outline" className="mr-1">{rule.family}</Badge>
                                  <span>{rule.tableName}/{rule.chainName}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={rule.action === 'ALLOW' ? 'default' : 'destructive'}>
                                  {rule.action}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{rule.protocol}</Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {rule.sourceIp}
                                {rule.sourcePort && `:${rule.sourcePort}`}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {rule.destIp}
                                {rule.destPort && `:${rule.destPort}`}
                              </TableCell>
                              <TableCell className="text-xs">
                                <div>{formatNumber(rule.packets)} pkts</div>
                                <div className="text-muted-foreground">{formatBytes(rule.bytes)}</div>
                              </TableCell>
                              <TableCell>
                                {rule.handle ? (
                                  <Badge variant="secondary" className="font-mono">
                                    <Hash className="h-3 w-3 mr-1" />
                                    {rule.handle}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-xs">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant={rule.isEnabled ? 'default' : 'secondary'}>
                                  {rule.isEnabled ? 'Active' : 'Inactive'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => handleMoveUp(rule, index)} disabled={index === 0}>
                                    <ArrowUp className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleMoveDown(rule, index)} disabled={index === filterRules.length - 1}>
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
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* NAT Rules Tab */}
        <TabsContent value="nat" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>NAT Rules</CardTitle>
              <CardDescription>
                Network Address Translation rules for SNAT, DNAT, and Masquerade.
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
                        <TableHead>Family</TableHead>
                        <TableHead>Chain</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Interface</TableHead>
                        <TableHead>Handle</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {natRules.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                            No NAT rules configured. Click &quot;Add NAT&quot; to create one.
                          </TableCell>
                        </TableRow>
                      ) : (
                        natRules.map((rule) => (
                          <TableRow key={rule.id} className={!rule.isEnabled ? 'opacity-50' : ''}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{rule.name}</div>
                                {rule.description && (
                                  <div className="text-xs text-muted-foreground">{rule.description}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{rule.family}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {rule.tableName}/{rule.chainName}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{rule.sourceIp}</TableCell>
                            <TableCell className="font-mono text-xs">{rule.destIp}</TableCell>
                            <TableCell>{rule.interface}</TableCell>
                            <TableCell>
                              {rule.handle ? (
                                <Badge variant="secondary" className="font-mono">
                                  <Hash className="h-3 w-3 mr-1" />
                                  {rule.handle}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={rule.isEnabled ? 'default' : 'secondary'}>
                                {rule.isEnabled ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Forward Rules Tab */}
        <TabsContent value="forward" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Forward Rules</CardTitle>
              <CardDescription>
                Rules for packet forwarding between interfaces.
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
                        <TableHead>Family</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Interface</TableHead>
                        <TableHead>Stats</TableHead>
                        <TableHead>Handle</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {forwardRules.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                            No forward rules configured. Forward rules are auto-created for VPN traffic.
                          </TableCell>
                        </TableRow>
                      ) : (
                        forwardRules.map((rule) => (
                          <TableRow key={rule.id} className={!rule.isEnabled ? 'opacity-50' : ''}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{rule.name}</div>
                                {rule.description && (
                                  <div className="text-xs text-muted-foreground">{rule.description}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{rule.family}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={rule.action === 'ALLOW' ? 'default' : 'destructive'}>
                                {rule.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{rule.sourceIp}</TableCell>
                            <TableCell className="font-mono text-xs">{rule.destIp}</TableCell>
                            <TableCell>{rule.interface}</TableCell>
                            <TableCell className="text-xs">
                              <div>{formatNumber(rule.packets)} pkts</div>
                              <div className="text-muted-foreground">{formatBytes(rule.bytes)}</div>
                            </TableCell>
                            <TableCell>
                              {rule.handle ? (
                                <Badge variant="secondary" className="font-mono">
                                  <Hash className="h-3 w-3 mr-1" />
                                  {rule.handle}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={rule.isEnabled ? 'default' : 'secondary'}>
                                {rule.isEnabled ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Filter Rule Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Firewall Rule' : 'Add Firewall Rule'}</DialogTitle>
            <DialogDescription>Configure packet filtering rule for nftables</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Table/Chain Selection */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Family</Label>
                <Select value={formData.family} onValueChange={(v) => {
                  setFormData({ ...formData, family: v })
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FAMILY_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Table</Label>
                <Select value={formData.tableName} onValueChange={(v) => {
                  setFormData({ ...formData, tableName: v, chainName: getChainOptions(v)[0].value })
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TABLE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Chain</Label>
                <Select value={formData.chainName} onValueChange={(v) => setFormData({ ...formData, chainName: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getChainOptions(formData.tableName).map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

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

      {/* Add NAT Rule Dialog */}
      <Dialog open={showNatDialog} onOpenChange={setShowNatDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add NAT Rule</DialogTitle>
            <DialogDescription>Configure Network Address Translation</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rule Name</Label>
              <Input
                placeholder="e.g., VPN Masquerade"
                value={natFormData.name}
                onChange={(e) => setNatFormData({ ...natFormData, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>NAT Type</Label>
                <Select value={natFormData.type} onValueChange={(v: 'SNAT' | 'DNAT' | 'MASQUERADE') => setNatFormData({ ...natFormData, type: v })}>
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
                <Label>Family</Label>
                <Select value={natFormData.family} onValueChange={(v) => setNatFormData({ ...natFormData, family: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FAMILY_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Source IP</Label>
                <Input
                  placeholder="0.0.0.0/0"
                  value={natFormData.sourceIp}
                  onChange={(e) => setNatFormData({ ...natFormData, sourceIp: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Destination IP</Label>
                <Input
                  placeholder="0.0.0.0/0"
                  value={natFormData.destIp}
                  onChange={(e) => setNatFormData({ ...natFormData, destIp: e.target.value })}
                />
              </div>
            </div>

            {natFormData.type !== 'MASQUERADE' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Translated IP</Label>
                  <Input
                    placeholder="e.g., 192.168.1.1"
                    value={natFormData.translatedIp}
                    onChange={(e) => setNatFormData({ ...natFormData, translatedIp: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Translated Port</Label>
                  <Input
                    placeholder="Optional"
                    value={natFormData.translatedPort}
                    onChange={(e) => setNatFormData({ ...natFormData, translatedPort: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Protocol</Label>
                <Select value={natFormData.protocol} onValueChange={(v: 'TCP' | 'UDP') => setNatFormData({ ...natFormData, protocol: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TCP">TCP</SelectItem>
                    <SelectItem value="UDP">UDP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Interface</Label>
                <Select value={natFormData.interface} onValueChange={(v) => setNatFormData({ ...natFormData, interface: v })}>
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

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Optional description..."
                value={natFormData.description}
                onChange={(e) => setNatFormData({ ...natFormData, description: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNatDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveNat} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create NAT Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
