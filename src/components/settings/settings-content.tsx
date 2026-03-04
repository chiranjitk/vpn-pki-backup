'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Settings,
  Shield,
  ShieldCheck,
  Bell,
  Database,
  KeyRound,
  AlertTriangle,
  Save,
  Server,
  Mail,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  HardDrive,
  Plus,
  Copy,
  Eye,
  EyeOff,
  Users,
  Play,
  Loader2,
  ArrowRight,
  Globe,
  Activity,
  BarChart3,
} from 'lucide-react'
import { toast } from 'sonner'
import { VpnSettings } from './vpn-settings'
import { SecuritySettings } from './security-settings'
import { SiemIntegrationSettings } from './siem-integration-settings'
import { FirewallIntegrationSettings } from './firewall-integration-settings'
import { RateLimitSettings } from './rate-limit-settings'
import { FirewallSettings } from './firewall-settings'

interface SmtpConfig {
  id: string
  host: string
  port: number
  username: string | null
  fromEmail: string
  fromName: string
  useTls: boolean
  isEnabled: boolean
}

interface BackupRecord {
  id: string
  filename: string
  size: number
  type: string
  status: string
  createdAt: string
}

interface ApiKey {
  id: string
  name: string
  prefix: string
  permissions: string
  isEnabled: boolean
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
  key?: string // Only present when newly created
}

interface RadiusConfig {
  id: string | null
  host: string
  port: number
  secret: string
  timeout: number
  accountingEnabled: boolean
  accountingPort: number
  isEnabled: boolean
  lastTestAt: string | null
  lastTestSuccess: boolean | null
  lastTestError: string | null
}

interface LdapConfig {
  id: string | null
  serverUrl: string
  bindDn: string
  bindPassword: string
  baseDn: string
  useTls: boolean
  tlsVerifyCert: boolean
  timeout: number
  isEnabled: boolean
  syncInterval: number
  syncFilter: string
  syncAttributeUsername: string
  syncAttributeEmail: string
  syncAttributeFullName: string
  syncAttributeDepartment: string | null
  lastSyncAt: string | null
  lastSyncSuccess: boolean | null
  lastSyncError: string | null
  lastSyncCount: number | null
  autoCreateUsers: boolean
  autoDisableUsers: boolean
}

interface LdapSyncLog {
  id: string
  startedAt: string
  completedAt: string | null
  duration: number | null
  usersFound: number
  usersCreated: number
  usersUpdated: number
  usersDisabled: number
  usersUnchanged: number
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL'
  errorMessage: string | null
}

