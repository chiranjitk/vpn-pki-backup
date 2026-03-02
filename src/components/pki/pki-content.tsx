'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
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
  FileUp,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Download,
  Plus,
  Trash2,
  Eye,
  Settings,
  XCircle,
  Loader2,
  Server,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface PKIData {
  mode: string
  openssl: {
    available: boolean
    version: string
  }
  ca: {
    id: string
    name: string
    type: string
    status: string
    isExternal: boolean
    subject: string
    serialNumber: string
    issueDate: string
    expiryDate: string
    keySize: number
    filesExist: boolean
    paths: {
      certificatePath: string
      keyPath: string
      crlPath: string
    }
  } | null
  crl: {
    version: number
    thisUpdate: string
    nextUpdate: string
    revokedCount: number
    fileExists: boolean
  } | null
  settings: {
    minKeySize: number
    defaultClientValidityDays: number
    defaultServerValidityDays: number
    crlValidityDays: number
    autoReloadStrongswan: boolean
    swanctlConfigPath: string
  }
  validation: {
    valid: boolean
    errors: string[]
    warnings: string[]
  }
  paths: Array<{
    name: string
    path: string
    exists: boolean
    type: string
    permissions?: string
  }>
}

export function PKIContent() {
  const router = useRouter()
  const [data, setData] = useState<PKIData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showInitDialog, setShowInitDialog] = useState(false)
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [regeneratingCrl, setRegeneratingCrl] = useState(false)
  
  // Settings state with controlled inputs
  const [settingsForm, setSettingsForm] = useState({
    minKeySize: 4096,
    defaultClientValidityDays: 365,
    defaultServerValidityDays: 730,
    crlValidityDays: 7,
    autoReloadStrongswan: true,
  })
  
  const [initForm, setInitForm] = useState({
    name: '24online VPN Root CA',
    country: 'US',
    organization: '24online',
    keySize: '4096',
    validityDays: '3650',
  })

  const fetchData = async () => {
    try {
      const response = await fetch('/api/pki')
      if (!response.ok) throw new Error('Failed to fetch PKI data')
      const result = await response.json()
      setData(result)
      // Update settings form with fetched data
      if (result.settings) {
        setSettingsForm({
          minKeySize: result.settings.minKeySize || 4096,
          defaultClientValidityDays: result.settings.defaultClientValidityDays || 365,
          defaultServerValidityDays: result.settings.defaultServerValidityDays || 730,
          crlValidityDays: result.settings.crlValidityDays || 7,
          autoReloadStrongswan: result.settings.autoReloadStrongswan ?? true,
        })
      }
    } catch (error) {
      console.error('Error fetching PKI data:', error)
      toast.error('Failed to load PKI data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleInitializeCA = async () => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/pki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'init_ca',
          ...initForm,
          keySize: parseInt(initForm.keySize),
          validityDays: parseInt(initForm.validityDays),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to initialize CA')
      }

      toast.success('Root CA initialized successfully')
      setShowInitDialog(false)
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to initialize CA')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRegenerateCA = async () => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/pki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'regenerate_ca',
          ...initForm,
          keySize: parseInt(initForm.keySize),
          validityDays: parseInt(initForm.validityDays),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to regenerate CA')
      }

      toast.success('Root CA regenerated successfully')
      setShowRegenerateDialog(false)
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to regenerate CA')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCA = async () => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/pki', {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete CA')
      }

      toast.success('CA deleted successfully')
      setShowDeleteDialog(false)
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete CA')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRegenerateCRL = async () => {
    setRegeneratingCrl(true)
    try {
      const response = await fetch('/api/pki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_crl' }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to regenerate CRL')
      }

      toast.success('CRL regenerated successfully')
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to regenerate CRL')
    } finally {
      setRegeneratingCrl(false)
    }
  }

  const handleDeployToStrongSwan = async () => {
    setDeploying(true)
    try {
      const response = await fetch('/api/pki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deploy_to_strongswan' }),
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Deployment failed')
      }

      if (result.reload?.success) {
        toast.success('Deployed to strongSwan and configuration reloaded successfully')
      } else {
        toast.warning(`Deployed to strongSwan but reload failed: ${result.reload?.message}`)
      }
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to deploy to strongSwan')
    } finally {
      setDeploying(false)
    }
  }

  const handleExportCAChain = () => {
    if (data?.ca?.paths?.certificatePath) {
      window.open(`/api/pki/download?type=ca`, '_blank')
      toast.success('CA certificate download started')
    }
  }

  const handleSaveSettings = async () => {
    try {
      const response = await fetch('/api/pki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_settings',
          ...settingsForm,
        }),
      })

      if (!response.ok) throw new Error('Failed to save settings')

      toast.success('Settings saved successfully')
      fetchData()
    } catch (error) {
      toast.error('Failed to save settings')
    }
  }

  // Helper to truncate long serial numbers
  const truncateSerial = (serial: string, maxLength: number = 20) => {
    if (!serial) return '-'
    if (serial.length <= maxLength) return serial
    return serial.substring(0, maxLength) + '...'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-12 w-12 text-yellow-500" />
        <p className="text-muted-foreground">Failed to load PKI data</p>
        <Button onClick={fetchData}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">PKI Management</h1>
          <p className="text-muted-foreground">
            Manage Certificate Authorities and PKI configuration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={data.mode === 'MANAGED' ? 'default' : 'secondary'}>
            {data.mode === 'MANAGED' ? 'Managed PKI' : 'External CA'}
          </Badge>
        </div>
      </div>

      {/* OpenSSL Status */}
      <Alert variant={data.openssl.available ? 'default' : 'destructive'}>
        {data.openssl.available ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <XCircle className="h-4 w-4" />
        )}
        <AlertTitle>OpenSSL Status</AlertTitle>
        <AlertDescription>
          {data.openssl.available
            ? `OpenSSL is available: ${data.openssl.version}`
            : 'OpenSSL is not available. Certificate generation will not work.'}
        </AlertDescription>
      </Alert>

      {/* Validation Messages */}
      {data.validation.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Configuration Errors</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside">
              {data.validation.errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {data.validation.warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Warnings</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside">
              {data.validation.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="ca" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ca">Certificate Authority</TabsTrigger>
          <TabsTrigger value="server-certs">Server Certificates</TabsTrigger>
          <TabsTrigger value="crl">CRL Management</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* CA Tab */}
        <TabsContent value="ca" className="space-y-4">
          {data.ca ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5" />
                    Root CA Certificate
                  </CardTitle>
                  <CardDescription>Your managed Root CA certificate details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{data.ca.name}</h3>
                      <p className="text-sm text-muted-foreground truncate max-w-[200px]" title={data.ca.subject}>
                        {data.ca.subject}
                      </p>
                    </div>
                    <Badge variant={data.ca.status === 'ACTIVE' ? 'default' : 'destructive'}>
                      {data.ca.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Serial Number</p>
                      <p className="font-mono text-xs break-all" title={data.ca.serialNumber}>
                        {truncateSerial(data.ca.serialNumber, 24)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Key Size</p>
                      <p>{data.ca.keySize} bits</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Issued</p>
                      <p>{data.ca.issueDate ? new Date(data.ca.issueDate).toLocaleDateString() : '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expires</p>
                      <p>{data.ca.expiryDate ? new Date(data.ca.expiryDate).toLocaleDateString() : '-'}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={handleExportCAChain}>
                      <Download className="mr-2 h-4 w-4" />
                      Export CA
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleDeployToStrongSwan}
                      disabled={deploying}
                    >
                      {deploying ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Deploy
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowRegenerateDialog(true)}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Regenerate
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>CA Operations</CardTitle>
                  <CardDescription>
                    Manage your certificate authority
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Button 
                      variant="outline" 
                      className="justify-start" 
                      onClick={handleRegenerateCRL}
                      disabled={regeneratingCrl}
                    >
                      {regeneratingCrl ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Regenerate CRL
                    </Button>
                    <Button 
                      variant="outline" 
                      className="justify-start" 
                      onClick={handleDeployToStrongSwan}
                      disabled={deploying}
                    >
                      {deploying ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      Deploy to strongSwan
                    </Button>
                  </div>

                  <Alert>
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>CA Files Location</AlertTitle>
                    <AlertDescription className="text-xs font-mono mt-2">
                      <p>Cert: {data.ca.paths.certificatePath}</p>
                      <p>Key:  {data.ca.paths.keyPath}</p>
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Initialize Certificate Authority</CardTitle>
                <CardDescription>
                  No CA found. Initialize a new Root CA to start issuing certificates.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-center py-8">
                  <Button size="lg" onClick={() => setShowInitDialog(true)}>
                    <Plus className="mr-2 h-5 w-5" />
                    Initialize Root CA
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Server Certificates Tab */}
        <TabsContent value="server-certs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Server Certificates
              </CardTitle>
              <CardDescription>
                Manage VPN server certificates for IKEv2 authentication
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Server certificates are used to authenticate the VPN server to clients. 
                Each server certificate identifies your VPN server and must be trusted by connecting clients.
              </p>
              <Button onClick={() => router.push('/server-certificates')}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Go to Server Certificates
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CRL Tab */}
        <TabsContent value="crl" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  CRL Status
                </CardTitle>
                <CardDescription>
                  Certificate Revocation List information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.crl ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Version</p>
                        <p className="font-medium">{data.crl.version}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Revoked Count</p>
                        <p className="font-medium">{data.crl.revokedCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Update</p>
                        <p className="font-medium">
                          {new Date(data.crl.thisUpdate).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Next Update</p>
                        <p className="font-medium">
                          {new Date(data.crl.nextUpdate).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1" 
                        onClick={handleRegenerateCRL}
                        disabled={regeneratingCrl}
                      >
                        {regeneratingCrl ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Regenerate CRL
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1" 
                        onClick={handleDeployToStrongSwan}
                        disabled={deploying}
                      >
                        {deploying ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-4 w-4" />
                        )}
                        Deploy
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No CRL information available</p>
                    <p className="text-sm">Initialize CA first</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>CRL Deployment</CardTitle>
                <CardDescription>
                  Deploy CRL to strongSwan
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm font-mono">/etc/swanctl/x509crl/ca.crl.pem</p>
                </div>

                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>CRL Deployment</AlertTitle>
                  <AlertDescription>
                    Click the button below to deploy the CRL to strongSwan and reload the VPN service.
                  </AlertDescription>
                </Alert>

                <Button 
                  className="w-full" 
                  onClick={handleDeployToStrongSwan}
                  disabled={deploying || !data.crl}
                >
                  {deploying ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Deploy to strongSwan
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Certificate Policies</CardTitle>
              <CardDescription>
                Default settings for certificate generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Minimum Key Size</Label>
                <Select 
                  value={String(settingsForm.minKeySize)} 
                  onValueChange={(v) => setSettingsForm({ ...settingsForm, minKeySize: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2048">2048 bits</SelectItem>
                    <SelectItem value="4096">4096 bits</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Default Client Certificate Validity</Label>
                <Select 
                  value={String(settingsForm.defaultClientValidityDays)}
                  onValueChange={(v) => setSettingsForm({ ...settingsForm, defaultClientValidityDays: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Day</SelectItem>
                    <SelectItem value="7">1 Week</SelectItem>
                    <SelectItem value="30">1 Month</SelectItem>
                    <SelectItem value="60">2 Months</SelectItem>
                    <SelectItem value="90">3 Months</SelectItem>
                    <SelectItem value="180">6 Months</SelectItem>
                    <SelectItem value="365">1 Year</SelectItem>
                    <SelectItem value="730">2 Years</SelectItem>
                    <SelectItem value="1095">3 Years</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Default Server Certificate Validity</Label>
                <Select 
                  value={String(settingsForm.defaultServerValidityDays)}
                  onValueChange={(v) => setSettingsForm({ ...settingsForm, defaultServerValidityDays: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">1 Month</SelectItem>
                    <SelectItem value="90">3 Months</SelectItem>
                    <SelectItem value="180">6 Months</SelectItem>
                    <SelectItem value="365">1 Year</SelectItem>
                    <SelectItem value="730">2 Years</SelectItem>
                    <SelectItem value="1095">3 Years</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>CRL Validity Period</Label>
                <Select 
                  value={String(settingsForm.crlValidityDays)}
                  onValueChange={(v) => setSettingsForm({ ...settingsForm, crlValidityDays: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Day</SelectItem>
                    <SelectItem value="7">7 Days</SelectItem>
                    <SelectItem value="14">14 Days</SelectItem>
                    <SelectItem value="30">30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full" onClick={handleSaveSettings}>
                Save Settings
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>strongSwan Integration</CardTitle>
              <CardDescription>
                VPN service integration settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>swanctl Configuration Path</Label>
                <Input value={data.settings.swanctlConfigPath} readOnly />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-reload VPN</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically reload after certificate changes
                  </p>
                </div>
                <Switch 
                  checked={settingsForm.autoReloadStrongswan}
                  onCheckedChange={(checked) => setSettingsForm({ ...settingsForm, autoReloadStrongswan: checked })}
                />
              </div>

              <Button variant="outline" onClick={handleSaveSettings}>
                Save VPN Settings
              </Button>
            </CardContent>
          </Card>

          {/* Path Status */}
          <Card>
            <CardHeader>
              <CardTitle>PKI Path Status</CardTitle>
              <CardDescription>File and directory status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.paths.map((pathItem, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{pathItem.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{pathItem.path}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {pathItem.permissions && (
                        <span className="text-xs text-muted-foreground">{pathItem.permissions}</span>
                      )}
                      {pathItem.exists ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Initialize CA Dialog */}
      <Dialog open={showInitDialog} onOpenChange={setShowInitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Initialize New Root CA</DialogTitle>
            <DialogDescription>
              Create a new self-signed Root CA for certificate signing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ca-name">CA Name</Label>
              <Input
                id="ca-name"
                placeholder="VPN Root CA"
                value={initForm.name}
                onChange={(e) => setInitForm({ ...initForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  placeholder="US"
                  maxLength={2}
                  value={initForm.country}
                  onChange={(e) => setInitForm({ ...initForm, country: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="organization">Organization</Label>
                <Input
                  id="organization"
                  placeholder="Company Inc."
                  value={initForm.organization}
                  onChange={(e) => setInitForm({ ...initForm, organization: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="key-size">Key Size</Label>
                <Select value={initForm.keySize} onValueChange={(v) => setInitForm({ ...initForm, keySize: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2048">2048 bits</SelectItem>
                    <SelectItem value="4096">4096 bits</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="validity">Validity</Label>
                <Select value={initForm.validityDays} onValueChange={(v) => setInitForm({ ...initForm, validityDays: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1825">5 years</SelectItem>
                    <SelectItem value="3650">10 years</SelectItem>
                    <SelectItem value="7300">20 years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInitDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleInitializeCA} disabled={isSubmitting}>
              {isSubmitting ? 'Initializing...' : 'Initialize CA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate CA Dialog */}
      <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate Root CA</DialogTitle>
            <DialogDescription>
              This will delete the existing CA and create a new one. All issued certificates will become invalid.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                Regenerating the CA will invalidate ALL certificates signed by the current CA.
                Users will need new certificates.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="regen-ca-name">CA Name</Label>
              <Input
                id="regen-ca-name"
                placeholder="VPN Root CA"
                value={initForm.name}
                onChange={(e) => setInitForm({ ...initForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Key Size</Label>
                <Select value={initForm.keySize} onValueChange={(v) => setInitForm({ ...initForm, keySize: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2048">2048 bits</SelectItem>
                    <SelectItem value="4096">4096 bits</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Validity</Label>
                <Select value={initForm.validityDays} onValueChange={(v) => setInitForm({ ...initForm, validityDays: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1825">5 years</SelectItem>
                    <SelectItem value="3650">10 years</SelectItem>
                    <SelectItem value="7300">20 years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegenerateDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRegenerateCA} disabled={isSubmitting}>
              {isSubmitting ? 'Regenerating...' : 'Regenerate CA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete CA Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Root CA</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the Root CA certificate and private key.
              <br /><br />
              <strong>All issued certificates will become invalid.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCA}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? 'Deleting...' : 'Delete CA'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
