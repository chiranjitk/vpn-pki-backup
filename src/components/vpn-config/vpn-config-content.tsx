'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { toast } from 'sonner'
import { Save, Eye, RefreshCw, FileText, Server, Shield, Network, AlertTriangle, Copy, Info } from 'lucide-react'

interface VpnConfig {
  id: string
  connectionName: string
  ikeVersion: number
  ikeProposals: string
  espProposals: string
  localAuth: string
  localCert: string
  localId: string | null
  remoteAuth: string
  remoteCaId: string | null
  poolName: string
  poolAddressRange: string
  dnsServers: string
  localTrafficSelector: string
  remoteTrafficSelector: string
  mobike: boolean
  fragmentation: boolean
  reauthTime: number
  dpdAction: string
  startAction: string
  serverHostnames: string | null
}

interface CaInfo {
  id: string
  name: string
  subject: string
}

const defaultConfig: VpnConfig = {
  id: '',
  connectionName: 'ikev2-cert',
  ikeVersion: 2,
  ikeProposals: 'aes256-sha256-modp1024',
  espProposals: 'aes256-sha1,aes256-sha256',
  localAuth: 'pubkey',
  localCert: 'vpn-server.pem',
  localId: '',
  remoteAuth: 'pubkey',
  remoteCaId: '',
  poolName: 'vpn-pool',
  poolAddressRange: '10.70.0.0/24',
  dnsServers: '8.8.8.8',
  localTrafficSelector: '0.0.0.0/0',
  remoteTrafficSelector: 'dynamic',
  mobike: true,
  fragmentation: true,
  reauthTime: 0,
  dpdAction: 'restart',
  startAction: 'none',
  serverHostnames: '',
}

