'use client'

import { useState, useEffect } from 'react'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Server, Database, RefreshCw, CheckCircle2, XCircle, Loader2, AlertTriangle, Play, Clock,
} from 'lucide-react'
import { toast } from 'sonner'

interface RadiusConfig {
  host: string
  port: number
  secret: string
  timeout: number
  accountingEnabled: boolean
  accountingPort: number
  isEnabled: boolean
}

interface LdapConfig {
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
  autoCreateUsers: boolean
  autoDisableUsers: boolean
  lastSyncAt?: string
  lastSyncSuccess?: boolean
}

export function RadiusLdapSettings() {
  const [radiusConfig, setRadiusConfig] = useState<RadiusConfig>({
    host: '', port: 1812, secret: '', timeout: 5,
    accountingEnabled: false, accountingPort: 1813, isEnabled: false,
  })
  const [ldapConfig, setLdapConfig] = useState<LdapConfig>({
    serverUrl: '', bindDn: '', bindPassword: '', baseDn: '',
    useTls: true, tlsVerifyCert: true, timeout: 30, isEnabled: false,
    syncInterval: 3600, syncFilter: '(objectClass=user)',
    syncAttributeUsername: 'sAMAccountName', syncAttributeEmail: 'mail',
    syncAttributeFullName: 'displayName', autoCreateUsers: true, autoDisableUsers: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    fetchConfigs()
  }, [])

  const fetchConfigs = async () => {
    setLoading(true)
    try {
      const [radiusRes, ldapRes] = await Promise.all([
        fetch('/api/radius'),
        fetch('/api/ldap'),
      ])
      if (radiusRes.ok) {
        const data = await radiusRes.json()
        if (data.config) setRadiusConfig(data.config)
      }
      if (ldapRes.ok) {
        const data = await ldapRes.json()
        if (data.config) setLdapConfig(data.config)
      }
    } catch (error) {
      console.error('Failed to fetch configs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveRadius = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(radiusConfig),
      })
      if (response.ok) {
        toast.success('RADIUS configuration saved')
      } else {
        throw new Error('Failed to save')
      }
    } catch (error) {
      toast.error('Failed to save RADIUS configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveLdap = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/ldap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ldapConfig),
      })
      if (response.ok) {
        toast.success('LDAP configuration saved')
      } else {
        throw new Error('Failed to save')
      }
    } catch (error) {
      toast.error('Failed to save LDAP configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleTestRadius = async () => {
    setTesting('radius')
    try {
      const response = await fetch('/api/radius', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testConnection: true }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('RADIUS connection successful')
      } else {
        toast.error(data.error || 'Connection failed')
      }
    } catch (error) {
      toast.error('RADIUS connection test failed')
    } finally {
      setTesting(null)
    }
  }

  const handleTestLdap = async () => {
    setTesting('ldap')
    try {
      const response = await fetch('/api/ldap', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testConnection: true }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('LDAP connection successful')
      } else {
        toast.error(data.error || 'Connection failed')
      }
    } catch (error) {
      toast.error('LDAP connection test failed')
    } finally {
      setTesting(null)
    }
  }

  const handleSyncLdap = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/ldap/sync', { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        toast.success(`LDAP sync completed: ${data.results?.usersFound || 0} users found`)
        fetchConfigs()
      } else {
        toast.error(data.error || 'Sync failed')
      }
    } catch (error) {
      toast.error('LDAP sync failed')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Tabs defaultValue="radius" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="radius">
          <Server className="mr-2 h-4 w-4" />
          RADIUS
        </TabsTrigger>
        <TabsTrigger value="ldap">
          <Database className="mr-2 h-4 w-4" />
          LDAP
        </TabsTrigger>
      </TabsList>

      <TabsContent value="radius">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              RADIUS Authentication
            </CardTitle>
            <CardDescription>
              Configure RADIUS server for VPN user authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable RADIUS</Label>
                <p className="text-sm text-muted-foreground">
                  Use RADIUS for VPN authentication
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

            <div className="grid gap-4 md:grid-cols-2">
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
              <div className="space-y-2">
                <Label htmlFor="radius-timeout">Timeout (seconds)</Label>
                <Input
                  id="radius-timeout"
                  type="number"
                  value={radiusConfig.timeout}
                  onChange={(e) => setRadiusConfig({ ...radiusConfig, timeout: parseInt(e.target.value) || 5 })}
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Accounting</Label>
                <p className="text-sm text-muted-foreground">
                  Track session start/stop events
                </p>
              </div>
              <Switch
                checked={radiusConfig.accountingEnabled}
                onCheckedChange={(checked) => setRadiusConfig({ ...radiusConfig, accountingEnabled: checked })}
              />
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

            <div className="flex gap-2">
              <Button onClick={handleSaveRadius} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Configuration
              </Button>
              <Button variant="outline" onClick={handleTestRadius} disabled={testing === 'radius'}>
                {testing === 'radius' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Test Connection
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="ldap">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              LDAP Integration
            </CardTitle>
            <CardDescription>
              Configure LDAP for user synchronization and authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable LDAP</Label>
                <p className="text-sm text-muted-foreground">
                  Sync users from LDAP/Active Directory
                </p>
              </div>
              <Switch
                checked={ldapConfig.isEnabled}
                onCheckedChange={(checked) => setLdapConfig({ ...ldapConfig, isEnabled: checked })}
              />
            </div>

            {ldapConfig.lastSyncAt && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertTitle>Last Sync</AlertTitle>
                <AlertDescription className="flex items-center gap-2">
                  {new Date(ldapConfig.lastSyncAt).toLocaleString()}
                  {ldapConfig.lastSyncSuccess ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ldap-url">Server URL</Label>
                <Input
                  id="ldap-url"
                  placeholder="ldap://dc.example.com"
                  value={ldapConfig.serverUrl}
                  onChange={(e) => setLdapConfig({ ...ldapConfig, serverUrl: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ldap-base-dn">Base DN</Label>
                <Input
                  id="ldap-base-dn"
                  placeholder="dc=example,dc=com"
                  value={ldapConfig.baseDn}
                  onChange={(e) => setLdapConfig({ ...ldapConfig, baseDn: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ldap-bind-dn">Bind DN</Label>
                <Input
                  id="ldap-bind-dn"
                  placeholder="cn=admin,dc=example,dc=com"
                  value={ldapConfig.bindDn}
                  onChange={(e) => setLdapConfig({ ...ldapConfig, bindDn: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ldap-bind-password">Bind Password</Label>
                <Input
                  id="ldap-bind-password"
                  type="password"
                  placeholder="Enter password"
                  value={ldapConfig.bindPassword}
                  onChange={(e) => setLdapConfig({ ...ldapConfig, bindPassword: e.target.value })}
                />
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Username Attribute</Label>
                <Input
                  value={ldapConfig.syncAttributeUsername}
                  onChange={(e) => setLdapConfig({ ...ldapConfig, syncAttributeUsername: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email Attribute</Label>
                <Input
                  value={ldapConfig.syncAttributeEmail}
                  onChange={(e) => setLdapConfig({ ...ldapConfig, syncAttributeEmail: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Full Name Attribute</Label>
                <Input
                  value={ldapConfig.syncAttributeFullName}
                  onChange={(e) => setLdapConfig({ ...ldapConfig, syncAttributeFullName: e.target.value })}
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Use TLS</Label>
                <p className="text-sm text-muted-foreground">Secure connection with TLS</p>
              </div>
              <Switch
                checked={ldapConfig.useTls}
                onCheckedChange={(checked) => setLdapConfig({ ...ldapConfig, useTls: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-create Users</Label>
                <p className="text-sm text-muted-foreground">Create VPN users for new LDAP users</p>
              </div>
              <Switch
                checked={ldapConfig.autoCreateUsers}
                onCheckedChange={(checked) => setLdapConfig({ ...ldapConfig, autoCreateUsers: checked })}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSaveLdap} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Configuration
              </Button>
              <Button variant="outline" onClick={handleTestLdap} disabled={testing === 'ldap'}>
                {testing === 'ldap' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Test Connection
              </Button>
              <Button variant="outline" onClick={handleSyncLdap} disabled={syncing}>
                {syncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sync Now
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
