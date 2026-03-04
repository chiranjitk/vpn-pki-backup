'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Server,
  Wifi,
  RefreshCw,
  Loader2,
  Edit,
  Globe,
  Settings,
  Save,
  AlertTriangle,
  Power,
  PowerOff,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface NetworkInterface {
  name: string
  type: 'WAN' | 'LAN' | 'VPN' | 'MANAGEMENT' | 'LOOPBACK'
  ipMethod: 'DHCP' | 'STATIC' | 'PPPOE' | 'MANUAL'
  ipAddress: string
  subnetMask: string
  gateway: string
  dnsServers: string[]
  mac: string
  mtu: number
  status: 'UP' | 'DOWN' | 'UNKNOWN'
  isDefaultGateway: boolean
  isEnabled: boolean
  rxBytes: number
  txBytes: number
  description?: string
  speed?: string
  duplex?: string
  driver?: string
  vendor?: string
  model?: string
}

interface InterfaceConfig {
  name: string
  type: 'WAN' | 'LAN' | 'VPN' | 'MANAGEMENT'
  ipMethod: 'DHCP' | 'STATIC' | 'PPPOE'
  ipAddress: string
  subnetMask: string
  gateway: string
  dnsServers: string
  mtu: number
  isDefaultGateway: boolean
  isEnabled: boolean
  pppoeUsername?: string
  pppoePassword?: string
  description?: string
}

