'use client'

import { useState, useEffect } from 'react'
import {
<<<<<<< HEAD
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
=======
  Card, CardContent, CardDescription, CardHeader, CardTitle,
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
<<<<<<< HEAD
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
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
  Shield,
  Server,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  Edit,
  Send,
  Download,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
=======
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Shield, Server, Activity, AlertTriangle, CheckCircle2, Loader2, Plus, Trash2, Edit, Send, Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { Separator } from '@/components/ui/separator'
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124

interface SiemConfig {
  id: string
  siemType: string
  endpointUrl: string | null
  syslogHost: string | null
  syslogPort: number
  syslogProtocol: string
  logFormat: string
  logAuthentication: boolean
  logCertificates: boolean
  logVpnSessions: boolean
  logAdminActions: boolean
  logSecurityEvents: boolean
  isEnabled: boolean
  lastSyncAt: string | null
  lastSyncSuccess: boolean | null
  eventsSent: number
}

const SIEM_TYPES = [
  { value: 'SPLUNK', label: 'Splunk', description: 'HTTP Event Collector (HEC)' },
  { value: 'ELK_STACK', label: 'ELK Stack', description: 'Elasticsearch bulk API' },
  { value: 'QRADAR', label: 'IBM QRadar', description: 'REST API integration' },
  { value: 'ARCSIGHT', label: 'ArcSight', description: 'CEF format' },
  { value: 'SENTINEL_ONE', label: 'SentinelOne', description: 'API integration' },
  { value: 'MICROSOFT_SENTINEL', label: 'Microsoft Sentinel', description: 'Azure Log Analytics' },
  { value: 'SYSLOG', label: 'Syslog', description: 'Standard syslog' },
  { value: 'CUSTOM_API', label: 'Custom API', description: 'Generic HTTP endpoint' },
]

export function SiemIntegrationSettings() {
  const [configs, setConfigs] = useState<SiemConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

<<<<<<< HEAD
  // Form state
  const [formData, setFormData] = useState({
    siemType: 'SPLUNK',
    endpointUrl: '',
    apiToken: '',
    syslogHost: '',
    syslogPort: 514,
    syslogProtocol: 'UDP',
    logFormat: 'JSON',
    logAuthentication: true,
    logCertificates: true,
    logVpnSessions: true,
    logAdminActions: true,
    logSecurityEvents: true,
    isEnabled: false,
  })

  useEffect(() => {
    fetchConfigs()
  }, [])
=======
  const [formData, setFormData] = useState({
    siemType: 'SPLUNK', endpointUrl: '', apiToken: '',
    syslogHost: '', syslogPort: 514, syslogProtocol: 'UDP',
    logFormat: 'JSON', logAuthentication: true, logCertificates: true,
    logVpnSessions: true, logAdminActions: true, logSecurityEvents: true,
    isEnabled: false,
  })

  useEffect(() => { fetchConfigs() }, [])
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124

  const fetchConfigs = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/siem')
      if (response.ok) {
        const data = await response.json()
        setConfigs(data.configs || [])
      }
    } catch (error) {
      console.error('Failed to fetch SIEM configs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const url = editingId ? `/api/siem/${editingId}` : '/api/siem'
      const method = editingId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success(editingId ? 'SIEM config updated' : 'SIEM config created')
        setShowAddDialog(false)
        resetForm()
        fetchConfigs()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save')
      }
    } catch (error) {
      toast.error('Failed to save SIEM config')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async (id: string) => {
    setTesting(id)
    try {
      const response = await fetch('/api/siem/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId: id }),
      })
      if (response.ok) {
        const data = await response.json()
        toast.success(`Connection successful (${data.latency}ms)`)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Connection failed')
      }
    } catch (error) {
      toast.error('Connection test failed')
    } finally {
      setTesting(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this SIEM configuration?')) return
<<<<<<< HEAD

=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
    try {
      const response = await fetch(`/api/siem/${id}`, { method: 'DELETE' })
      if (response.ok) {
        toast.success('SIEM config deleted')
        fetchConfigs()
      }
    } catch (error) {
      toast.error('Failed to delete SIEM config')
    }
  }

  const handleExport = async (format: string) => {
    setExporting(true)
    try {
      const response = await fetch(`/api/siem/export?format=${format}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `siem-export-${new Date().toISOString().split('T')[0]}.${format.toLowerCase()}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        toast.success('Export downloaded')
      }
    } catch (error) {
      toast.error('Failed to export logs')
    } finally {
      setExporting(false)
    }
  }

<<<<<<< HEAD
  const handleSendPending = async () => {
    try {
      const response = await fetch('/api/siem/events', { method: 'POST' })
      if (response.ok) {
        const data = await response.json()
        toast.success(`Sent ${data.sent} events`)
        fetchConfigs()
      }
    } catch (error) {
      toast.error('Failed to send events')
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setFormData({
      siemType: 'SPLUNK',
      endpointUrl: '',
      apiToken: '',
      syslogHost: '',
      syslogPort: 514,
      syslogProtocol: 'UDP',
      logFormat: 'JSON',
      logAuthentication: true,
      logCertificates: true,
      logVpnSessions: true,
      logAdminActions: true,
      logSecurityEvents: true,
=======
  const resetForm = () => {
    setEditingId(null)
    setFormData({
      siemType: 'SPLUNK', endpointUrl: '', apiToken: '',
      syslogHost: '', syslogPort: 514, syslogProtocol: 'UDP',
      logFormat: 'JSON', logAuthentication: true, logCertificates: true,
      logVpnSessions: true, logAdminActions: true, logSecurityEvents: true,
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
      isEnabled: false,
    })
  }

  const editConfig = (config: SiemConfig) => {
    setEditingId(config.id)
    setFormData({
      siemType: config.siemType,
      endpointUrl: config.endpointUrl || '',
      apiToken: '',
      syslogHost: config.syslogHost || '',
      syslogPort: config.syslogPort,
      syslogProtocol: config.syslogProtocol,
      logFormat: config.logFormat,
      logAuthentication: config.logAuthentication,
      logCertificates: config.logCertificates,
      logVpnSessions: config.logVpnSessions,
      logAdminActions: config.logAdminActions,
      logSecurityEvents: config.logSecurityEvents,
      isEnabled: config.isEnabled,
    })
    setShowAddDialog(true)
  }

  const needsSyslog = formData.siemType === 'SYSLOG'
  const needsApi = formData.siemType !== 'SYSLOG'

  return (
    <div className="space-y-6">
<<<<<<< HEAD
      {/* Header */}
=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">SIEM Integration</h2>
          <p className="text-muted-foreground">Send security events to your SIEM platform</p>
        </div>
        <div className="flex gap-2">
<<<<<<< HEAD
          <Button variant="outline" onClick={handleSendPending}>
            <Send className="mr-2 h-4 w-4" />
            Send Pending
          </Button>
          <Button onClick={() => { resetForm(); setShowAddDialog(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add SIEM
=======
          <Button onClick={() => { resetForm(); setShowAddDialog(true); }}>
            <Plus className="mr-2 h-4 w-4" />Add SIEM
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
          </Button>
        </div>
      </div>

<<<<<<< HEAD
      {/* Config List */}
=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
      <Card>
        <CardHeader>
          <CardTitle>Configured SIEM Systems</CardTitle>
          <CardDescription>Manage your SIEM integrations</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
<<<<<<< HEAD
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
=======
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
          ) : configs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No SIEM configurations</p>
              <p className="text-sm">Add a SIEM to forward security events</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Endpoint/Host</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Events Sent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((config) => {
                    const siemType = SIEM_TYPES.find(t => t.value === config.siemType)
                    return (
                      <TableRow key={config.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{siemType?.label || config.siemType}</div>
                            <div className="text-xs text-muted-foreground">{siemType?.description}</div>
                          </div>
                        </TableCell>
<<<<<<< HEAD
                        <TableCell>
                          <code className="text-sm">{config.endpointUrl || config.syslogHost}</code>
                        </TableCell>
=======
                        <TableCell><code className="text-sm">{config.endpointUrl || config.syslogHost}</code></TableCell>
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
                        <TableCell>{config.logFormat}</TableCell>
                        <TableCell>{config.eventsSent.toLocaleString()}</TableCell>
                        <TableCell>
                          {config.isEnabled ? (
                            <span className="inline-flex items-center gap-1 text-green-600">
<<<<<<< HEAD
                              <CheckCircle2 className="h-4 w-4" />
                              Active
=======
                              <CheckCircle2 className="h-4 w-4" />Active
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Disabled</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleTest(config.id)} disabled={testing === config.id}>
                              {testing === config.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                            </Button>
<<<<<<< HEAD
                            <Button variant="ghost" size="sm" onClick={() => editConfig(config)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(config.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
=======
                            <Button variant="ghost" size="sm" onClick={() => editConfig(config)}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(config.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

<<<<<<< HEAD
      {/* Export Options */}
=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
      <Card>
        <CardHeader>
          <CardTitle>Export Logs</CardTitle>
          <CardDescription>Download logs in various formats</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => handleExport('json')} disabled={exporting}>
<<<<<<< HEAD
              <Download className="mr-2 h-4 w-4" />
              JSON
            </Button>
            <Button variant="outline" onClick={() => handleExport('csv')} disabled={exporting}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
            <Button variant="outline" onClick={() => handleExport('cef')} disabled={exporting}>
              <Download className="mr-2 h-4 w-4" />
              CEF
            </Button>
            <Button variant="outline" onClick={() => handleExport('leef')} disabled={exporting}>
              <Download className="mr-2 h-4 w-4" />
              LEEF
=======
              <Download className="mr-2 h-4 w-4" />JSON
            </Button>
            <Button variant="outline" onClick={() => handleExport('csv')} disabled={exporting}>
              <Download className="mr-2 h-4 w-4" />CSV
            </Button>
            <Button variant="outline" onClick={() => handleExport('cef')} disabled={exporting}>
              <Download className="mr-2 h-4 w-4" />CEF
            </Button>
            <Button variant="outline" onClick={() => handleExport('leef')} disabled={exporting}>
              <Download className="mr-2 h-4 w-4" />LEEF
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
            </Button>
          </div>
        </CardContent>
      </Card>

<<<<<<< HEAD
      {/* Add/Edit Dialog */}
=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit SIEM Configuration' : 'Add SIEM Configuration'}</DialogTitle>
            <DialogDescription>Configure integration with your SIEM platform</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>SIEM Type</Label>
              <Select value={formData.siemType} onValueChange={(v) => setFormData({ ...formData, siemType: v })}>
<<<<<<< HEAD
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
=======
                <SelectTrigger><SelectValue /></SelectTrigger>
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
                <SelectContent>
                  {SIEM_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <div>{type.label}</div>
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsApi && (
              <>
                <div className="space-y-2">
                  <Label>Endpoint URL</Label>
<<<<<<< HEAD
                  <Input
                    placeholder="https://siem.example.com/api/events"
                    value={formData.endpointUrl}
                    onChange={(e) => setFormData({ ...formData, endpointUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>API Token</Label>
                  <Input
                    type="password"
                    placeholder="Enter API token"
                    value={formData.apiToken}
                    onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })}
                  />
=======
                  <Input placeholder="https://siem.example.com/api/events" value={formData.endpointUrl} onChange={(e) => setFormData({ ...formData, endpointUrl: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>API Token</Label>
                  <Input type="password" placeholder="Enter API token" value={formData.apiToken} onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })} />
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
                </div>
              </>
            )}

            {needsSyslog && (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Syslog Host</Label>
<<<<<<< HEAD
                  <Input
                    placeholder="syslog.example.com"
                    value={formData.syslogHost}
                    onChange={(e) => setFormData({ ...formData, syslogHost: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={formData.syslogPort}
                    onChange={(e) => setFormData({ ...formData, syslogPort: parseInt(e.target.value) || 514 })}
                  />
=======
                  <Input placeholder="syslog.example.com" value={formData.syslogHost} onChange={(e) => setFormData({ ...formData, syslogHost: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input type="number" value={formData.syslogPort} onChange={(e) => setFormData({ ...formData, syslogPort: parseInt(e.target.value) || 514 })} />
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Log Format</Label>
              <Select value={formData.logFormat} onValueChange={(v) => setFormData({ ...formData, logFormat: v })}>
<<<<<<< HEAD
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
=======
                <SelectTrigger><SelectValue /></SelectTrigger>
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
                <SelectContent>
                  <SelectItem value="JSON">JSON</SelectItem>
                  <SelectItem value="CEF">CEF (ArcSight)</SelectItem>
                  <SelectItem value="LEEF">LEEF (QRadar)</SelectItem>
                  <SelectItem value="SYSLOG">Syslog</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />
<<<<<<< HEAD

=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
            <Label>Log Categories</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Authentication Events</Label>
                <Switch checked={formData.logAuthentication} onCheckedChange={(v) => setFormData({ ...formData, logAuthentication: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Certificate Events</Label>
                <Switch checked={formData.logCertificates} onCheckedChange={(v) => setFormData({ ...formData, logCertificates: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">VPN Sessions</Label>
                <Switch checked={formData.logVpnSessions} onCheckedChange={(v) => setFormData({ ...formData, logVpnSessions: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Admin Actions</Label>
                <Switch checked={formData.logAdminActions} onCheckedChange={(v) => setFormData({ ...formData, logAdminActions: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Security Events</Label>
                <Switch checked={formData.logSecurityEvents} onCheckedChange={(v) => setFormData({ ...formData, logSecurityEvents: v })} />
              </div>
            </div>

            <Separator />
<<<<<<< HEAD

=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
            <div className="flex items-center justify-between">
              <Label>Enable Integration</Label>
              <Switch checked={formData.isEnabled} onCheckedChange={(v) => setFormData({ ...formData, isEnabled: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
