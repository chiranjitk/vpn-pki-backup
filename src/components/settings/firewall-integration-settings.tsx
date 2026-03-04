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
  RefreshCw,
  Zap,
  Globe,
} from 'lucide-react'
import { toast } from 'sonner'

interface FirewallConfig {
  id: string
  firewallType: string
  apiUrl: string
  apiUsername: string | null
  panDeviceGroup: string | null
  panVsys: string
  vpnZoneName: string
  vpnInterface: string
  vpnSubnet: string | null
  autoCreateZone: boolean
  autoCreatePolicy: boolean
  syncVpnSubnets: boolean
  syncUserGroups: boolean
  isEnabled: boolean
  lastSyncAt: string | null
  lastSyncSuccess: boolean | null
  lastSyncError: string | null
}

const FIREWALL_TYPES = [
  { value: 'PALO_ALTO', label: 'Palo Alto Networks', description: 'PAN-OS REST API' },
  { value: 'FORTINET', label: 'Fortinet FortiGate', description: 'FortiOS REST API' },
  { value: 'CISCO_ASA', label: 'Cisco ASA', description: 'Cisco REST API' },
  { value: 'CHECKPOINT', label: 'Check Point', description: 'Management API' },
  { value: 'JUNIPER', label: 'Juniper SRX', description: 'Junos REST API' },
  { value: 'SONICWALL', label: 'SonicWall', description: 'SONICOS API' },
  { value: 'CUSTOM', label: 'Custom', description: 'Generic REST API' },
]

