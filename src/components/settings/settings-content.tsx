'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Settings, Shield, ShieldCheck, Bell, Database, KeyRound, AlertTriangle, Save, Server, Mail, RefreshCw, Download, Upload, Trash2, CheckCircle2, XCircle, Clock, HardDrive, Plus, Copy, Eye, EyeOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { VpnSettings } from './vpn-settings'
import { SecuritySettings } from './security-settings'
import { RadiusLdapSettings } from './radius-ldap-settings'
import { GeoIpSettings } from './geo-ip-settings'
import { GuestUsersSettings } from './guest-users-settings'
import { VpnSessionsSettings } from './vpn-sessions-settings'
import { SiemIntegrationSettings } from './siem-integration-settings'
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
  key?: string
}

export function SettingsContent() {
  const [isLoading, setIsLoading] = useState(false)

  // SMTP State
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig>({
    id: '', host: '', port: 587, username: '',
    fromEmail: '', fromName: 'VPN PKI Manager', useTls: true, isEnabled: false,
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
        if (data.config) setSmtpConfig(data.config)
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
        body: JSON.stringify({ ...smtpConfig, password: smtpPassword || undefined }),
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
      const response = await fetch(`/api/backup/${backup.id}/restore`, { method: 'POST' })
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
      const response = await fetch(`/api/backup/${backup.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete backup')
      toast.success('Backup deleted')
      fetchBackups()
    } catch (error) {
      toast.error('Failed to delete backup')
    }
  }

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
      const response = await fetch(`/api/api-keys/${key.id}`, { method: 'DELETE' })
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">System configuration and preferences</p>
        </div>
      </div>

      <Tabs defaultValue="vpn" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-10 h-auto">
          <TabsTrigger value="vpn" className="text-xs sm:text-sm"><Server className="mr-1 sm:mr-2 h-4 w-4" /><span className="hidden sm:inline">VPN</span> Config</TabsTrigger>
          <TabsTrigger value="security" className="text-xs sm:text-sm"><Shield className="mr-1 sm:mr-2 h-4 w-4" /><span className="hidden sm:inline">2FA &</span> OCSP</TabsTrigger>
          <TabsTrigger value="radius-ldap" className="text-xs sm:text-sm"><Database className="mr-1 sm:mr-2 h-4 w-4" /><span className="hidden sm:inline">RADIUS/LDAP</span></TabsTrigger>
          <TabsTrigger value="geo-ip" className="text-xs sm:text-sm"><Settings className="mr-1 sm:mr-2 h-4 w-4" />Geo/IP</TabsTrigger>
          <TabsTrigger value="guests" className="text-xs sm:text-sm"><KeyRound className="mr-1 sm:mr-2 h-4 w-4" />Guests</TabsTrigger>
          <TabsTrigger value="sessions" className="text-xs sm:text-sm"><RefreshCw className="mr-1 sm:mr-2 h-4 w-4" />Sessions</TabsTrigger>
          <TabsTrigger value="siem" className="text-xs sm:text-sm"><Bell className="mr-1 sm:mr-2 h-4 w-4" />SIEM</TabsTrigger>
          <TabsTrigger value="smtp" className="text-xs sm:text-sm"><Mail className="mr-1 sm:mr-2 h-4 w-4" />SMTP</TabsTrigger>
          <TabsTrigger value="rate-limit" className="text-xs sm:text-sm"><Shield className="mr-1 sm:mr-2 h-4 w-4" />Rate Limit</TabsTrigger>
          <TabsTrigger value="firewall" className="text-xs sm:text-sm"><ShieldCheck className="mr-1 sm:mr-2 h-4 w-4" />Firewall</TabsTrigger>
        </TabsList>

        <TabsContent value="vpn"><VpnSettings /></TabsContent>

        <TabsContent value="security"><SecuritySettings /></TabsContent>

        <TabsContent value="radius-ldap"><RadiusLdapSettings /></TabsContent>

        <TabsContent value="geo-ip"><GeoIpSettings /></TabsContent>

        <TabsContent value="guests"><GuestUsersSettings /></TabsContent>

        <TabsContent value="sessions"><VpnSessionsSettings /></TabsContent>

        <TabsContent value="siem"><SiemIntegrationSettings /></TabsContent>

        <TabsContent value="rate-limit"><RateLimitSettings /></TabsContent>

        <TabsContent value="firewall"><FirewallSettings /></TabsContent>

        <TabsContent value="smtp">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                SMTP Configuration
              </CardTitle>
              <CardDescription>Configure email server for notifications and alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Send email alerts for certificate expirations and system events</p>
                </div>
                <Switch checked={smtpConfig.isEnabled} onCheckedChange={(checked) => setSmtpConfig({ ...smtpConfig, isEnabled: checked })} />
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtp-host">SMTP Host</Label>
                  <Input id="smtp-host" placeholder="smtp.example.com" value={smtpConfig.host} onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-port">SMTP Port</Label>
                  <Input id="smtp-port" type="number" value={smtpConfig.port} onChange={(e) => setSmtpConfig({ ...smtpConfig, port: parseInt(e.target.value) || 587 })} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtp-username">Username (optional)</Label>
                  <Input id="smtp-username" placeholder="username" value={smtpConfig.username || ''} onChange={(e) => setSmtpConfig({ ...smtpConfig, username: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-password">Password</Label>
                  <Input id="smtp-password" type="password" placeholder="••••••••" value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="from-email">From Email</Label>
                  <Input id="from-email" type="email" placeholder="noreply@example.com" value={smtpConfig.fromEmail} onChange={(e) => setSmtpConfig({ ...smtpConfig, fromEmail: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="from-name">From Name</Label>
                  <Input id="from-name" placeholder="VPN PKI Manager" value={smtpConfig.fromName} onChange={(e) => setSmtpConfig({ ...smtpConfig, fromName: e.target.value })} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Use TLS</Label>
                  <p className="text-sm text-muted-foreground">Enable TLS encryption for SMTP connection</p>
                </div>
                <Switch checked={smtpConfig.useTls} onCheckedChange={(checked) => setSmtpConfig({ ...smtpConfig, useTls: checked })} />
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>Test Email Configuration</Label>
                <div className="flex gap-2">
                  <Input placeholder="test@example.com" type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
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
      </Tabs>

      {/* API Keys Dialog */}
      <Dialog open={showCreateKeyDialog} onOpenChange={setShowCreateKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>Generate a new API key for external integrations</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input placeholder="e.g., Monitoring System" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <Select value={newKeyPermissions} onValueChange={setNewKeyPermissions}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <SelectTrigger><SelectValue placeholder="Never" /></SelectTrigger>
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
            <Button variant="outline" onClick={() => setShowCreateKeyDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateApiKey} disabled={creatingKey}>{creatingKey ? 'Creating...' : 'Create Key'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>Copy your API key now. It will not be shown again.</DialogDescription>
          </DialogHeader>
          {newlyCreatedKey && (
            <div className="space-y-4">
              <Alert className="bg-green-500/10 border-green-500/20">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertTitle>Key Created Successfully</AlertTitle>
                <AlertDescription>Name: {newlyCreatedKey.name}<br />Permissions: {newlyCreatedKey.permissions}</AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label>Your API Key</Label>
                <div className="flex gap-2">
                  <Input type={showKey ? 'text' : 'password'} value={newlyCreatedKey.key} readOnly className="font-mono text-sm" />
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
                <AlertDescription>Store this key securely. You won&apos;t be able to see it again after closing this dialog.</AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowKeyDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
