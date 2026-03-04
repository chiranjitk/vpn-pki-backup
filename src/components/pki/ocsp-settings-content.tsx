'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Server,
  ShieldCheck,
  Settings,
  Clock,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Play,
  Square,
  FileKey,
  Globe,
  Activity,
  Zap,
  Loader2,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'

// OCSP Configuration interface
interface OcspConfig {
  isEnabled: boolean
  responderUrl: string
  port: number
  responseValiditySeconds: number
  nextUpdateIntervalSeconds: number
  hashAlgorithm: string
  ocspCertPath: string
  ocspKeyPath: string
  caId?: string
  autoGenerateSigningCert: boolean
}

// OCSP Status interface
interface OcspStatus {
  isRunning: boolean
  uptime?: number
  requestsServed?: number
  lastRequestTime?: string
  errorCount?: number
  lastError?: string
  error?: string
}

// CA Info interface
interface CaInfo {
  id: string
  name: string
  type: string
  status: string
  isExternal: boolean
  subject?: string
}

const defaultConfig: OcspConfig = {
  isEnabled: false,
  responderUrl: 'http://localhost:3033',
  port: 3033,
  responseValiditySeconds: 3600,
  nextUpdateIntervalSeconds: 3600,
  hashAlgorithm: 'SHA256',
  ocspCertPath: '/etc/swanctl/ocsp.crt',
  ocspKeyPath: '/etc/swanctl/ocsp.key',
  autoGenerateSigningCert: false,
}

const hashAlgorithms = [
  { value: 'SHA1', label: 'SHA-1 (Legacy)' },
  { value: 'SHA256', label: 'SHA-256 (Recommended)' },
  { value: 'SHA384', label: 'SHA-384' },
  { value: 'SHA512', label: 'SHA-512' },
]