export function FirewallIntegrationSettings() {
  const [configs, setConfigs] = useState<FirewallConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    firewallType: 'PALO_ALTO',
    apiUrl: '',
    apiKey: '',
    apiUsername: '',
    apiPassword: '',
    panDeviceGroup: '',
    panVsys: 'vsys1',
    vpnZoneName: 'vpn-zone',
    vpnInterface: 'tunnel.1',
    vpnSubnet: '',
    autoCreateZone: true,
    autoCreatePolicy: false,
    syncVpnSubnets: true,
    syncUserGroups: false,
    isEnabled: false,
  })

  useEffect(() => {
    fetchConfigs()
  }, [])

  const fetchConfigs = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/firewall')
      if (response.ok) {
        const data = await response.json()
        setConfigs(data.configs || [])
      }
    } catch (error) {
      console.error('Failed to fetch firewall configs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formData.apiUrl) {
      toast.error('API URL is required')
      return
    }

    setSaving(true)
    try {
      const url = editingId ? `/api/firewall/${editingId}` : '/api/firewall'
      const method = editingId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success(editingId ? 'Firewall config updated' : 'Firewall config created')
        setShowAddDialog(false)
        resetForm()
        fetchConfigs()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save')
      }
    } catch (error) {
      toast.error('Failed to save firewall config')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async (id: string) => {
    setTesting(id)
    try {
      const response = await fetch(`/api/firewall/${id}/test`, { method: 'POST' })
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

  const handleSync = async (id: string, syncType: string = 'FULL_SYNC') => {
    setSyncing(id)
    try {
      const response = await fetch(`/api/firewall/${id}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncType }),
      })
      if (response.ok) {
        const data = await response.json()
        toast.success(`Sync completed: ${data.results?.length || 0} items synced`)
        fetchConfigs()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Sync failed')
      }
    } catch (error) {
      toast.error('Sync failed')
    } finally {
      setSyncing(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this firewall configuration?')) return

    try {
      const response = await fetch(`/api/firewall/${id}`, { method: 'DELETE' })
      if (response.ok) {
        toast.success('Firewall config deleted')
        fetchConfigs()
      }
    } catch (error) {
      toast.error('Failed to delete firewall config')
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setFormData({
      firewallType: 'PALO_ALTO',
      apiUrl: '',
      apiKey: '',
      apiUsername: '',
      apiPassword: '',
      panDeviceGroup: '',
      panVsys: 'vsys1',
      vpnZoneName: 'vpn-zone',
      vpnInterface: 'tunnel.1',
      vpnSubnet: '',
      autoCreateZone: true,
      autoCreatePolicy: false,
      syncVpnSubnets: true,
      syncUserGroups: false,
      isEnabled: false,
    })
  }

  const editConfig = (config: FirewallConfig) => {
    setEditingId(config.id)
    setFormData({
      firewallType: config.firewallType,
      apiUrl: config.apiUrl,
      apiKey: '',
      apiUsername: config.apiUsername || '',
      apiPassword: '',
      panDeviceGroup: config.panDeviceGroup || '',
      panVsys: config.panVsys,
      vpnZoneName: config.vpnZoneName,
      vpnInterface: config.vpnInterface,
      vpnSubnet: config.vpnSubnet || '',
      autoCreateZone: config.autoCreateZone,
      autoCreatePolicy: config.autoCreatePolicy,
      syncVpnSubnets: config.syncVpnSubnets,
      syncUserGroups: config.syncUserGroups,
      isEnabled: config.isEnabled,
    })
    setShowAddDialog(true)
  }

  const isPaloAlto = formData.firewallType === 'PALO_ALTO'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Firewall Integration</h2>
          <p className="text-muted-foreground">Sync VPN zones and policies with your firewall</p>
        </div>
        <Button onClick={() => { resetForm(); setShowAddDialog(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Firewall
        </Button>
      </div>

      {/* Palo Alto Quick Setup */}
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Palo Alto Integration Guide
          </CardTitle>
          <CardDescription>Configure your Palo Alto firewall for VPN zone integration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">1. Create VPN Zone</h4>
              <ul className="text-muted-foreground space-y-1">
                <li>• Network → Zones → Add</li>
                <li>• Name: vpn-zone</li>
                <li>• Type: Layer3</li>
                <li>• Enable User-ID</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">2. Create Tunnel Interface</h4>
              <ul className="text-muted-foreground space-y-1">
                <li>• Network → Interfaces → Tunnel</li>
                <li>• Name: tunnel.1</li>
                <li>• Zone: vpn-zone</li>
                <li>• IP: 10.70.0.1/24</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">3. Generate API Key</h4>
              <ul className="text-muted-foreground space-y-1">
                <li>• Create dedicated admin user</li>
                <li>• Assign superuser role</li>
                <li>• Generate API key via CLI</li>
                <li>• <code className="text-xs">curl -k "https://FW/api/?type=keygen&amp;user=x&amp;password=x"</code></li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Config List */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Firewalls</CardTitle>
          <CardDescription>Manage firewall integrations for VPN zone sync</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No firewall configurations</p>
              <p className="text-sm">Add a firewall to sync VPN zones and policies</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>API URL</TableHead>
                    <TableHead>VPN Zone</TableHead>
                    <TableHead>Sync Status</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((config) => {
                    const fwType = FIREWALL_TYPES.find(t => t.value === config.firewallType)
                    return (
                      <TableRow key={config.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{fwType?.label || config.firewallType}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-sm">{config.apiUrl}</code>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div>{config.vpnZoneName}</div>
                            <div className="text-xs text-muted-foreground">{config.vpnInterface}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {config.lastSyncAt ? (
                            <div>
                              <div className="flex items-center gap-1">
                                {config.lastSyncSuccess ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                                )}
                                <span>{config.lastSyncSuccess ? 'Success' : 'Failed'}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(config.lastSyncAt).toLocaleString()}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Never synced</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {config.isEnabled ? (
                            <span className="inline-flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="h-4 w-4" />
                              Active
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
                            <Button variant="ghost" size="sm" onClick={() => handleSync(config.id)} disabled={syncing === config.id}>
                              {syncing === config.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => editConfig(config)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(config.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Firewall Configuration' : 'Add Firewall Configuration'}</DialogTitle>
            <DialogDescription>Configure firewall integration for VPN zone sync</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Firewall Type</Label>
              <Select value={formData.firewallType} onValueChange={(v) => setFormData({ ...formData, firewallType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIREWALL_TYPES.map((type) => (
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

            <div className="space-y-2">
              <Label>API URL</Label>
              <Input
                placeholder="https://firewall.example.com/api"
                value={formData.apiUrl}
                onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  placeholder="Enter API key"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Username (optional)</Label>
                <Input
                  value={formData.apiUsername}
                  onChange={(e) => setFormData({ ...formData, apiUsername: e.target.value })}
                />
              </div>
            </div>

            {isPaloAlto && (
              <>
                <Separator />
                <Label>Palo Alto Specific Settings</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Device Group</Label>
                    <Input
                      placeholder="e.g., shared"
                      value={formData.panDeviceGroup}
                      onChange={(e) => setFormData({ ...formData, panDeviceGroup: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Virtual System</Label>
                    <Input
                      value={formData.panVsys}
                      onChange={(e) => setFormData({ ...formData, panVsys: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            <Separator />
            <Label>VPN Zone Settings</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Zone Name</Label>
                <Input
                  value={formData.vpnZoneName}
                  onChange={(e) => setFormData({ ...formData, vpnZoneName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Interface</Label>
                <Input
                  value={formData.vpnInterface}
                  onChange={(e) => setFormData({ ...formData, vpnInterface: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>VPN Subnet</Label>
              <Input
                placeholder="10.70.0.0/24"
                value={formData.vpnSubnet}
                onChange={(e) => setFormData({ ...formData, vpnSubnet: e.target.value })}
              />
            </div>

            <Separator />
            <Label>Sync Options</Label>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Auto-create Zone</Label>
                <Switch checked={formData.autoCreateZone} onCheckedChange={(v) => setFormData({ ...formData, autoCreateZone: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Auto-create Policy</Label>
                <Switch checked={formData.autoCreatePolicy} onCheckedChange={(v) => setFormData({ ...formData, autoCreatePolicy: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Sync VPN Subnets</Label>
                <Switch checked={formData.syncVpnSubnets} onCheckedChange={(v) => setFormData({ ...formData, syncVpnSubnets: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Sync User Groups</Label>
                <Switch checked={formData.syncUserGroups} onCheckedChange={(v) => setFormData({ ...formData, syncUserGroups: v })} />
              </div>
            </div>

            <Separator />

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