export function InterfacesContent() {
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([])
  const [loading, setLoading] = useState(true)
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [editingInterface, setEditingInterface] = useState<NetworkInterface | null>(null)
  const [saving, setSaving] = useState(false)
  const [applying, setApplying] = useState<string | null>(null)
  const [configForm, setConfigForm] = useState<InterfaceConfig>({
    name: '',
    type: 'LAN',
    ipMethod: 'STATIC',
    ipAddress: '',
    subnetMask: '255.255.255.0',
    gateway: '',
    dnsServers: '',
    mtu: 1500,
    isDefaultGateway: false,
    isEnabled: true,
    pppoeUsername: '',
    pppoePassword: '',
    description: '',
  })

  // Fetch interfaces from API
  const fetchInterfaces = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/network/interfaces')
      if (response.ok) {
        const data = await response.json()
        setInterfaces(data.interfaces || [])
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to fetch interfaces')
      }
    } catch {
      toast.error('Failed to fetch network interfaces')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInterfaces()
  }, [fetchInterfaces])

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes || 1) / Math.log(1024))
    return parseFloat(((bytes || 0) / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'WAN': return 'bg-blue-500'
      case 'LAN': return 'bg-green-500'
      case 'VPN': return 'bg-purple-500'
      case 'MANAGEMENT': return 'bg-orange-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'UP': return 'default'
      case 'DOWN': return 'secondary'
      default: return 'outline'
    }
  }

  const openConfigDialog = (iface: NetworkInterface) => {
    if (iface.type === 'LOOPBACK') {
      toast.error('Loopback interface cannot be configured')
      return
    }
    setEditingInterface(iface)
    setConfigForm({
      name: iface.name,
      type: iface.type as 'WAN' | 'LAN' | 'VPN' | 'MANAGEMENT',
      ipMethod: iface.ipMethod === 'MANUAL' ? 'STATIC' : iface.ipMethod,
      ipAddress: iface.ipAddress,
      subnetMask: iface.subnetMask,
      gateway: iface.gateway,
      dnsServers: iface.dnsServers.join(', '),
      mtu: iface.mtu,
      isDefaultGateway: iface.isDefaultGateway,
      isEnabled: iface.isEnabled,
      pppoeUsername: '',
      pppoePassword: '',
      description: iface.description || '',
    })
    setShowConfigDialog(true)
  }

  const handleSaveConfig = async (applyNow = false) => {
    if (!editingInterface) return

    // Validate based on IP method
    if (configForm.ipMethod === 'STATIC' || configForm.ipMethod === 'PPPOE') {
      if (!configForm.ipAddress) {
        toast.error('IP Address is required for static configuration')
        return
      }
      if (!configForm.subnetMask) {
        toast.error('Subnet Mask is required')
        return
      }
    }

    if (configForm.ipMethod === 'PPPOE') {
      if (!configForm.pppoeUsername) {
        toast.error('PPPoE Username is required')
        return
      }
    }

    setSaving(true)
    try {
      const response = await fetch('/api/network/interfaces', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...configForm,
          applyNow,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Update local state
        setInterfaces(prev => prev.map(i => 
          i.name === editingInterface.name 
            ? {
                ...i,
                type: configForm.type,
                ipMethod: configForm.ipMethod,
                ipAddress: configForm.ipAddress,
                subnetMask: configForm.subnetMask,
                gateway: configForm.gateway,
                dnsServers: configForm.dnsServers.split(',').map(s => s.trim()).filter(Boolean),
                mtu: configForm.mtu,
                isDefaultGateway: configForm.isDefaultGateway,
                isEnabled: configForm.isEnabled,
                description: configForm.description,
              }
            : i
        ))
        toast.success(applyNow 
          ? `Interface ${editingInterface.name} configuration applied`
          : `Interface ${editingInterface.name} configuration saved`
        )
        setShowConfigDialog(false)
      } else {
        toast.error(data.error || 'Failed to update interface')
      }
    } catch {
      toast.error('Failed to update interface configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleApplyConfig = async (interfaceName?: string) => {
    const targetName = interfaceName || 'all'
    setApplying(targetName)
    try {
      const response = await fetch('/api/network/interfaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: interfaceName ? 'apply' : 'apply_all',
          name: interfaceName 
        }),
      })

      const data = await response.json()

      if (response.ok) {
        if (interfaceName) {
          toast.success(data.message || `Interface ${interfaceName} configuration applied`)
        } else {
          toast.success('All configurations applied successfully')
        }
        // Refresh interfaces after applying
        await fetchInterfaces()
      } else {
        toast.error(data.error || 'Failed to apply configuration')
      }
    } catch {
      toast.error('Failed to apply network configuration')
    } finally {
      setApplying(null)
    }
  }

  const handleToggleInterface = async (name: string, enable: boolean) => {
    try {
      const response = await fetch('/api/network/interfaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: enable ? 'enable' : 'disable',
          name 
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message)
        setInterfaces(prev => prev.map(i => 
          i.name === name 
            ? { ...i, isEnabled: enable, status: enable ? 'UP' : 'DOWN' }
            : i
        ))
      } else {
        toast.error(data.error || 'Failed to change interface state')
      }
    } catch {
      toast.error('Failed to change interface state')
    }
  }

  // Filter out loopback for display but keep it in data
  const displayInterfaces = interfaces

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Server className="h-6 w-6 text-primary" />
            Network Interfaces
          </h1>
          <p className="text-muted-foreground">
            Configure network interfaces and IP settings
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchInterfaces} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            size="sm" 
            onClick={() => handleApplyConfig()} 
            disabled={applying === 'all' || interfaces.length === 0}
          >
            {applying === 'all' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Apply All
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && interfaces.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Detecting network interfaces...</span>
        </div>
      )}

      {/* No Interfaces Found */}
      {!loading && interfaces.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No interfaces detected</AlertTitle>
          <AlertDescription>
            Unable to detect network interfaces. This may be due to insufficient permissions or the system&apos;s network configuration.
          </AlertDescription>
        </Alert>
      )}

      {/* Interface Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {displayInterfaces.map((iface) => (
          <Card key={iface.name} className={!iface.isEnabled ? 'opacity-60' : ''}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {iface.type === 'VPN' ? (
                    <Globe className="h-4 w-4 text-purple-500" />
                  ) : iface.type === 'WAN' ? (
                    <Wifi className="h-4 w-4 text-blue-500" />
                  ) : (
                    <Server className="h-4 w-4 text-green-500" />
                  )}
                  {iface.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className={`${getTypeBadgeColor(iface.type)} text-white`}>
                    {iface.type}
                  </Badge>
                  <Badge variant={getStatusBadgeVariant(iface.status)}>
                    {iface.status === 'UP' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {iface.status}
                  </Badge>
                </div>
              </div>
              <CardDescription className="flex items-center gap-2">
                <span>{iface.description || iface.ipMethod}</span>
                {iface.driver && iface.driver !== 'Unknown' && iface.driver !== 'N/A' && (
                  <Badge variant="outline" className="text-xs">{iface.driver}</Badge>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IP Address:</span>
                  <span className="font-mono">
                    {iface.ipAddress ? `${iface.ipAddress}/${iface.subnetMask}` : 'No IP assigned'}
                  </span>
                </div>
                {iface.gateway && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gateway:</span>
                    <span className="font-mono">{iface.gateway}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">MAC:</span>
                  <span className="font-mono">{iface.mac}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">MTU:</span>
                  <span>{iface.mtu}</span>
                </div>
                {iface.speed && iface.speed !== 'Unknown' && iface.speed !== 'N/A' && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Speed:</span>
                    <span>{iface.speed} ({iface.duplex})</span>
                  </div>
                )}
                {iface.dnsServers.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">DNS:</span>
                    <span className="font-mono text-xs">{iface.dnsServers.join(', ')}</span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Traffic:</span>
                  <span>
                    <span className="text-green-600">↓{formatBytes(iface.rxBytes)}</span>
                    {' / '}
                    <span className="text-blue-600">↑{formatBytes(iface.txBytes)}</span>
                  </span>
                </div>
                {iface.isDefaultGateway && (
                  <div className="mt-2">
                    <Badge variant="outline" className="text-xs">Default Gateway</Badge>
                  </div>
                )}
              </div>
              {iface.type !== 'LOOPBACK' && (
                <div className="mt-4 flex justify-between">
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleToggleInterface(iface.name, !iface.isEnabled)}
                    >
                      {iface.isEnabled ? (
                        <>
                          <PowerOff className="h-4 w-4 mr-1 text-red-500" />
                          Disable
                        </>
                      ) : (
                        <>
                          <Power className="h-4 w-4 mr-1 text-green-500" />
                          Enable
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleApplyConfig(iface.name)}
                      disabled={applying === iface.name}
                    >
                      {applying === iface.name ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-1" />
                      )}
                      Apply
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openConfigDialog(iface)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Configuration Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configure {editingInterface?.name}
            </DialogTitle>
            <DialogDescription>
              Configure interface type and IP settings
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* Interface Type */}
            <div className="space-y-2">
              <Label>Interface Type</Label>
              <Select 
                value={configForm.type} 
                onValueChange={(v: 'WAN' | 'LAN' | 'VPN' | 'MANAGEMENT') => setConfigForm({ ...configForm, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WAN">WAN (Internet)</SelectItem>
                  <SelectItem value="LAN">LAN (Local Network)</SelectItem>
                  <SelectItem value="VPN">VPN (Tunnel)</SelectItem>
                  <SelectItem value="MANAGEMENT">Management</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* IP Configuration Method */}
            <div className="space-y-2">
              <Label>IP Configuration</Label>
              <Select 
                value={configForm.ipMethod} 
                onValueChange={(v: 'DHCP' | 'STATIC' | 'PPPOE') => setConfigForm({ ...configForm, ipMethod: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DHCP">DHCP (Automatic)</SelectItem>
                  <SelectItem value="STATIC">Static IP</SelectItem>
                  {configForm.type === 'WAN' && (
                    <SelectItem value="PPPOE">PPPoE</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Static IP Configuration */}
            {configForm.ipMethod === 'STATIC' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>IP Address</Label>
                    <Input
                      placeholder="192.168.1.10"
                      value={configForm.ipAddress}
                      onChange={(e) => setConfigForm({ ...configForm, ipAddress: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subnet Mask</Label>
                    <Input
                      placeholder="255.255.255.0"
                      value={configForm.subnetMask}
                      onChange={(e) => setConfigForm({ ...configForm, subnetMask: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Gateway (optional)</Label>
                  <Input
                    placeholder="192.168.1.1"
                    value={configForm.gateway}
                    onChange={(e) => setConfigForm({ ...configForm, gateway: e.target.value })}
                  />
                </div>
              </>
            )}

            {/* PPPoE Configuration */}
            {configForm.ipMethod === 'PPPOE' && (
              <>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>PPPoE Configuration</AlertTitle>
                  <AlertDescription>
                    Enter your ISP-provided PPPoE credentials
                  </AlertDescription>
                </Alert>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>IP Address (Local)</Label>
                    <Input
                      placeholder="10.0.0.1"
                      value={configForm.ipAddress}
                      onChange={(e) => setConfigForm({ ...configForm, ipAddress: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subnet Mask</Label>
                    <Input
                      placeholder="255.255.255.0"
                      value={configForm.subnetMask}
                      onChange={(e) => setConfigForm({ ...configForm, subnetMask: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>PPPoE Username</Label>
                  <Input
                    placeholder="username@isp.com"
                    value={configForm.pppoeUsername}
                    onChange={(e) => setConfigForm({ ...configForm, pppoeUsername: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>PPPoE Password</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={configForm.pppoePassword}
                    onChange={(e) => setConfigForm({ ...configForm, pppoePassword: e.target.value })}
                  />
                </div>
              </>
            )}

            {/* DNS Servers */}
            <div className="space-y-2">
              <Label>DNS Servers</Label>
              <Input
                placeholder="8.8.8.8, 8.8.4.4"
                value={configForm.dnsServers}
                onChange={(e) => setConfigForm({ ...configForm, dnsServers: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Comma-separated list of DNS servers</p>
            </div>

            {/* MTU */}
            <div className="space-y-2">
              <Label>MTU</Label>
              <Input
                type="number"
                value={configForm.mtu}
                onChange={(e) => setConfigForm({ ...configForm, mtu: parseInt(e.target.value) || 1500 })}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Interface description"
                value={configForm.description}
                onChange={(e) => setConfigForm({ ...configForm, description: e.target.value })}
              />
            </div>

            <Separator />

            {/* Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Default Gateway</Label>
                  <p className="text-xs text-muted-foreground">Use as default route</p>
                </div>
                <Switch
                  checked={configForm.isDefaultGateway}
                  onCheckedChange={(v) => setConfigForm({ ...configForm, isDefaultGateway: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enabled</Label>
                  <p className="text-xs text-muted-foreground">Bring interface up</p>
                </div>
                <Switch
                  checked={configForm.isEnabled}
                  onCheckedChange={(v) => setConfigForm({ ...configForm, isEnabled: v })}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowConfigDialog(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleSaveConfig(false)} 
              disabled={saving}
              className="w-full sm:w-auto"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Only
            </Button>
            <Button 
              onClick={() => handleSaveConfig(true)} 
              disabled={saving}
              className="w-full sm:w-auto"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save & Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