export function VpnConfigContent() {
  const [config, setConfig] = useState<VpnConfig>(defaultConfig)
  const [caSubject, setCaSubject] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewContent, setPreviewContent] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/vpn-config')
      if (response.ok) {
        const data = await response.json()
        setConfig({ ...defaultConfig, ...data.config })
        setCaSubject(data.caSubject)
      }
    } catch (error) {
      console.error('Failed to fetch config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/vpn-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      if (response.ok) {
        toast.success('VPN configuration saved')
      } else {
        throw new Error('Failed to save')
      }
    } catch (error) {
      toast.error('Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = async () => {
    try {
      const response = await fetch('/api/vpn-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview' }),
      })

      if (response.ok) {
        const data = await response.json()
        setPreviewContent(data.content)
        setShowPreview(true)
      }
    } catch (error) {
      toast.error('Failed to generate preview')
    }
  }

  const handleApply = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/vpn-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply' }),
      })

      const data = await response.json()
      if (response.ok) {
        toast.success('Configuration applied to /etc/swanctl/swanctl.conf')
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      toast.error('Failed to apply configuration')
    } finally {
      setSaving(false)
    }
  }

  const updateConfig = (key: keyof VpnConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">VPN Configuration</h1>
          <p className="text-muted-foreground">Configure IKEv2 connection settings for strongSwan</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePreview}>
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
          <Button onClick={handleApply} disabled={saving}>
            <FileText className="mr-2 h-4 w-4" />
            Apply to Server
          </Button>
        </div>
      </div>

      {/* CA Info Alert */}
      {caSubject && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Your CA Subject</AlertTitle>
          <AlertDescription className="flex items-center gap-2">
            <code className="bg-muted px-2 py-1 rounded text-sm">{caSubject}</code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(caSubject)
                toast.success('CA subject copied to clipboard')
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="connection" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="connection">
            <Server className="mr-2 h-4 w-4" />
            Connection
          </TabsTrigger>
          <TabsTrigger value="authentication">
            <Shield className="mr-2 h-4 w-4" />
            Authentication
          </TabsTrigger>
          <TabsTrigger value="network">
            <Network className="mr-2 h-4 w-4" />
            Network
          </TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        {/* Connection Tab */}
        <TabsContent value="connection">
          <Card>
            <CardHeader>
              <CardTitle>Connection Settings</CardTitle>
              <CardDescription>Basic IKEv2 connection parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Connection Name</Label>
                  <Input
                    value={config.connectionName}
                    onChange={(e) => updateConfig('connectionName', e.target.value)}
                    placeholder="ikev2-cert"
                  />
                </div>
                <div className="space-y-2">
                  <Label>IKE Version</Label>
                  <Select
                    value={config.ikeVersion.toString()}
                    onValueChange={(v) => updateConfig('ikeVersion', parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">IKEv1</SelectItem>
                      <SelectItem value="2">IKEv2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>IKE Proposals</Label>
                <Input
                  value={config.ikeProposals}
                  onChange={(e) => updateConfig('ikeProposals', e.target.value)}
                  placeholder="aes256-sha256-modp1024"
                />
                <p className="text-xs text-muted-foreground">
                  Example: aes256-sha256-modp1024 (modp1024 required for Windows clients)
                </p>
              </div>

              <div className="space-y-2">
                <Label>ESP Proposals</Label>
                <Input
                  value={config.espProposals}
                  onChange={(e) => updateConfig('espProposals', e.target.value)}
                  placeholder="aes256-sha1,aes256-sha256"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated proposals, e.g., aes256-sha1,aes256-sha256
                </p>
              </div>

              <div className="space-y-2">
                <Label>Server Hostnames/IPs</Label>
                <Input
                  value={config.serverHostnames || ''}
                  onChange={(e) => updateConfig('serverHostnames', e.target.value)}
                  placeholder="vpn.example.com, 192.168.1.1"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated hostnames or IP addresses for the server
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Authentication Tab */}
        <TabsContent value="authentication">
          <Card>
            <CardHeader>
              <CardTitle>Authentication Settings</CardTitle>
              <CardDescription>Certificate and authentication configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Local Authentication</Label>
                  <Select
                    value={config.localAuth}
                    onValueChange={(v) => updateConfig('localAuth', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pubkey">Public Key (Certificate)</SelectItem>
                      <SelectItem value="eap-tls">EAP-TLS</SelectItem>
                      <SelectItem value="psk">Pre-Shared Key</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Remote Authentication</Label>
                  <Select
                    value={config.remoteAuth}
                    onValueChange={(v) => updateConfig('remoteAuth', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pubkey">Public Key (Certificate)</SelectItem>
                      <SelectItem value="eap-tls">EAP-TLS</SelectItem>
                      <SelectItem value="eap-mschapv2">EAP-MSCHAPv2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Server Certificate</Label>
                  <Input
                    value={config.localCert}
                    onChange={(e) => updateConfig('localCert', e.target.value)}
                    placeholder="vpn-server.pem"
                  />
                  <p className="text-xs text-muted-foreground">
                    Filename in /etc/swanctl/x509/
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Local ID</Label>
                  <Input
                    value={config.localId || ''}
                    onChange={(e) => updateConfig('localId', e.target.value)}
                    placeholder="vpn.server or IP address"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>CA ID (for remote)</Label>
                <Input
                  value={config.remoteCaId || ''}
                  onChange={(e) => updateConfig('remoteCaId', e.target.value)}
                  placeholder="Leave empty to accept any CA-signed cert"
                />
                <p className="text-xs text-muted-foreground">
                  CA subject to validate client certificates. Leave empty to accept any valid certificate from your CA.
                </p>
                {caSubject && (
                  <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Important: CA Subject Mismatch
                      </span>
                    </div>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                      If you set a CA ID, it must match your CA subject exactly. Your CA is:
                    </p>
                    <code className="block mt-2 text-xs bg-amber-100 dark:bg-amber-900/50 px-2 py-1 rounded">
                      {caSubject}
                    </code>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                      Recommendation: Leave the CA ID field empty to avoid authentication failures.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Network Tab */}
        <TabsContent value="network">
          <Card>
            <CardHeader>
              <CardTitle>Network Settings</CardTitle>
              <CardDescription>IP pool and DNS configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pool Name</Label>
                  <Input
                    value={config.poolName}
                    onChange={(e) => updateConfig('poolName', e.target.value)}
                    placeholder="vpn-pool"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address Range</Label>
                  <Input
                    value={config.poolAddressRange}
                    onChange={(e) => updateConfig('poolAddressRange', e.target.value)}
                    placeholder="10.70.0.0/24"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>DNS Servers</Label>
                <Input
                  value={config.dnsServers}
                  onChange={(e) => updateConfig('dnsServers', e.target.value)}
                  placeholder="8.8.8.8, 8.8.4.4"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated DNS servers pushed to clients
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Local Traffic Selector</Label>
                  <Input
                    value={config.localTrafficSelector}
                    onChange={(e) => updateConfig('localTrafficSelector', e.target.value)}
                    placeholder="0.0.0.0/0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Networks accessible through VPN
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Remote Traffic Selector</Label>
                  <Input
                    value={config.remoteTrafficSelector}
                    onChange={(e) => updateConfig('remoteTrafficSelector', e.target.value)}
                    placeholder="dynamic"
                  />
                  <p className="text-xs text-muted-foreground">
                    Usually "dynamic" for roadwarrior
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Tab */}
        <TabsContent value="advanced">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>Additional IKEv2 options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>MOBIKE</Label>
                    <p className="text-xs text-muted-foreground">
                      Mobility and multihoming support
                    </p>
                  </div>
                  <Switch
                    checked={config.mobike}
                    onCheckedChange={(checked) => updateConfig('mobike', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Fragmentation</Label>
                    <p className="text-xs text-muted-foreground">
                      IKE fragmentation support
                    </p>
                  </div>
                  <Switch
                    checked={config.fragmentation}
                    onCheckedChange={(checked) => updateConfig('fragmentation', checked)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Reauth Time</Label>
                  <Input
                    type="number"
                    value={config.reauthTime}
                    onChange={(e) => updateConfig('reauthTime', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">
                    0 = disabled
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>DPD Action</Label>
                  <Select
                    value={config.dpdAction}
                    onValueChange={(v) => updateConfig('dpdAction', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="clear">Clear</SelectItem>
                      <SelectItem value="restart">Restart</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Start Action</Label>
                <Select
                  value={config.startAction}
                  onValueChange={(v) => updateConfig('startAction', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (manual)</SelectItem>
                    <SelectItem value="start">Start on boot</SelectItem>
                    <SelectItem value="trap">Trap (on-demand)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      {showPreview && (
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Configuration Preview</CardTitle>
              <CardDescription>Generated swanctl.conf content</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowPreview(false)}>
              Close
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto font-mono whitespace-pre-wrap">
              {previewContent}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
