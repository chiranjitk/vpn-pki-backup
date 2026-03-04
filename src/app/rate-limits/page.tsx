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
import { Badge } from '@/components/ui/badge'
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
  Gauge,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Trash2,
  Edit,
  Loader2,
  Zap,
  Clock,
  Users,
  Globe,
  Activity,
  Ban,
  AlertCircle,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'

interface RateLimitConfig {
  id: string
  scope: 'GLOBAL' | 'VPN' | 'API' | 'PER_USER' | 'PER_IP'
  name: string
  requestsPerSecond: number | null
  requestsPerMinute: number | null
  requestsPerHour: number | null
  requestsPerDay: number | null
  burstSize: number | null
  burstWindow: number | null
  maxConnections: number | null
  maxConnectionsPerIp: number | null
  action: 'BLOCK' | 'THROTTLE' | 'LOG_ONLY' | 'CHALLENGE'
  blockDuration: number | null
  whitelistIps: string | null
  whitelistCountries: string | null
  isEnabled: boolean
  totalRequests: number
  totalBlocked: number
  lastBlockedAt: string | null
  createdAt: string
}

interface RateLimitSummary {
  total: number
  enabled: number
  disabled: number
  totalRequests: number
  totalBlocked: number
  byScope: Record<string, number>
  byAction: Record<string, number>
}