export function OcspSettingsContent() {
  const [config, setConfig] = useState<OcspConfig>(defaultConfig)
  const [status, setStatus] = useState<OcspStatus | null>(null)
  const [cas, setCas] = useState<CaInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showCertDialog, setShowCertDialog] = useState(false)
  const [certPem, setCertPem] = useState('')
  const [keyPem, setKeyPem] = useState('')
  const [isUploadingCert, setIsUploadingCert] = useState(false)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      // Fetch OCSP config
      const configResponse = await fetch('/api/ocsp')
      if (configResponse.ok) {
        const configData = await configResponse.json()
        if (configData.config) {
          setConfig({ ...defaultConfig, ...configData.config })
        }
      }

      // Fetch OCSP status
      const statusResponse = await fetch('/api/ocsp/status')
      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        setStatus(statusData)
      }

      // Fetch CAs for selection
      const pkiResponse = await fetch('/api/pki')
      if (pkiResponse.ok) {
        const pkiData = await pkiResponse.json()
        if (pkiData.ca) {
          setCas([{
            id: pkiData.ca.id,
            name: pkiData.ca.name,
            type: pkiData.ca.type,
            status: pkiData.ca.status,
            isExternal: pkiData.ca.isExternal,
            subject: pkiData.ca.subject,
          }])
        }
      }
    } catch (error) {
      console.error('Error fetching OCSP data:', error)
      toast.error('Failed to load OCSP settings')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSaveConfig = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/ocsp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save configuration')
      }

      toast.success('OCSP configuration saved successfully')
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save configuration')
    } finally {
      setIsSaving(false)
    }
  }

  const handleStartResponder = async () => {
    try {
      const response = await fetch('/api/ocsp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, isEnabled: true }),
      })

      if (!response.ok) throw new Error('Failed to start OCSP responder')

      toast.success('OCSP responder started')
      fetchData()
    } catch (error) {
      toast.error('Failed to start OCSP responder')
    }
  }

  const handleStopResponder = async () => {
    try {
      const response = await fetch('/api/ocsp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, isEnabled: false }),
      })

      if (!response.ok) throw new Error('Failed to stop OCSP responder')

      toast.success('OCSP responder stopped')
      fetchData()
    } catch (error) {
      toast.error('Failed to stop OCSP responder')
    }
  }

  const handleUploadSigningCert = async () => {
    if (!certPem.trim()) {
      toast.error('Certificate PEM is required')
      return
    }
    if (!keyPem.trim()) {
      toast.error('Private key PEM is required')
      return
    }

    setIsUploadingCert(true)
    try {
      const response = await fetch('/api/ocsp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          action: 'upload_signing_cert',
          certPem,
          keyPem,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload certificate')
      }

      toast.success('OCSP signing certificate uploaded successfully')
      setShowCertDialog(false)
      setCertPem('')
      setKeyPem('')
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload certificate')
    } finally {
      setIsUploadingCert(false)
    }
  }

  const handleAutoGenerateCert = async () => {
    if (!config.caId) {
      toast.error('Please select a CA first')
      return
    }

    try {
      const response = await fetch('/api/ocsp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          action: 'auto_generate_cert',
          caId: config.caId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate certificate')
      }

      const result = await response.json()
      toast.success('OCSP signing certificate generated successfully')
      if (result.ocspCertPath) {
        setConfig(prev => ({
          ...prev,
          ocspCertPath: result.ocspCertPath,
          ocspKeyPath: result.ocspKeyPath,
        }))
      }
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate certificate')
    }
  }

  const formatUptime = (seconds?: number) => {
    if (!seconds) return 'N/A'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const formatTime = (dateString?: string) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString()
  }

  if (isLoading) {
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
          <h1 className="text-2xl font-bold tracking-tight">OCSP Settings</h1>
          <p className="text-muted-foreground">
            Online Certificate Status Protocol responder configuration
          </p>
        </div>
        <div className="flex gap-2">
          {status?.isRunning ? (
            <Button variant="outline" onClick={handleStopResponder}>
              <Square className="mr-2 h-4 w-4" />
              Stop Responder
            </Button>
          ) : (
            <Button onClick={handleStartResponder} disabled={!config.isEnabled}>
              <Play className="mr-2 h-4 w-4" />
              Start Responder
            </Button>
          )}
        </div>
      </div>

      {/* Status Banner */}
      <Alert variant={status?.isRunning ? 'default' : 'destructive'}>
        {status?.isRunning ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <XCircle className="h-4 w-4" />
        )}
        <AlertTitle>OCSP Responder Status</AlertTitle>
        <AlertDescription>
          {status?.isRunning
            ? `OCSP responder is running on port ${config.port}`
            : status?.error || 'OCSP responder is not running'}
        </AlertDescription>
      </Alert>

      {/* Status Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="h-4 w-4" />
              Responder Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant={status?.isRunning ? 'default' : 'secondary'}>
                {status?.isRunning ? 'Running' : 'Stopped'}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Uptime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatUptime(status?.uptime)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Requests Served
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.requestsServed?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Error Count
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.errorCount || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="configuration" className="space-y-4">
        <TabsList>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="response">Response Settings</TabsTrigger>
          <TabsTrigger value="ca-integration">CA Integration</TabsTrigger>
          <TabsTrigger value="signing-cert">Signing Certificate</TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="configuration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                OCSP Responder Configuration
              </CardTitle>
              <CardDescription>
                Configure the OCSP responder service settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enabled">Enable OCSP Responder</Label>
                  <p className="text-sm text-muted-foreground">
                    Start the OCSP responder service
                  </p>
                </div>
                <Switch
                  id="enabled"
                  checked={config.isEnabled}
                  onCheckedChange={(checked) =>
                    setConfig(prev => ({ ...prev, isEnabled: checked }))
                  }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="responderUrl">Responder URL</Label>
                  <Input
                    id="responderUrl"
                    value={config.responderUrl}
                    onChange={(e) =>
                      setConfig(prev => ({ ...prev, responderUrl: e.target.value }))
                    }
                    placeholder="http://localhost:3033"
                  />
                  <p className="text-xs text-muted-foreground">
                    The URL where the OCSP responder will be accessible
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    value={config.port}
                    onChange={(e) =>
                      setConfig(prev => ({ ...prev, port: parseInt(e.target.value) || 3033 }))
                    }
                    placeholder="3033"
                  />
                  <p className="text-xs text-muted-foreground">
                    TCP port for the OCSP responder
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={fetchData}>
                  Reset
                </Button>
                <Button onClick={handleSaveConfig} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Settings className="mr-2 h-4 w-4" />
                  )}
                  Save Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Response Settings Tab */}
        <TabsContent value="response" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                OCSP Response Settings
              </CardTitle>
              <CardDescription>
                Configure how OCSP responses are generated and cached
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="responseValidity">Response Validity (seconds)</Label>
                  <Input
                    id="responseValidity"
                    type="number"
                    value={config.responseValiditySeconds}
                    onChange={(e) =>
                      setConfig(prev => ({
                        ...prev,
                        responseValiditySeconds: parseInt(e.target.value) || 3600
                      }))
                    }
                    placeholder="3600"
                  />
                  <p className="text-xs text-muted-foreground">
                    How long OCSP responses remain valid (default: 1 hour)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nextUpdateInterval">Next Update Interval (seconds)</Label>
                  <Input
                    id="nextUpdateInterval"
                    type="number"
                    value={config.nextUpdateIntervalSeconds}
                    onChange={(e) =>
                      setConfig(prev => ({
                        ...prev,
                        nextUpdateIntervalSeconds: parseInt(e.target.value) || 3600
                      }))
                    }
                    placeholder="3600"
                  />
                  <p className="text-xs text-muted-foreground">
                    When clients should check for new status (default: 1 hour)
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hashAlgorithm">Hash Algorithm</Label>
                <Select
                  value={config.hashAlgorithm}
                  onValueChange={(value) =>
                    setConfig(prev => ({ ...prev, hashAlgorithm: value }))
                  }
                >
                  <SelectTrigger id="hashAlgorithm">
                    <SelectValue placeholder="Select hash algorithm" />
                  </SelectTrigger>
                  <SelectContent>
                    {hashAlgorithms.map((algo) => (
                      <SelectItem key={algo.value} value={algo.value}>
                        {algo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Hash algorithm used for OCSP response signatures
                </p>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Recommended Settings</AlertTitle>
                <AlertDescription>
                  For production use, SHA-256 is recommended. Response validity of 1 hour
                  provides a good balance between security and performance.
                </AlertDescription>
              </Alert>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={fetchData}>
                  Reset
                </Button>
                <Button onClick={handleSaveConfig} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Settings className="mr-2 h-4 w-4" />
                  )}
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CA Integration Tab */}
        <TabsContent value="ca-integration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                CA Integration
              </CardTitle>
              <CardDescription>
                Select which Certificate Authority to provide OCSP for
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="caSelect">Certificate Authority</Label>
                <Select
                  value={config.caId || ''}
                  onValueChange={(value) =>
                    setConfig(prev => ({ ...prev, caId: value }))
                  }
                  disabled={cas.length === 0}
                >
                  <SelectTrigger id="caSelect">
                    <SelectValue placeholder={cas.length === 0 ? 'No CAs available' : 'Select a CA'} />
                  </SelectTrigger>
                  <SelectContent>
                    {cas.map((ca) => (
                      <SelectItem key={ca.id} value={ca.id}>
                        <div className="flex items-center gap-2">
                          <span>{ca.name}</span>
                          {ca.isExternal && (
                            <Badge variant="secondary" className="text-xs">External</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select the CA for which this OCSP responder will provide status
                </p>
              </div>

              {cas.length === 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>No CA Available</AlertTitle>
                  <AlertDescription>
                    No Certificate Authority found. Please initialize or import a CA first.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autoGenerate">Auto-generate OCSP Signing Certificate</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically generate a certificate for signing OCSP responses
                  </p>
                </div>
                <Switch
                  id="autoGenerate"
                  checked={config.autoGenerateSigningCert}
                  onCheckedChange={(checked) =>
                    setConfig(prev => ({ ...prev, autoGenerateSigningCert: checked }))
                  }
                />
              </div>

              {config.autoGenerateSigningCert && config.caId && (
                <Button onClick={handleAutoGenerateCert} variant="outline">
                  <FileKey className="mr-2 h-4 w-4" />
                  Generate OCSP Signing Certificate
                </Button>
              )}

              <Alert>
                <Globe className="h-4 w-4" />
                <AlertTitle>OCSP Authority Information Access</AlertTitle>
                <AlertDescription>
                  After configuring the OCSP responder, update your CA certificate&apos;s
                  Authority Information Access extension to include the OCSP responder URL.
                </AlertDescription>
              </Alert>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={fetchData}>
                  Reset
                </Button>
                <Button onClick={handleSaveConfig} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Settings className="mr-2 h-4 w-4" />
                  )}
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Signing Certificate Tab */}
        <TabsContent value="signing-cert" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                OCSP Signing Certificate
              </CardTitle>
              <CardDescription>
                Manage the certificate used to sign OCSP responses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Certificate Path</Label>
                  <div className="rounded-md bg-muted p-3 font-mono text-sm">
                    {config.ocspCertPath || 'Not configured'}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Private Key Path</Label>
                  <div className="rounded-md bg-muted p-3 font-mono text-sm">
                    {config.ocspKeyPath || 'Not configured'}
                  </div>
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>OCSP Signing Certificate</AlertTitle>
                <AlertDescription>
                  The OCSP signing certificate must be issued by the CA and have the
                  OCSP Signing extended key usage (EKU) extension.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowCertDialog(true)}>
                  <FileKey className="mr-2 h-4 w-4" />
                  Upload Certificate
                </Button>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={fetchData}>
                  Reset
                </Button>
                <Button onClick={handleSaveConfig} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Settings className="mr-2 h-4 w-4" />
                  )}
                  Save Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Additional Status Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Detailed Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Last Request Time</p>
              <p className="font-medium">{formatTime(status?.lastRequestTime)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Responder URL</p>
              <p className="font-medium font-mono text-sm">{config.responderUrl}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Hash Algorithm</p>
              <p className="font-medium">{config.hashAlgorithm}</p>
            </div>
            {status?.lastError && (
              <div className="space-y-1 col-span-full">
                <p className="text-sm text-muted-foreground text-destructive">Last Error</p>
                <p className="font-medium text-destructive">{status.lastError}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upload Certificate Dialog */}
      <Dialog open={showCertDialog} onOpenChange={setShowCertDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload OCSP Signing Certificate</DialogTitle>
            <DialogDescription>
              Upload the certificate and private key for signing OCSP responses
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="certPem">Certificate (PEM)</Label>
              <Textarea
                id="certPem"
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                value={certPem}
                onChange={(e) => setCertPem(e.target.value)}
                rows={8}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="keyPem">Private Key (PEM)</Label>
              <Textarea
                id="keyPem"
                placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                value={keyPem}
                onChange={(e) => setKeyPem(e.target.value)}
                rows={8}
                className="font-mono text-xs"
              />
            </div>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Security Warning</AlertTitle>
              <AlertDescription>
                Handle private keys with care. They will be stored securely on the server.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCertDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUploadSigningCert} disabled={isUploadingCert}>
              {isUploadingCert ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileKey className="mr-2 h-4 w-4" />
              )}
              Upload Certificate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