export function SettingsContent() {
  const [isLoading, setIsLoading] = useState(false)

  // SMTP State
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig>({
    id: '',
    host: '',
    port: 587,
    username: '',
    fromEmail: '',
    fromName: 'VPN PKI Manager',
    useTls: true,
    isEnabled: false,
  })
  const [smtpPassword, setSmtpPassword] = useState('')
  const [testEmail, setTestEmail] = useState('')
  const [testingSmtp, setTestingSmtp] = useState(false)

  // Backup State
  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [backupsLoading, setBackupsLoading] = useState(false)
  const [creatingBackup, setCreatingBackup] = useState(false)
  const [restoringBackup, setRestoringBackup] = useState<string | null>(null)

  // API Keys State
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [apiKeysLoading, setApiKeysLoading] = useState(false)
  const [showCreateKeyDialog, setShowCreateKeyDialog] = useState(false)
  const [showKeyDialog, setShowKeyDialog] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyPermissions, setNewKeyPermissions] = useState('read')
  const [newKeyExpiry, setNewKeyExpiry] = useState<string>('never')
  const [creatingKey, setCreatingKey] = useState(false)
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<ApiKey | null>(null)
  const [showKey, setShowKey] = useState(false)

  // RADIUS State
  const [radiusConfig, setRadiusConfig] = useState<RadiusConfig>({
    id: null,
    host: '',
    port: 1812,
    secret: '',
    timeout: 5,
    accountingEnabled: false,
    accountingPort: 1813,
    isEnabled: false,
    lastTestAt: null,
    lastTestSuccess: null,
    lastTestError: null,
  })
  const [testingRadius, setTestingRadius] = useState(false)
  const [savingRadius, setSavingRadius] = useState(false)

  // LDAP State
  const [ldapConfig, setLdapConfig] = useState<LdapConfig>({
    id: null,
    serverUrl: '',
    bindDn: '',
    bindPassword: '',
    baseDn: '',
    useTls: true,
    tlsVerifyCert: true,
    timeout: 30,
    isEnabled: false,
    syncInterval: 3600,
    syncFilter: '(objectClass=user)',
    syncAttributeUsername: 'sAMAccountName',
    syncAttributeEmail: 'mail',
    syncAttributeFullName: 'displayName',
    syncAttributeDepartment: 'department',
    lastSyncAt: null,
    lastSyncSuccess: null,
    lastSyncError: null,
    lastSyncCount: null,
    autoCreateUsers: true,
    autoDisableUsers: false,
  })
  const [testingLdap, setTestingLdap] = useState(false)
  const [savingLdap, setSavingLdap] = useState(false)
  const [syncingLdap, setSyncingLdap] = useState(false)
  const [syncLogs, setSyncLogs] = useState<LdapSyncLog[]>([])

  useEffect(() => {
    fetchSmtpConfig()
    fetchBackups()
    fetchApiKeys()
    fetchRadiusConfig()
    fetchLdapConfig()
  }, [])

  const fetchSmtpConfig = async () => {
    try {
      const response = await fetch('/api/smtp')
      if (response.ok) {
        const data = await response.json()
        if (data.config) {
          setSmtpConfig(data.config)
        }
      }
    } catch (error) {
      console.error('Failed to fetch SMTP config:', error)
    }
  }

  const fetchBackups = async () => {
    setBackupsLoading(true)
    try {
      const response = await fetch('/api/backup')
      if (response.ok) {
        const data = await response.json()
        setBackups(data.backups || [])
      }
    } catch (error) {
      console.error('Failed to fetch backups:', error)
    } finally {
      setBackupsLoading(false)
    }
  }

  const fetchApiKeys = async () => {
    setApiKeysLoading(true)
    try {
      const response = await fetch('/api/api-keys')
      if (response.ok) {
        const data = await response.json()
        setApiKeys(data.keys || [])
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error)
    } finally {
      setApiKeysLoading(false)
    }
  }

  const fetchRadiusConfig = async () => {
    try {
      const response = await fetch('/api/radius')
      if (response.ok) {
        const data = await response.json()
        if (data.config) {
          setRadiusConfig(data.config)
        }
      }
    } catch (error) {
      console.error('Failed to fetch RADIUS config:', error)
    }
  }

  const fetchLdapConfig = async () => {
    try {
      const response = await fetch('/api/ldap')
      if (response.ok) {
        const data = await response.json()
        if (data.config) {
          setLdapConfig(data.config)
        }
      }
    } catch (error) {
      console.error('Failed to fetch LDAP config:', error)
    }
  }

  const fetchSyncLogs = async () => {
    try {
      const response = await fetch('/api/ldap/sync?limit=10')
      if (response.ok) {
        const data = await response.json()
        setSyncLogs(data.logs || [])
      }
    } catch (error) {
      console.error('Failed to fetch sync logs:', error)
    }
  }

  const handleSaveRadius = async () => {
    if (!radiusConfig.host) {
      toast.error('Host is required')
      return
    }
    setSavingRadius(true)
    try {
      const response = await fetch('/api/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(radiusConfig),
      })
      if (response.ok) {
        toast.success('RADIUS configuration saved')
        fetchRadiusConfig()
      } else {
        throw new Error('Failed to save')
      }
    } catch (error) {
      toast.error('Failed to save RADIUS configuration')
    } finally {
      setSavingRadius(false)
    }
  }

  const handleTestRadius = async () => {
    if (!radiusConfig.host) {
      toast.error('Please configure RADIUS host first')
      return
    }
    if (!radiusConfig.isEnabled) {
      toast.error('Please enable RADIUS first')
      return
    }
    setTestingRadius(true)
    try {
      const response = await fetch('/api/radius/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test', password: 'test' }),
      })
      if (response.ok) {
        const data = await response.json()
        toast.success(data.message || 'RADIUS test successful')
        fetchRadiusConfig()
      } else {
        throw new Error(data?.error || 'Test failed')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'RADIUS test failed')
    } finally {
      setTestingRadius(false)
    }
  }

  const handleSaveLdap = async () => {
    if (!ldapConfig.serverUrl || !ldapConfig.bindDn || !ldapConfig.baseDn) {
      toast.error('Server URL, Bind DN, and Base DN are required')
      return
    }
    setSavingLdap(true)
    try {
      const response = await fetch('/api/ldap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ldapConfig),
      })
      if (response.ok) {
        toast.success('LDAP configuration saved')
        fetchLdapConfig()
      } else {
        throw new Error('Failed to save')
      }
    } catch (error) {
      toast.error('Failed to save LDAP configuration')
    } finally {
      setSavingLdap(false)
    }
  }

  const handleTestLdap = async () => {
    if (!ldapConfig.serverUrl) {
      toast.error('Please configure LDAP server URL first')
      return
    }
    if (!ldapConfig.isEnabled) {
      toast.error('Please enable LDAP first')
      return
    }
    setTestingLdap(true)
    try {
      const response = await fetch('/api/ldap/test', { method: 'POST' })
      if (response.ok) {
        const data = await response.json()
        toast.success(data.message || 'LDAP connection successful')
        fetchLdapConfig()
      } else {
        throw new Error(data?.error || 'Test failed')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'LDAP test failed')
    } finally {
      setTestingLdap(false)
    }
  }

  const handleSyncLdap = async () => {
    if (!ldapConfig.isEnabled) {
      toast.error('Please enable LDAP first')
      return
    }
    setSyncingLdap(true)
    try {
      const response = await fetch('/api/ldap/sync', { method: 'POST' })
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          toast.success(`LDAP sync completed: ${data.syncLog?.usersCreated || 0} created, ${data.syncLog?.usersUpdated || 0} updated`)
          fetchLdapConfig()
          fetchSyncLogs()
        } else {
          toast.error(data.error || 'LDAP sync failed')
        }
      } else {
        throw new Error('Sync failed')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'LDAP sync failed')
    } finally {
      setSyncingLdap(false)
    }
  }

  const handleSave = async () => {
    setIsLoading(true)
    setTimeout(() => {
      toast.success('Settings saved successfully')
      setIsLoading(false)
    }, 500)
  }

  const handleSaveSmtp = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...smtpConfig,
          password: smtpPassword || undefined,
        }),
      })

      if (!response.ok) throw new Error('Failed to save SMTP configuration')

      toast.success('SMTP configuration saved')
    } catch (error) {
      toast.error('Failed to save SMTP configuration')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestSmtp = async () => {
    if (!testEmail) {
      toast.error('Please enter a test email address')
      return
    }

    setTestingSmtp(true)
    try {
      const response = await fetch('/api/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmail }),
      })

      if (!response.ok) throw new Error('Failed to send test email')

      toast.success('Test email sent successfully')
    } catch (error) {
      toast.error('Failed to send test email')
    } finally {
      setTestingSmtp(false)
    }
  }

  const handleCreateBackup = async (type: 'FULL' | 'DATABASE' | 'CONFIGURATION') => {
    setCreatingBackup(true)
    try {
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })

      if (!response.ok) throw new Error('Failed to create backup')

      const data = await response.json()
      toast.success(`Backup created: ${data.backup?.filename || 'successfully'}`)
      fetchBackups()
    } catch (error) {
      toast.error('Failed to create backup')
    } finally {
      setCreatingBackup(false)
    }
  }

  const handleDownloadBackup = async (backup: BackupRecord) => {
    window.open(`/api/backup/${backup.id}/download`, '_blank')
  }

  const handleRestoreBackup = async (backup: BackupRecord) => {
    if (!confirm(`Are you sure you want to restore from ${backup.filename}? This will overwrite current data.`)) return

    setRestoringBackup(backup.id)
    try {
      const response = await fetch(`/api/backup/${backup.id}/restore`, {
        method: 'POST',
      })

      if (!response.ok) throw new Error('Failed to restore backup')

      toast.success('Backup restored successfully. Please refresh the page.')
    } catch (error) {
      toast.error('Failed to restore backup')
    } finally {
      setRestoringBackup(null)
    }
  }

  const handleDeleteBackup = async (backup: BackupRecord) => {
    if (!confirm(`Delete backup ${backup.filename}?`)) return

    try {
      const response = await fetch(`/api/backup/${backup.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete backup')

      toast.success('Backup deleted')
      fetchBackups()
    } catch (error) {
      toast.error('Failed to delete backup')
    }
  }

  // API Key handlers
  const handleCreateApiKey = async () => {
    if (!newKeyName) {
      toast.error('Please enter a name for the API key')
      return
    }

    setCreatingKey(true)
    try {
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName,
          permissions: newKeyPermissions,
          expiresInDays: newKeyExpiry && newKeyExpiry !== 'never' ? parseInt(newKeyExpiry) : undefined,
        }),
      })

      if (!response.ok) throw new Error('Failed to create API key')

      const data = await response.json()
      setNewlyCreatedKey(data.key)
      setShowCreateKeyDialog(false)
      setShowKeyDialog(true)
      setNewKeyName('')
      setNewKeyPermissions('read')
      setNewKeyExpiry('never')
      fetchApiKeys()
    } catch (error) {
      toast.error('Failed to create API key')
    } finally {
      setCreatingKey(false)
    }
  }

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    toast.success('API key copied to clipboard')
  }

  const handleToggleKeyStatus = async (keyId: string, isEnabled: boolean) => {
    try {
      const response = await fetch(`/api/api-keys/${keyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !isEnabled }),
      })

      if (!response.ok) throw new Error('Failed to update API key')

      toast.success(`API key ${!isEnabled ? 'enabled' : 'disabled'}`)
      fetchApiKeys()
    } catch (error) {
      toast.error('Failed to update API key')
    }
  }

  const handleDeleteApiKey = async (key: ApiKey) => {
    if (!confirm(`Delete API key "${key.name}"? This action cannot be undone.`)) return

    try {
      const response = await fetch(`/api/api-keys/${key.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete API key')

      toast.success('API key deleted')
      fetchApiKeys()
    } catch (error) {
      toast.error('Failed to delete API key')
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            System configuration and preferences
          </p>
        </div>
      </div>

      <Tabs defaultValue="vpn" className="space-y-4">
        <TabsList className="grid w-full grid-cols-10 h-auto">
          <TabsTrigger value="vpn" className="text-xs sm:text-sm"><Server className="mr-1 sm:mr-2 h-4 w-4" /><span className="hidden sm:inline">VPN</span> Config</TabsTrigger>
          <TabsTrigger value="security" className="text-xs sm:text-sm"><Shield className="mr-1 sm:mr-2 h-4 w-4" /><span className="hidden sm:inline">2FA &</span> OCSP</TabsTrigger>
          <TabsTrigger value="radius" className="text-xs sm:text-sm"><Database className="mr-1 sm:mr-2 h-4 w-4" /><span className="hidden sm:inline">RADIUS</span></TabsTrigger>
          <TabsTrigger value="ldap" className="text-xs sm:text-sm"><Users className="mr-1 sm:mr-2 h-4 w-4" /><span className="hidden sm:inline">LDAP</span></TabsTrigger>
          <TabsTrigger value="siem" className="text-xs sm:text-sm"><BarChart3 className="mr-1 sm:mr-2 h-4 w-4" />SIEM</TabsTrigger>
          <TabsTrigger value="smtp" className="text-xs sm:text-sm"><Mail className="mr-1 sm:mr-2 h-4 w-4" />SMTP</TabsTrigger>
          <TabsTrigger value="rate-limit" className="text-xs sm:text-sm"><Shield className="mr-1 sm:mr-2 h-4 w-4" /><span className="hidden sm:inline">Rate</span> Limit</TabsTrigger>
          <TabsTrigger value="kernel-firewall" className="text-xs sm:text-sm"><ShieldCheck className="mr-1 sm:mr-2 h-4 w-4" /><span className="hidden sm:inline">Kernel</span> FW</TabsTrigger>
          <TabsTrigger value="integration" className="text-xs sm:text-sm"><Globe className="mr-1 sm:mr-2 h-4 w-4" />Integration</TabsTrigger>
          <TabsTrigger value="backup" className="text-xs sm:text-sm"><HardDrive className="mr-1 sm:mr-2 h-4 w-4" />Backup</TabsTrigger>
        </TabsList>

        {/* VPN Configuration Tab */}
        <TabsContent value="vpn">
          <VpnSettings />
        </TabsContent>

        <TabsContent value="security">
          <SecuritySettings />
        </TabsContent>

        <TabsContent value="siem">
          <SiemIntegrationSettings />
        </TabsContent>

        <TabsContent value="integration">
          <FirewallIntegrationSettings />
        </TabsContent>

        {/* SMTP Configuration Tab */}
        <TabsContent value="smtp">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                SMTP Configuration
              </CardTitle>
              <CardDescription>
                Configure email server for notifications and alerts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send email alerts for certificate expirations and system events
                  </p>
                </div>
                <Switch
                  checked={smtpConfig.isEnabled}
                  onCheckedChange={(checked) => setSmtpConfig({ ...smtpConfig, isEnabled: checked })}
                />
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtp-host">SMTP Host</Label>
                  <Input
                    id="smtp-host"
                    placeholder="smtp.example.com"
                    value={smtpConfig.host}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-port">SMTP Port</Label>
                  <Input
                    id="smtp-port"
                    type="number"
                    value={smtpConfig.port}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, port: parseInt(e.target.value) || 587 })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtp-username">Username (optional)</Label>
                  <Input
                    id="smtp-username"
                    placeholder="username"
                    value={smtpConfig.username || ''}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-password">Password</Label>
                  <Input
                    id="smtp-password"
                    type="password"
                    placeholder="••••••••"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="from-email">From Email</Label>
                  <Input
                    id="from-email"
                    type="email"
                    placeholder="noreply@example.com"
                    value={smtpConfig.fromEmail}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, fromEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="from-name">From Name</Label>
                  <Input
                    id="from-name"
                    placeholder="VPN PKI Manager"
                    value={smtpConfig.fromName}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, fromName: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Use TLS</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable TLS encryption for SMTP connection
                  </p>
                </div>
                <Switch
                  checked={smtpConfig.useTls}
                  onCheckedChange={(checked) => setSmtpConfig({ ...smtpConfig, useTls: checked })}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>Test Email Configuration</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="test@example.com"
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                  <Button variant="outline" onClick={handleTestSmtp} disabled={testingSmtp}>
                    {testingSmtp ? 'Sending...' : 'Send Test Email'}
                  </Button>
                </div>
              </div>

              <Button onClick={handleSaveSmtp} disabled={isLoading}>
                <Save className="mr-2 h-4 w-4" />
                Save SMTP Configuration
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RADIUS Configuration Tab */}
        <TabsContent value="radius">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                RADIUS Authentication
              </CardTitle>
              <CardDescription>
                Configure RADIUS server for VPN user authentication
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable RADIUS Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    Use RADIUS server for authenticating VPN users
                  </p>
                </div>
                <Switch
                  checked={radiusConfig.isEnabled}
                  onCheckedChange={(checked) => setRadiusConfig({ ...radiusConfig, isEnabled: checked })}
                />
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="radius-host">RADIUS Server Host</Label>
                  <Input
                    id="radius-host"
                    placeholder="radius.example.com"
                    value={radiusConfig.host}
                    onChange={(e) => setRadiusConfig({ ...radiusConfig, host: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="radius-port">Authentication Port</Label>
                  <Input
                    id="radius-port"
                    type="number"
                    value={radiusConfig.port}
                    onChange={(e) => setRadiusConfig({ ...radiusConfig, port: parseInt(e.target.value) || 1812 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="radius-secret">Shared Secret</Label>
                <Input
                  id="radius-secret"
                  type="password"
                  placeholder="Enter shared secret"
                  value={radiusConfig.secret}
                  onChange={(e) => setRadiusConfig({ ...radiusConfig, secret: e.target.value })}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="radius-timeout">Connection Timeout (seconds)</Label>
                  <Input
                    id="radius-timeout"
                    type="number"
                    value={radiusConfig.timeout}
                    onChange={(e) => setRadiusConfig({ ...radiusConfig, timeout: parseInt(e.target.value) || 5 })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Accounting</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable RADIUS accounting for session tracking
                    </p>
                  </div>
                  <Switch
                    checked={radiusConfig.accountingEnabled}
                    onCheckedChange={(checked) => setRadiusConfig({ ...radiusConfig, accountingEnabled: checked })}
                  />
                </div>
              </div>

              {radiusConfig.accountingEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="radius-accounting-port">Accounting Port</Label>
                  <Input
                    id="radius-accounting-port"
                    type="number"
                    value={radiusConfig.accountingPort}
                    onChange={(e) => setRadiusConfig({ ...radiusConfig, accountingPort: parseInt(e.target.value) || 1813 })}
                  />
                </div>
              )}

              {radiusConfig.lastTestAt && (
                <Alert variant={radiusConfig.lastTestSuccess ? 'default' : 'destructive'}>
                  {radiusConfig.lastTestSuccess ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {radiusConfig.lastTestSuccess ? 'Connection Successful' : 'Connection Failed'}
                  </AlertTitle>
                  <AlertDescription>
                    Last tested: {new Date(radiusConfig.lastTestAt).toLocaleString()}
                    {radiusConfig.lastTestError && (
                      <p className="text-sm text-destructive-foreground mt-1">Error: {radiusConfig.lastTestError}</p>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleTestRadius} disabled={testingRadius || !radiusConfig.host || !radiusConfig.isEnabled}>
                  {testingRadius ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                  {testingRadius ? 'Testing...' : 'Test Connection'}
                </Button>
                <Button onClick={handleSaveRadius} disabled={savingRadius || !radiusConfig.host}>
                  {savingRadius ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {savingRadius ? 'Saving...' : 'Save Configuration'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LDAP Configuration Tab */}
        <TabsContent value="ldap">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                LDAP / Active Directory Sync
              </CardTitle>
              <CardDescription>
                Configure LDAP for automatic user synchronization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable LDAP Sync</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically sync users from LDAP/Active Directory
                  </p>
                </div>
                <Switch
                  checked={ldapConfig.isEnabled}
                  onCheckedChange={(checked) => setLdapConfig({ ...ldapConfig, isEnabled: checked })}
                />
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ldap-server-url">Server URL</Label>
                  <Input
                    id="ldap-server-url"
                    placeholder="ldap://ldap.example.com:389"
                    value={ldapConfig.serverUrl}
                    onChange={(e) => setLdapConfig({ ...ldapConfig, serverUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ldap-bind-dn">Bind DN</Label>
                  <Input
                    id="ldap-bind-dn"
                    placeholder="CN=admin,DC=example,DC=com"
                    value={ldapConfig.bindDn}
                    onChange={(e) => setLdapConfig({ ...ldapConfig, bindDn: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ldap-bind-password">Bind Password</Label>
                  <Input
                    id="ldap-bind-password"
                    type="password"
                    placeholder="Enter bind password"
                    value={ldapConfig.bindPassword}
                    onChange={(e) => setLdapConfig({ ...ldapConfig, bindPassword: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ldap-base-dn">Base DN</Label>
                  <Input
                    id="ldap-base-dn"
                    placeholder="DC=example,DC=com"
                    value={ldapConfig.baseDn}
                    onChange={(e) => setLdapConfig({ ...ldapConfig, baseDn: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center justify-between">
                  <Label>Use TLS/SSL</Label>
                  <Switch
                    checked={ldapConfig.useTls}
                    onCheckedChange={(checked) => setLdapConfig({ ...ldapConfig, useTls: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Verify Certificate</Label>
                  <Switch
                    checked={ldapConfig.tlsVerifyCert}
                    onCheckedChange={(checked) => setLdapConfig({ ...ldapConfig, tlsVerifyCert: checked })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ldap-timeout">Timeout (sec)</Label>
                  <Input
                    id="ldap-timeout"
                    type="number"
                    value={ldapConfig.timeout}
                    onChange={(e) => setLdapConfig({ ...ldapConfig, timeout: parseInt(e.target.value) || 30 })}
                  />
                </div>
              </div>

              <Separator />

              <h4 className="font-medium">Attribute Mapping</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ldap-attr-username">Username Attribute</Label>
                  <Input
                    id="ldap-attr-username"
                    placeholder="sAMAccountName"
                    value={ldapConfig.syncAttributeUsername}
                    onChange={(e) => setLdapConfig({ ...ldapConfig, syncAttributeUsername: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ldap-attr-email">Email Attribute</Label>
                  <Input
                    id="ldap-attr-email"
                    placeholder="mail"
                    value={ldapConfig.syncAttributeEmail}
                    onChange={(e) => setLdapConfig({ ...ldapConfig, syncAttributeEmail: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ldap-attr-fullname">Full Name Attribute</Label>
                  <Input
                    id="ldap-attr-fullname"
                    placeholder="displayName"
                    value={ldapConfig.syncAttributeFullName}
                    onChange={(e) => setLdapConfig({ ...ldapConfig, syncAttributeFullName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ldap-attr-department">Department Attribute</Label>
                  <Input
                    id="ldap-attr-department"
                    placeholder="department"
                    value={ldapConfig.syncAttributeDepartment || ''}
                    onChange={(e) => setLdapConfig({ ...ldapConfig, syncAttributeDepartment: e.target.value })}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-create Users</Label>
                    <p className="text-sm text-muted-foreground">Create users not in local DB</p>
                  </div>
                  <Switch
                    checked={ldapConfig.autoCreateUsers}
                    onCheckedChange={(checked) => setLdapConfig({ ...ldapConfig, autoCreateUsers: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-disable Users</Label>
                    <p className="text-sm text-muted-foreground">Disable users not in LDAP</p>
                  </div>
                  <Switch
                    checked={ldapConfig.autoDisableUsers}
                    onCheckedChange={(checked) => setLdapConfig({ ...ldapConfig, autoDisableUsers: checked })}
                  />
                </div>
              </div>

              {ldapConfig.lastSyncAt && (
                <Alert variant={ldapConfig.lastSyncSuccess ? 'default' : 'destructive'}>
                  {ldapConfig.lastSyncSuccess ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  <AlertTitle>{ldapConfig.lastSyncSuccess ? 'Last Sync Successful' : 'Last Sync Failed'}</AlertTitle>
                  <AlertDescription>
                    <p>Last synced: {new Date(ldapConfig.lastSyncAt).toLocaleString()}</p>
                    {ldapConfig.lastSyncCount !== null && <p>Users found: {ldapConfig.lastSyncCount}</p>}
                    {ldapConfig.lastSyncError && <p className="text-destructive-foreground">Error: {ldapConfig.lastSyncError}</p>}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={handleTestLdap} disabled={testingLdap || !ldapConfig.serverUrl || !ldapConfig.isEnabled}>
                  {testingLdap ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                  {testingLdap ? 'Testing...' : 'Test Connection'}
                </Button>
                <Button variant="outline" onClick={handleSyncLdap} disabled={syncingLdap || !ldapConfig.isEnabled}>
                  {syncingLdap ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  {syncingLdap ? 'Syncing...' : 'Sync Now'}
                </Button>
                <Button onClick={handleSaveLdap} disabled={savingLdap || !ldapConfig.serverUrl}>
                  {savingLdap ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {savingLdap ? 'Saving...' : 'Save Configuration'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Auto-Renewal Configuration Tab */}
        <TabsContent value="renewal">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Certificate Auto-Renewal
              </CardTitle>
              <CardDescription>
                Configure automatic certificate renewal settings (Managed PKI mode only)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Auto-Renewal</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically renew certificates before they expire
                  </p>
                </div>
                <Switch
                  checked={false}
                  onCheckedChange={() => toast.info('Configure renewal settings below')}
                />
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Days Before Expiry to Renew</Label>
                  <Select defaultValue="30">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Start renewal process this many days before expiry
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Notification Days</Label>
                  <Select defaultValue="60">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Send expiry warning emails this many days before
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Automatic Renewal Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically renew without admin approval
                  </p>
                </div>
                <Switch defaultChecked={false} />
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Managed PKI Only</AlertTitle>
                <AlertDescription>
                  Auto-renewal only works in Managed PKI mode. For External CA mode,
                  you need to manually request certificates from your CA.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button onClick={() => toast.success('Renewal settings saved')}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Renewal Settings
                </Button>
                <Button 
                  variant="outline" 
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/certificates/renewal?action=check', { method: 'POST' })
                      if (response.ok) {
                        toast.success('Renewal check completed')
                      } else {
                        toast.error('Renewal service not available')
                      }
                    } catch {
                      toast.error('Failed to run renewal check')
                    }
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Run Check Now
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Expiring Certificates Card */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Certificates Expiring Soon
              </CardTitle>
              <CardDescription>
                View and manage certificates that will expire within 90 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No certificates expiring soon</p>
                <p className="text-sm">Certificates nearing expiry will appear here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings Tab */}
        <TabsContent value="security">
          <SecuritySettings />

          {/* API Keys */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5" />
                    API Keys
                  </CardTitle>
                  <CardDescription>
                    Manage API keys for external integrations
                  </CardDescription>
                </div>
                <Button onClick={() => setShowCreateKeyDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Key
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {apiKeysLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <KeyRound className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No API keys found</p>
                  <p className="text-sm">Create an API key to access the platform programmatically</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Key Prefix</TableHead>
                        <TableHead>Permissions</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Used</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiKeys.map((key) => (
                        <TableRow key={key.id}>
                          <TableCell className="font-medium">{key.name}</TableCell>
                          <TableCell className="font-mono text-sm">{key.prefix}...</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-primary/10 text-primary">
                              {key.permissions}
                            </span>
                          </TableCell>
                          <TableCell>
                            {key.isEnabled ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle2 className="h-4 w-4" />
                                <span className="text-sm">Active</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-red-600">
                                <XCircle className="h-4 w-4" />
                                <span className="text-sm">Disabled</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{formatDate(key.lastUsedAt)}</TableCell>
                          <TableCell className="text-sm">{formatDate(key.expiresAt)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleToggleKeyStatus(key.id, key.isEnabled)}
                              >
                                {key.isEnabled ? 'Disable' : 'Enable'}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleDeleteApiKey(key)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>API Key Security</AlertTitle>
                <AlertDescription>
                  API keys are only shown once when created. Store them securely and never share them.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SIEM Integration Tab */}
        <TabsContent value="siem">
          <SiemIntegrationSettings />
        </TabsContent>

        {/* Firewall Integration Tab */}
        <TabsContent value="integration">
          <FirewallIntegrationSettings />
        </TabsContent>

        {/* Rate Limit Settings Tab */}
        <TabsContent value="rate-limit">
          <RateLimitSettings />
        </TabsContent>

        {/* Kernel Firewall Settings Tab */}
        <TabsContent value="kernel-firewall">
          <FirewallSettings />
        </TabsContent>

        {/* Backup Tab */}
        <TabsContent value="backup">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Backup & Restore
              </CardTitle>
              <CardDescription>
                Database and configuration backup management
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => handleCreateBackup('FULL')} disabled={creatingBackup}>
                  <HardDrive className="mr-2 h-4 w-4" />
                  {creatingBackup ? 'Creating...' : 'Full Backup'}
                </Button>
                <Button variant="outline" onClick={() => handleCreateBackup('DATABASE')} disabled={creatingBackup}>
                  <Database className="mr-2 h-4 w-4" />
                  Database Only
                </Button>
                <Button variant="outline" onClick={() => handleCreateBackup('CONFIGURATION')} disabled={creatingBackup}>
                  <Settings className="mr-2 h-4 w-4" />
                  Configuration Only
                </Button>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Available Backups</h3>
                  <Button variant="ghost" size="sm" onClick={fetchBackups} disabled={backupsLoading}>
                    <RefreshCw className={`h-4 w-4 ${backupsLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>

                {backupsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : backups.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No backups found</p>
                    <p className="text-sm">Create a backup to get started</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Filename</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {backups.map((backup) => (
                          <TableRow key={backup.id}>
                            <TableCell className="font-mono text-sm">{backup.filename}</TableCell>
                            <TableCell>
                              <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-primary/10 text-primary">
                                {backup.type}
                              </span>
                            </TableCell>
                            <TableCell>{formatBytes(backup.size)}</TableCell>
                            <TableCell>
                              {backup.status === 'COMPLETED' ? (
                                <div className="flex items-center gap-1 text-green-600">
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span className="text-sm">Completed</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-yellow-600">
                                  <Clock className="h-4 w-4" />
                                  <span className="text-sm">{backup.status}</span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">{formatDate(backup.createdAt)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleDownloadBackup(backup)}>
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleRestoreBackup(backup)}
                                  disabled={restoringBackup === backup.id}
                                >
                                  {restoringBackup === backup.id ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Upload className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteBackup(backup)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create API Key Dialog */}
      <Dialog open={showCreateKeyDialog} onOpenChange={setShowCreateKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Generate a new API key for external integrations
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g., Monitoring System"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <Select value={newKeyPermissions} onValueChange={setNewKeyPermissions}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Read Only</SelectItem>
                  <SelectItem value="read,write">Read & Write</SelectItem>
                  <SelectItem value="read,write,admin">Full Access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Expiry (optional)</Label>
              <Select value={newKeyExpiry} onValueChange={setNewKeyExpiry}>
                <SelectTrigger>
                  <SelectValue placeholder="Never" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateKeyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateApiKey} disabled={creatingKey}>
              {creatingKey ? 'Creating...' : 'Create Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show New API Key Dialog */}
      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              Copy your API key now. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          {newlyCreatedKey && (
            <div className="space-y-4">
              <Alert className="bg-green-500/10 border-green-500/20">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertTitle>Key Created Successfully</AlertTitle>
                <AlertDescription>
                  Name: {newlyCreatedKey.name}<br />
                  Permissions: {newlyCreatedKey.permissions}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Your API Key</Label>
                <div className="flex gap-2">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={newlyCreatedKey.key}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button variant="outline" size="icon" onClick={() => setShowKey(!showKey)}>
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleCopyKey(newlyCreatedKey.key || '')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Important</AlertTitle>
                <AlertDescription>
                  Store this key securely. You won't be able to see it again after closing this dialog.
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowKeyDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
