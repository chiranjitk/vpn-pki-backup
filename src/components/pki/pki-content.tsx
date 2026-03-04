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
import { Textarea } from '@/components/ui/textarea'
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
  Upload,
  FileKey,
  Globe,
  Copy,
  FileText,
  User,
  ArrowRightLeft,
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
    crlUrl?: string
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
  deployment?: {
    caDeployed: boolean
    crlDeployed: boolean
    configExists: boolean
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

interface CSRData {
  id: string
  dbId: string
  type: 'server' | 'client'
  commonName: string
  subject: string
  keySize: number
  createdAt: string
  csrPath: string
  keyPath: string
  status: string
  user?: {
    id: string
    username: string
    email: string
  }
  sanDomains?: string[]
  sanIPs?: string[]
}

interface VpnUser {
  id: string
  username: string
  email: string
}

export function PKIContent() {
  const router = useRouter()
  const [data, setData] = useState<PKIData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showInitDialog, setShowInitDialog] = useState(false)
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showExternalCADialog, setShowExternalCADialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [regeneratingCrl, setRegeneratingCrl] = useState(false)
  
  // CSR state
  const [csrs, setCsrs] = useState<CSRData[]>([])
  const [csrsLoading, setCsrsLoading] = useState(false)
  const [showCSRDialog, setShowCSRDialog] = useState(false)
  const [showUploadCertDialog, setShowUploadCertDialog] = useState(false)
  const [selectedCSR, setSelectedCSR] = useState<CSRData | null>(null)
  const [generatedCSR, setGeneratedCSR] = useState<{
    csrId: string
    dbId: string
    csrPem: string
    type: string
    commonName: string
    download: { csr: string; key: string }
  } | null>(null)
  const [showCSRResult, setShowCSRResult] = useState(false)
  const [vpnUsers, setVpnUsers] = useState<VpnUser[]>([])
  
  // CSR form state
  const [csrForm, setCsrForm] = useState({
    type: 'server' as 'server' | 'client',
    commonName: '',
    sanDomains: '',
    sanIPs: '',
    userId: '',
    keySize: '4096',
    organization: '',
    country: '',
  })
  
  // Upload certificate form
  const [uploadCertForm, setUploadCertForm] = useState({
    certificatePem: '',
    chainPem: '',
  })
  const [uploadingCert, setUploadingCert] = useState(false)
  const [uploadedCertResult, setUploadedCertResult] = useState<{
    success: boolean
    certificate: {
      id: string
      serialNumber: string
      commonName: string
      subject: string
      expiryDate: string
      status: string
    }
    paths: {
      certificate: string
      key?: string
      chain?: string
      pkcs12?: string
    }
  } | null>(null)
  
  // Settings state
  const [settingsForm, setSettingsForm] = useState({
    minKeySize: 4096,
    defaultClientValidityDays: 365,
    defaultServerValidityDays: 730,
    crlValidityDays: 7,
    autoReloadStrongswan: true,
  })
  
  const [initForm, setInitForm] = useState({
    name: '24online VPN Root CA',
    country: 'IN',
    organization: '24online',
    keySize: '4096',
    validityDays: '3650',
  })

  // External CA form
  const [externalCAForm, setExternalCAForm] = useState({
    name: '',
    certificatePem: '',
    intermediatePem: '',
    crlUrl: '',
    crlPem: '',
  })

  const fetchData = async () => {
    try {
      const response = await fetch('/api/pki')
      if (!response.ok) throw new Error('Failed to fetch PKI data')
      const result = await response.json()
      setData(result)
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

  const fetchCSRs = async () => {
    setCsrsLoading(true)
    try {
      const response = await fetch('/api/csr')
      if (!response.ok) throw new Error('Failed to fetch CSRs')
      const result = await response.json()
      setCsrs(result.csrs || [])
    } catch (error) {
      console.error('Error fetching CSRs:', error)
      toast.error('Failed to load CSRs')
    } finally {
      setCsrsLoading(false)
    }
  }

  const fetchVpnUsers = async () => {
    try {
      const response = await fetch('/api/users?limit=100')
      if (!response.ok) throw new Error('Failed to fetch users')
      const result = await response.json()
      setVpnUsers(result.users || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (data?.ca) {
      fetchCSRs()
    }
  }, [data?.ca])

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

  const handleImportExternalCA = async () => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/pki/external-ca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import_external_ca',
          ...externalCAForm,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to import External CA')
      }

      toast.success('External CA imported successfully')
      setShowExternalCADialog(false)
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import External CA')
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

  // CSR Handlers
  const handleGenerateCSR = async () => {
    if (!csrForm.commonName.trim()) {
      toast.error('Common Name is required')
      return
    }
    
    setIsSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        type: csrForm.type,
        commonName: csrForm.commonName,
        keySize: parseInt(csrForm.keySize),
        organization: csrForm.organization || undefined,
        country: csrForm.country || undefined,
      }
      
      if (csrForm.type === 'server') {
        if (csrForm.sanDomains) {
          payload.sanDomains = csrForm.sanDomains.split(',').map(d => d.trim()).filter(Boolean)
        }
        if (csrForm.sanIPs) {
          payload.sanIPs = csrForm.sanIPs.split(',').map(d => d.trim()).filter(Boolean)
        }
      } else {
        if (csrForm.userId) {
          payload.userId = csrForm.userId
        }
      }
      
      const response = await fetch('/api/csr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate CSR')
      }

      const result = await response.json()
      setGeneratedCSR(result)
      setShowCSRResult(true)
      setShowCSRDialog(false)
      fetchCSRs()
      toast.success('CSR generated successfully')
      
      // Reset form
      setCsrForm({
        type: 'server',
        commonName: '',
        sanDomains: '',
        sanIPs: '',
        userId: '',
        keySize: '4096',
        organization: '',
        country: '',
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate CSR')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCSR = async (csr: CSRData) => {
    try {
      const response = await fetch(`/api/csr/${csr.dbId}?type=${csr.type}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete CSR')
      }

      toast.success('CSR deleted successfully')
      fetchCSRs()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete CSR')
    }
  }

  const handleDownloadCSR = (csr: CSRData, format: 'csr' | 'key') => {
    window.open(`/api/csr/${csr.dbId}/download?type=${csr.type}&format=${format}`, '_blank')
    toast.success(`${format.toUpperCase()} download started`)
  }

  const handleCopyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied to clipboard`)
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  const handleOpenUploadDialog = (csr: CSRData) => {
    setSelectedCSR(csr)
    setUploadCertForm({ certificatePem: '', chainPem: '' })
    setUploadedCertResult(null)
    setShowUploadCertDialog(true)
  }

  const handleUploadCertificate = async () => {
    if (!selectedCSR || !uploadCertForm.certificatePem.trim()) {
      toast.error('Certificate PEM is required')
      return
    }
    
    setUploadingCert(true)
    try {
      const response = await fetch('/api/certificates/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedCSR.type,
          csrId: selectedCSR.dbId,
          certificatePem: uploadCertForm.certificatePem,
          chainPem: uploadCertForm.chainPem || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload certificate')
      }

      const result = await response.json()
      setUploadedCertResult(result)
      fetchCSRs()
      toast.success('Certificate uploaded successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload certificate')
    } finally {
      setUploadingCert(false)
    }
  }

  const truncateSerial = (serial: string, maxLength: number = 20) => {
    if (!serial) return '-'
    if (serial.length <= maxLength) return serial
    return serial.substring(0, maxLength) + '...'
  }

  const openCSRDialog = (type: 'server' | 'client') => {
    setCsrForm(prev => ({ ...prev, type }))
    setGeneratedCSR(null)
    setShowCSRResult(false)
    if (type === 'client') {
      fetchVpnUsers()
    }
    setShowCSRDialog(true)
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

  const isExternalMode = data.ca?.isExternal

  return (
    <div className="space-y-6">
      {/* Mode Switch Banner */}
      <Alert className={isExternalMode ? 'border-amber-500/50 bg-amber-50 dark:bg-amber-950/20' : 'border-green-500/50 bg-green-50 dark:bg-green-950/20'}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isExternalMode ? (
              <Globe className="h-5 w-5 text-amber-600" />
            ) : (
              <KeyRound className="h-5 w-5 text-green-600" />
            )}
            <div>
              <AlertTitle className={isExternalMode ? 'text-amber-800 dark:text-amber-200' : 'text-green-800 dark:text-green-200'}>
                {isExternalMode ? 'MODE A: External CA' : 'MODE B: Managed PKI'}
              </AlertTitle>
              <AlertDescription className={isExternalMode ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300'}>
                {isExternalMode 
                  ? 'Using customer-provided CA. Certificates must be signed externally.'
                  : 'Self-hosted Certificate Authority. Full certificate lifecycle management.'}
              </AlertDescription>
            </div>
          </div>
          <Badge variant={isExternalMode ? 'secondary' : 'default'} className="ml-2">
            {isExternalMode ? 'External' : 'Managed'}
          </Badge>
        </div>
        {isExternalMode && (
          <div className="mt-3 pt-3 border-t border-amber-500/30">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>Certificate signing is disabled. Use CSR Generator to request certificates from your external CA.</span>
            </div>
          </div>
        )}
      </Alert>

      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">PKI Management</h1>
          <p className="text-muted-foreground">
            Manage Certificate Authorities and PKI configuration
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data.ca && (
            <Badge variant={isExternalMode ? 'secondary' : 'default'}>
              {isExternalMode ? 'External CA' : 'Managed PKI'}
            </Badge>
          )}
        </div>
      </div>

      {/* OpenSSL Status */}
      <Alert variant={data.openssl.available ? 'default' : 'destructive'}>
        {data.openssl.available ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <XCircle className="h-4 w-4" />
        )}
        <AlertTitle>PKI Tools Status</AlertTitle>
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
          <TabsTrigger value="csr">CSR Generator</TabsTrigger>
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
                    {data.ca.isExternal ? 'External CA Certificate' : 'Root CA Certificate'}
                  </CardTitle>
                  <CardDescription>
                    {data.ca.isExternal 
                      ? 'Customer-provided CA certificate for VPN authentication'
                      : 'Your managed Root CA certificate details'}
                  </CardDescription>
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

                  {/* Show CRL URL for External CA */}
                  {data.ca.isExternal && data.ca.crlUrl && (
                    <div className="text-sm">
                      <p className="text-muted-foreground">CRL URL</p>
                      <p className="font-mono text-xs break-all">{data.ca.crlUrl}</p>
                    </div>
                  )}

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
                    {!data.ca.isExternal && (
                      <>
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
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>CA Operations</CardTitle>
                  <CardDescription>
                    {data.ca.isExternal ? 'External CA management' : 'Manage your certificate authority'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    {!data.ca.isExternal && (
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
                    )}
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

                  {/* Deployment Status */}
                  {data.deployment && (
                    <Alert>
                      <ShieldCheck className="h-4 w-4" />
                      <AlertTitle>Deployment Status</AlertTitle>
                      <AlertDescription className="text-xs mt-2">
                        <div className="flex gap-4">
                          <span>CA: {data.deployment.caDeployed ? '✓' : '✗'}</span>
                          <span>CRL: {data.deployment.crlDeployed ? '✓' : '✗'}</span>
                          <span>Config: {data.deployment.configExists ? '✓' : '✗'}</span>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  <Alert>
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>CA Files Location</AlertTitle>
                    <AlertDescription className="text-xs font-mono mt-2">
                      <p>Cert: {data.ca.paths.certificatePath}</p>
                      {!data.ca.isExternal && <p>Key:  {data.ca.paths.keyPath}</p>}
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Managed PKI Option */}
              <Card className="border-2 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5" />
                    MODE B: Managed PKI
                  </CardTitle>
                  <CardDescription>
                    Self-hosted Certificate Authority - Full control over certificate lifecycle
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>✓ Generate and manage your own Root CA</li>
                    <li>✓ Issue server and client certificates</li>
                    <li>✓ Password-protected PKCS#12 (.pfx) export</li>
                    <li>✓ Automatic CRL generation</li>
                    <li>✓ Certificate revocation handling</li>
                    <li>✓ Expiry monitoring</li>
                  </ul>
                  <Button className="w-full" onClick={() => setShowInitDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Initialize Root CA
                  </Button>
                </CardContent>
              </Card>

              {/* External CA Option */}
              <Card className="border-2 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    MODE A: External CA
                  </CardTitle>
                  <CardDescription>
                    Use customer's existing PKI infrastructure
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>✓ Upload existing Root CA (PEM)</li>
                    <li>✓ Upload Intermediate CA (optional)</li>
                    <li>✓ Configure CRL (file or URL)</li>
                    <li>✓ Generate Certificate Signing Requests (CSR)</li>
                    <li>✓ Upload signed server certificates</li>
                    <li>✓ CRL auto-fetch scheduler</li>
                  </ul>
                  <Button className="w-full" variant="outline" onClick={() => setShowExternalCADialog(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Import External CA
                  </Button>
                </CardContent>
              </Card>
            </div>
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
                      {!data.ca?.isExternal && (
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
                      )}
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

        {/* CSR Generator Tab */}
        <TabsContent value="csr" className="space-y-4">
          {!data.ca ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>CA Required</AlertTitle>
              <AlertDescription>
                Please initialize or import a CA first to generate CSRs.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Certificate Signing Requests</h2>
                  <p className="text-sm text-muted-foreground">
                    Generate CSRs for external signing or upload signed certificates
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => openCSRDialog('server')}>
                    <Server className="mr-2 h-4 w-4" />
                    Generate Server CSR
                  </Button>
                  <Button variant="outline" onClick={() => openCSRDialog('client')}>
                    <User className="mr-2 h-4 w-4" />
                    Generate Client CSR
                  </Button>
                </div>
              </div>

              {/* Pending CSRs List */}
              <Card>
                <CardHeader>
                  <CardTitle>Pending CSRs</CardTitle>
                  <CardDescription>
                    CSRs awaiting external signing and certificate upload
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {csrsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : csrs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileKey className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No pending CSRs</p>
                      <p className="text-sm mt-1">Generate a CSR to request a certificate from your external CA</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {csrs.map((csr) => (
                        <div 
                          key={csr.dbId}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-card"
                        >
                          <div className="flex items-start gap-3">
                            {csr.type === 'server' ? (
                              <Server className="h-5 w-5 text-muted-foreground mt-0.5" />
                            ) : (
                              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{csr.commonName}</p>
                                <Badge variant="outline" className="text-xs">
                                  {csr.type}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{csr.subject}</p>
                              <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                                <span>Key: {csr.keySize} bits</span>
                                <span>•</span>
                                <span>Created: {new Date(csr.createdAt).toLocaleString()}</span>
                              </div>
                              {csr.sanDomains && csr.sanDomains.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  SANs: {csr.sanDomains.join(', ')}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3 sm:mt-0">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDownloadCSR(csr, 'csr')}
                            >
                              <Download className="mr-1 h-3 w-3" />
                              CSR
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleOpenUploadDialog(csr)}
                            >
                              <Upload className="mr-1 h-3 w-3" />
                              Upload Cert
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDeleteCSR(csr)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* CSR Info */}
              <Alert>
                <FileKey className="h-4 w-4" />
                <AlertTitle>How CSR Workflow Works</AlertTitle>
                <AlertDescription>
                  <ol className="list-decimal list-inside space-y-1 mt-2 text-sm">
                    <li>Generate a CSR for server or client certificate</li>
                    <li>Download the CSR and send it to your external CA for signing</li>
                    <li>Upload the signed certificate using the "Upload Cert" button</li>
                    <li>The certificate will be deployed to strongSwan automatically</li>
                  </ol>
                </AlertDescription>
              </Alert>
            </>
          )}
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
                <Label>Default Server Certificate Validity</Label>
                <Select 
                  value={String(settingsForm.defaultServerValidityDays)}
                  onValueChange={(v) => setSettingsForm({ ...settingsForm, defaultServerValidityDays: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="365">1 Year</SelectItem>
                    <SelectItem value="730">2 Years</SelectItem>
                    <SelectItem value="1095">3 Years</SelectItem>
                    <SelectItem value="1825">5 Years</SelectItem>
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
        </TabsContent>
      </Tabs>

      {/* Initialize CA Dialog */}
      <Dialog open={showInitDialog} onOpenChange={setShowInitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Initialize New Root CA (Managed PKI)</DialogTitle>
            <DialogDescription>
              Create a new self-signed Root CA for certificate signing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ca-name">CA Name (Common Name)</Label>
              <Input
                id="ca-name"
                placeholder="24online VPN Root CA"
                value={initForm.name}
                onChange={(e) => setInitForm({ ...initForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  placeholder="IN"
                  maxLength={2}
                  value={initForm.country}
                  onChange={(e) => setInitForm({ ...initForm, country: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="organization">Organization</Label>
                <Input
                  id="organization"
                  placeholder="24online"
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

      {/* Import External CA Dialog */}
      <Dialog open={showExternalCADialog} onOpenChange={setShowExternalCADialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import External CA (Customer CA)</DialogTitle>
            <DialogDescription>
              Import an existing CA certificate from your organization's PKI infrastructure.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ext-ca-name">CA Name</Label>
              <Input
                id="ext-ca-name"
                placeholder="Customer Root CA"
                value={externalCAForm.name}
                onChange={(e) => setExternalCAForm({ ...externalCAForm, name: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ca-pem">Root CA Certificate (PEM format)</Label>
              <Textarea
                id="ca-pem"
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                value={externalCAForm.certificatePem}
                onChange={(e) => setExternalCAForm({ ...externalCAForm, certificatePem: e.target.value })}
                rows={6}
                className="font-mono text-xs"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="intermediate-pem">Intermediate CA Certificate (Optional)</Label>
              <Textarea
                id="intermediate-pem"
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                value={externalCAForm.intermediatePem}
                onChange={(e) => setExternalCAForm({ ...externalCAForm, intermediatePem: e.target.value })}
                rows={6}
                className="font-mono text-xs"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="crl-url">CRL URL (Optional)</Label>
                <Input
                  id="crl-url"
                  placeholder="http://pki.example.com/crl/ca.crl"
                  value={externalCAForm.crlUrl}
                  onChange={(e) => setExternalCAForm({ ...externalCAForm, crlUrl: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crl-pem">Or Upload CRL (PEM)</Label>
                <Textarea
                  id="crl-pem"
                  placeholder="-----BEGIN X509 CRL-----&#10;...&#10;-----END X509 CRL-----"
                  value={externalCAForm.crlPem}
                  onChange={(e) => setExternalCAForm({ ...externalCAForm, crlPem: e.target.value })}
                  rows={4}
                  className="font-mono text-xs"
                />
              </div>
            </div>
            
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Note</AlertTitle>
              <AlertDescription>
                With External CA mode, you cannot issue certificates directly. 
                Use the CSR generation feature to request certificates from your CA.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExternalCADialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleImportExternalCA} disabled={isSubmitting}>
              {isSubmitting ? 'Importing...' : 'Import CA'}
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

      {/* Generate CSR Dialog */}
      <Dialog open={showCSRDialog} onOpenChange={setShowCSRDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Generate {csrForm.type === 'server' ? 'Server' : 'Client'} CSR
            </DialogTitle>
            <DialogDescription>
              Create a Certificate Signing Request to be signed by your external CA.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select 
                  value={csrForm.type} 
                  onValueChange={(v) => setCsrForm({ ...csrForm, type: v as 'server' | 'client' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="server">Server Certificate</SelectItem>
                    <SelectItem value="client">Client Certificate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="csr-cn">Common Name *</Label>
                <Input
                  id="csr-cn"
                  placeholder={csrForm.type === 'server' ? 'vpn.example.com' : 'john.doe'}
                  value={csrForm.commonName}
                  onChange={(e) => setCsrForm({ ...csrForm, commonName: e.target.value })}
                />
              </div>
            </div>

            {csrForm.type === 'server' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="san-domains">SAN Domains (comma-separated)</Label>
                  <Input
                    id="san-domains"
                    placeholder="vpn.example.com, vpn2.example.com"
                    value={csrForm.sanDomains}
                    onChange={(e) => setCsrForm({ ...csrForm, sanDomains: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="san-ips">SAN IPs (comma-separated)</Label>
                  <Input
                    id="san-ips"
                    placeholder="192.168.1.1, 10.0.0.1"
                    value={csrForm.sanIPs}
                    onChange={(e) => setCsrForm({ ...csrForm, sanIPs: e.target.value })}
                  />
                </div>
              </>
            )}

            {csrForm.type === 'client' && (
              <div className="space-y-2">
                <Label htmlFor="user-select">User</Label>
                <Select 
                  value={csrForm.userId} 
                  onValueChange={(v) => setCsrForm({ ...csrForm, userId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {vpnUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.username} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="csr-keysize">Key Size</Label>
                <Select 
                  value={csrForm.keySize} 
                  onValueChange={(v) => setCsrForm({ ...csrForm, keySize: v })}
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
                <Label htmlFor="csr-org">Organization</Label>
                <Input
                  id="csr-org"
                  placeholder="My Company"
                  value={csrForm.organization}
                  onChange={(e) => setCsrForm({ ...csrForm, organization: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="csr-country">Country</Label>
                <Input
                  id="csr-country"
                  placeholder="US"
                  maxLength={2}
                  value={csrForm.country}
                  onChange={(e) => setCsrForm({ ...csrForm, country: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCSRDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateCSR} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileKey className="mr-2 h-4 w-4" />
                  Generate CSR
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSR Result Dialog */}
      <Dialog open={showCSRResult} onOpenChange={setShowCSRResult}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              CSR Generated Successfully
            </DialogTitle>
            <DialogDescription>
              Your Certificate Signing Request has been generated. Send the CSR to your CA for signing.
            </DialogDescription>
          </DialogHeader>
          {generatedCSR && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{generatedCSR.type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Common Name</p>
                  <p className="font-medium">{generatedCSR.commonName}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>CSR (PEM)</Label>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleCopyToClipboard(generatedCSR.csrPem, 'CSR')}
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    Copy
                  </Button>
                </div>
                <Textarea
                  value={generatedCSR.csrPem}
                  readOnly
                  rows={8}
                  className="font-mono text-xs"
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => window.open(generatedCSR.download.csr, '_blank')}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download CSR
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => window.open(generatedCSR.download.key, '_blank')}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Key
                </Button>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Important</AlertTitle>
                <AlertDescription className="text-sm">
                  Keep the private key secure! After uploading the signed certificate, the key will be used to create the PKCS#12 bundle.
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowCSRResult(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Signed Certificate Dialog */}
      <Dialog open={showUploadCertDialog} onOpenChange={setShowUploadCertDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Signed Certificate</DialogTitle>
            <DialogDescription>
              Upload the certificate signed by your external CA for CSR: {selectedCSR?.commonName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!uploadedCertResult ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="cert-pem">Signed Certificate (PEM) *</Label>
                  <Textarea
                    id="cert-pem"
                    placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                    value={uploadCertForm.certificatePem}
                    onChange={(e) => setUploadCertForm({ ...uploadCertForm, certificatePem: e.target.value })}
                    rows={8}
                    className="font-mono text-xs"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="chain-pem">Certificate Chain (Optional)</Label>
                  <Textarea
                    id="chain-pem"
                    placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                    value={uploadCertForm.chainPem}
                    onChange={(e) => setUploadCertForm({ ...uploadCertForm, chainPem: e.target.value })}
                    rows={6}
                    className="font-mono text-xs"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <Alert className="border-green-500">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertTitle>Success!</AlertTitle>
                  <AlertDescription>
                    Certificate uploaded and deployed successfully.
                  </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Serial Number</p>
                    <p className="font-mono text-xs">{uploadedCertResult.certificate.serialNumber}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Common Name</p>
                    <p className="font-medium">{uploadedCertResult.certificate.commonName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Expires</p>
                    <p className="font-medium">
                      {new Date(uploadedCertResult.certificate.expiryDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge variant={uploadedCertResult.certificate.status === 'ACTIVE' ? 'default' : 'destructive'}>
                      {uploadedCertResult.certificate.status}
                    </Badge>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={handleDeployToStrongSwan}
                    disabled={deploying}
                  >
                    {deploying ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Deploy to strongSwan
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            {!uploadedCertResult ? (
              <>
                <Button variant="outline" onClick={() => setShowUploadCertDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUploadCertificate} disabled={uploadingCert}>
                  {uploadingCert ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Certificate
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button onClick={() => {
                setShowUploadCertDialog(false)
                setUploadedCertResult(null)
                setSelectedCSR(null)
              }}>
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
