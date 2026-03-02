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
} from 'lucide-react'
import { toast } from 'sonner'
import { VpnSettings } from './vpn-settings'

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

  useEffect(() => {
    fetchSmtpConfig()
    fetchBackups()
    fetchApiKeys()
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="vpn">
            <Server className="mr-2 h-4 w-4" />
            VPN Config
          </TabsTrigger>
          <TabsTrigger value="smtp">
            <Mail className="mr-2 h-4 w-4" />
            SMTP
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="mr-2 h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="backup">
            <Database className="mr-2 h-4 w-4" />
            Backup
          </TabsTrigger>
        </TabsList>

        {/* VPN Configuration Tab */}
        <TabsContent value="vpn">
          <VpnSettings />
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

        {/* Security Settings Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
              <CardDescription>
                Authentication and security policies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    Require 2FA for admin accounts
                  </p>
                </div>
                <Switch />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Session Timeout</Label>
                  <p className="text-sm text-muted-foreground">
                    Auto-logout after inactivity
                  </p>
                </div>
                <Select defaultValue="24">
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hour</SelectItem>
                    <SelectItem value="4">4 hours</SelectItem>
                    <SelectItem value="8">8 hours</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="168">7 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Security Note</AlertTitle>
                <AlertDescription>
                  CA private keys are stored in /etc/swanctl/private/ with 600 permissions.
                  Never expose these files via the web interface.
                </AlertDescription>
              </Alert>

              <Button onClick={handleSave} disabled={isLoading}>
                <Save className="mr-2 h-4 w-4" />
                Save Security Settings
              </Button>
            </CardContent>
          </Card>

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

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>
                Alert and notification preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Certificate Expiry Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when certificates are about to expire
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="space-y-2">
                <Label>Alert Before Expiry (Days)</Label>
                <Select defaultValue="30">
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notification-email">Notification Email</Label>
                <Input id="notification-email" type="email" placeholder="alerts@24online.net" />
              </div>

              <Button variant="outline" onClick={handleSave}>
                Save Notification Settings
              </Button>
            </CardContent>
          </Card>
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