function RateLimitsContent() {
  const [configs, setConfigs] = useState<RateLimitConfig[]>([])
  const [summary, setSummary] = useState<RateLimitSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Form state
  const [formScope, setFormScope] = useState<'GLOBAL' | 'VPN' | 'API' | 'PER_USER' | 'PER_IP'>('GLOBAL')
  const [formName, setFormName] = useState('')
  const [formRps, setFormRps] = useState('')
  const [formRpm, setFormRpm] = useState('')
  const [formRph, setFormRph] = useState('')
  const [formRpd, setFormRpd] = useState('')
  const [formBurstSize, setFormBurstSize] = useState('')
  const [formBurstWindow, setFormBurstWindow] = useState('')
  const [formMaxConn, setFormMaxConn] = useState('')
  const [formMaxConnIp, setFormMaxConnIp] = useState('')
  const [formAction, setFormAction] = useState<'BLOCK' | 'THROTTLE' | 'LOG_ONLY' | 'CHALLENGE'>('BLOCK')
  const [formBlockDuration, setFormBlockDuration] = useState('')
  const [formWhitelistIps, setFormWhitelistIps] = useState('')
  const [formWhitelistCountries, setFormWhitelistCountries] = useState('')
  const [formEnabled, setFormEnabled] = useState(true)

  useEffect(() => {
    fetchConfigs()
  }, [])

  const fetchConfigs = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/rate-limits')
      if (response.ok) {
        const data = await response.json()
        setConfigs(data.configs || [])
        setSummary(data.summary || null)
      }
    } catch (error) {
      console.error('Failed to fetch rate limits:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formName) {
      toast.error('Name is required')
      return
    }

    // Check that at least one limit is set
    const hasLimit =
      formRps || formRpm || formRph || formRpd || formBurstSize || formMaxConn || formMaxConnIp

    if (!hasLimit) {
      toast.error('At least one rate limit must be specified')
      return
    }

    setSaving(true)
    try {
      const url = editingId ? `/api/rate-limits/${editingId}` : '/api/rate-limits'
      const method = editingId ? 'PUT' : 'POST'

      // Parse whitelist IPs (comma-separated)
      const whitelistIpsArray = formWhitelistIps
        ? formWhitelistIps.split(',').map((ip) => ip.trim()).filter(Boolean)
        : []

      // Parse whitelist countries (comma-separated)
      const whitelistCountriesArray = formWhitelistCountries
        ? formWhitelistCountries.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
        : []

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: formScope,
          name: formName,
          requestsPerSecond: formRps ? parseInt(formRps) : null,
          requestsPerMinute: formRpm ? parseInt(formRpm) : null,
          requestsPerHour: formRph ? parseInt(formRph) : null,
          requestsPerDay: formRpd ? parseInt(formRpd) : null,
          burstSize: formBurstSize ? parseInt(formBurstSize) : null,
          burstWindow: formBurstWindow ? parseInt(formBurstWindow) : null,
          maxConnections: formMaxConn ? parseInt(formMaxConn) : null,
          maxConnectionsPerIp: formMaxConnIp ? parseInt(formMaxConnIp) : null,
          action: formAction,
          blockDuration: formBlockDuration ? parseInt(formBlockDuration) : null,
          whitelistIps: whitelistIpsArray,
          whitelistCountries: whitelistCountriesArray,
          isEnabled: formEnabled,
        }),
      })

      if (response.ok) {
        toast.success(editingId ? 'Rate limit updated' : 'Rate limit created')
        setShowAddDialog(false)
        resetForm()
        fetchConfigs()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save')
      }
    } catch (error) {
      toast.error('Failed to save rate limit')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (config: RateLimitConfig) => {
    setEditingId(config.id)
    setFormScope(config.scope)
    setFormName(config.name)
    setFormRps(config.requestsPerSecond?.toString() || '')
    setFormRpm(config.requestsPerMinute?.toString() || '')
    setFormRph(config.requestsPerHour?.toString() || '')
    setFormRpd(config.requestsPerDay?.toString() || '')
    setFormBurstSize(config.burstSize?.toString() || '')
    setFormBurstWindow(config.burstWindow?.toString() || '')
    setFormMaxConn(config.maxConnections?.toString() || '')
    setFormMaxConnIp(config.maxConnectionsPerIp?.toString() || '')
    setFormAction(config.action)
    setFormBlockDuration(config.blockDuration?.toString() || '')

    // Parse JSON arrays for whitelists
    try {
      const ips = config.whitelistIps ? JSON.parse(config.whitelistIps) : []
      setFormWhitelistIps(Array.isArray(ips) ? ips.join(', ') : '')
    } catch {
      setFormWhitelistIps('')
    }
    try {
      const countries = config.whitelistCountries ? JSON.parse(config.whitelistCountries) : []
      setFormWhitelistCountries(Array.isArray(countries) ? countries.join(', ') : '')
    } catch {
      setFormWhitelistCountries('')
    }

    setFormEnabled(config.isEnabled)
    setShowAddDialog(true)
  }

  const handleDelete = async () => {
    if (!deleteId) return

    try {
      const response = await fetch(`/api/rate-limits/${deleteId}`, { method: 'DELETE' })
      if (response.ok) {
        toast.success('Rate limit deleted')
        fetchConfigs()
      }
    } catch (error) {
      toast.error('Failed to delete rate limit')
    } finally {
      setDeleteId(null)
    }
  }

  const handleToggle = async (id: string) => {
    try {
      const response = await fetch(`/api/rate-limits/${id}/toggle`, {
        method: 'PATCH',
      })
      if (response.ok) {
        toast.success('Rate limit toggled')
        fetchConfigs()
      }
    } catch (error) {
      toast.error('Failed to toggle rate limit')
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setFormScope('GLOBAL')
    setFormName('')
    setFormRps('')
    setFormRpm('')
    setFormRph('')
    setFormRpd('')
    setFormBurstSize('')
    setFormBurstWindow('')
    setFormMaxConn('')
    setFormMaxConnIp('')
    setFormAction('BLOCK')
    setFormBlockDuration('')
    setFormWhitelistIps('')
    setFormWhitelistCountries('')
    setFormEnabled(true)
  }

  const getScopeIcon = (scope: string) => {
    switch (scope) {
      case 'GLOBAL':
        return <Globe className="h-4 w-4" />
      case 'VPN':
        return <Shield className="h-4 w-4" />
      case 'API':
        return <Zap className="h-4 w-4" />
      case 'PER_USER':
        return <Users className="h-4 w-4" />
      case 'PER_IP':
        return <Activity className="h-4 w-4" />
      default:
        return <Gauge className="h-4 w-4" />
    }
  }

  const getActionBadge = (action: string) => {
    const variants: Record<string, { bg: string; text: string }> = {
      BLOCK: { bg: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400', text: 'Block' },
      THROTTLE: {
        bg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
        text: 'Throttle',
      },
      LOG_ONLY: {
        bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
        text: 'Log Only',
      },
      CHALLENGE: {
        bg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
        text: 'Challenge',
      },
    }
    const variant = variants[action] || variants.BLOCK
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${variant.bg}`}>
        {variant.text}
      </span>
    )
  }

  const formatLimits = (config: RateLimitConfig) => {
    const limits: string[] = []
    if (config.requestsPerSecond) limits.push(`${config.requestsPerSecond}/s`)
    if (config.requestsPerMinute) limits.push(`${config.requestsPerMinute}/m`)
    if (config.requestsPerHour) limits.push(`${config.requestsPerHour}/h`)
    if (config.requestsPerDay) limits.push(`${config.requestsPerDay}/d`)
    if (config.burstSize) limits.push(`burst:${config.burstSize}`)
    if (config.maxConnections) limits.push(`conn:${config.maxConnections}`)
    return limits.length > 0 ? limits.join(', ') : '-'
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-muted-foreground" />
                <div className="text-2xl font-bold">{summary.total}</div>
              </div>
              <p className="text-xs text-muted-foreground">Total Rules</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-green-500" />
                <div className="text-2xl font-bold text-green-500">{summary.enabled}</div>
              </div>
              <p className="text-xs text-muted-foreground">Enabled</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Ban className="h-5 w-5 text-muted-foreground" />
                <div className="text-2xl font-bold">{summary.disabled}</div>
              </div>
              <p className="text-xs text-muted-foreground">Disabled</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-500" />
                <div className="text-2xl font-bold text-blue-500">
                  {summary.totalRequests.toLocaleString()}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Total Requests</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-red-500" />
                <div className="text-2xl font-bold text-red-500">
                  {summary.totalBlocked.toLocaleString()}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Total Blocked</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rate Limits List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Rate Limiting Configuration</CardTitle>
              <CardDescription>
                Configure rate limits for VPN connections, API requests, and user activity
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                resetForm()
                setShowAddDialog(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Gauge className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No rate limit configurations</p>
              <p className="text-sm">Add rules to protect your system from abuse</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scope</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Limits</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Stats</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getScopeIcon(config.scope)}
                          <span className="font-medium">{config.scope.replace('_', ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{config.name}</p>
                          {config.blockDuration && (
                            <p className="text-xs text-muted-foreground">
                              Block for {config.blockDuration}s
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1 rounded">{formatLimits(config)}</code>
                      </TableCell>
                      <TableCell>{getActionBadge(config.action)}</TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <p>
                            <span className="text-muted-foreground">Requests:</span>{' '}
                            {config.totalRequests.toLocaleString()}
                          </p>
                          <p>
                            <span className="text-muted-foreground">Blocked:</span>{' '}
                            <span className={config.totalBlocked > 0 ? 'text-red-500' : ''}>
                              {config.totalBlocked.toLocaleString()}
                            </span>
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={config.isEnabled}
                          onCheckedChange={() => handleToggle(config.id)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(config)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteId(config.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Rate Limit' : 'Add Rate Limit'}</DialogTitle>
            <DialogDescription>
              Configure rate limiting rules to protect your system from abuse
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Basic Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Gauge className="h-4 w-4" />
                Basic Settings
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Scope</Label>
                  <Select value={formScope} onValueChange={(v) => setFormScope(v as typeof formScope)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GLOBAL">Global</SelectItem>
                      <SelectItem value="VPN">VPN</SelectItem>
                      <SelectItem value="API">API</SelectItem>
                      <SelectItem value="PER_USER">Per User</SelectItem>
                      <SelectItem value="PER_IP">Per IP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    placeholder="e.g., API Rate Limit"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Rate Limits */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Rate Limits
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Requests/Second</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 10"
                    value={formRps}
                    onChange={(e) => setFormRps(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Requests/Minute</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 100"
                    value={formRpm}
                    onChange={(e) => setFormRpm(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Requests/Hour</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 1000"
                    value={formRph}
                    onChange={(e) => setFormRph(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Requests/Day</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 10000"
                    value={formRpd}
                    onChange={(e) => setFormRpd(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Burst & Connections */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Burst & Connections
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Burst Size</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 20"
                    value={formBurstSize}
                    onChange={(e) => setFormBurstSize(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Burst Window (s)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 60"
                    value={formBurstWindow}
                    onChange={(e) => setFormBurstWindow(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Connections</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 100"
                    value={formMaxConn}
                    onChange={(e) => setFormMaxConn(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Conn/IP</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 5"
                    value={formMaxConnIp}
                    onChange={(e) => setFormMaxConnIp(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Action Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Action Settings
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Action</Label>
                  <Select value={formAction} onValueChange={(v) => setFormAction(v as typeof formAction)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BLOCK">Block</SelectItem>
                      <SelectItem value="THROTTLE">Throttle</SelectItem>
                      <SelectItem value="LOG_ONLY">Log Only</SelectItem>
                      <SelectItem value="CHALLENGE">Challenge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Block Duration (seconds)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 300"
                    value={formBlockDuration}
                    onChange={(e) => setFormBlockDuration(e.target.value)}
                    disabled={formAction !== 'BLOCK'}
                  />
                </div>
              </div>
            </div>

            {/* Whitelists */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Whitelists
              </h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Whitelist IPs (comma-separated)</Label>
                  <Input
                    placeholder="e.g., 192.168.1.1, 10.0.0.0/8"
                    value={formWhitelistIps}
                    onChange={(e) => setFormWhitelistIps(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    IPs and CIDR ranges that bypass rate limiting
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Whitelist Countries (comma-separated)</Label>
                  <Input
                    placeholder="e.g., US, GB, DE"
                    value={formWhitelistCountries}
                    onChange={(e) => setFormWhitelistCountries(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    ISO country codes that bypass rate limiting
                  </p>
                </div>
              </div>
            </div>

            {/* Enable */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Enabled</Label>
                <p className="text-xs text-muted-foreground">Activate this rate limit rule</p>
              </div>
              <Switch checked={formEnabled} onCheckedChange={setFormEnabled} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rate Limit</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this rate limit configuration? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function RateLimitsPage() {
  return (
    <AppLayout>
      <RateLimitsContent />
    </AppLayout>
  )
}
