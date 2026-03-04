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
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Network,
  Search,
  Plus,
  Eye,
  Play,
  MoreHorizontal,
  Edit,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Settings,
  Shield,
  Globe,
} from 'lucide-react'
import { toast } from 'sonner'

interface ConnectionProfile {
  id: string
  name: string
  description: string | null
  isDefault: boolean
  isEnabled: boolean
  connectionName: string
  ikeVersion: number
  ikeProposals: string
  espProposals: string
  localAuth: string
  localCert: string
  localId: string | null
  remoteAuth: string
  remoteCaId: string | null
  poolId: string | null
  poolName: string
  poolAddressRange: string
  dnsServers: string
  localTrafficSelector: string
  remoteTrafficSelector: string
  mobike: boolean
  fragmentation: boolean
  reauthTime: number
  dpdTimeout: number
  dpdAction: string
  startAction: string
  serverHostnames: string | null
  localAddrs: string | null
  configApplied: boolean
  appliedAt: string | null
  configPath: string | null
  createdAt: string
  updatedAt: string
}

interface IpPool {
  id: string
  name: string
  cidr: string
  status: string
}

interface CaCertificate {
  id: string
  name: string
  subject: string
  isDefault: boolean
  certificatePath: string | null
}

const defaultFormData: Partial<ConnectionProfile> = {
  name: '',
  description: '',
  isDefault: false,
  isEnabled: true,
  connectionName: 'ikev2-cert',
  ikeVersion: 2,
  ikeProposals: 'aes256-sha256-modp1024,aes256-sha384-modp2048,aes256gcm16-sha256-modp2048',
  espProposals: 'aes256-sha256,aes256gcm16-sha256',
  localAuth: 'pubkey',
  localCert: 'vpn-server.pem',
  localId: '',
  remoteAuth: 'pubkey',
  remoteCaId: '',
  poolId: '',
  poolName: 'vpn-pool',
  poolAddressRange: '10.70.0.0/24',
  dnsServers: '8.8.8.8,8.8.4.4',
  localTrafficSelector: '0.0.0.0/0',
  remoteTrafficSelector: 'dynamic',
  mobike: true,
  fragmentation: true,
  reauthTime: 0,
  dpdTimeout: 30,
  dpdAction: 'restart',
  startAction: 'none',
  serverHostnames: '',
  localAddrs: '',
}

export function ConnectionProfilesContent() {
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([])
  const [ipPools, setIpPools] = useState<IpPool[]>([])
  const [caCertificates, setCaCertificates] = useState<CaCertificate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<ConnectionProfile | null>(null)
  const [previewContent, setPreviewContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<Partial<ConnectionProfile>>(defaultFormData)

  const fetchProfiles = async () => {
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.append('search', searchQuery)

      const response = await fetch(`/api/vpn/profiles?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch profiles')
      const data = await response.json()
      setProfiles(data.profiles)
      setIpPools(data.ipPools || [])
      setCaCertificates(data.caCertificates || [])
    } catch (error) {
      console.error('Error fetching profiles:', error)
      toast.error('Failed to load connection profiles')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchProfiles()
  }, [searchQuery])

  const resetForm = () => {
    setFormData(defaultFormData)
  }

  const handleAddProfile = async () => {
    if (!formData.name) {
      toast.error('Profile name is required')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/vpn/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create profile')
      }

      toast.success('Connection profile created successfully')
      setShowAddDialog(false)
      resetForm()
      fetchProfiles()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create profile')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditProfile = async () => {
    if (!selectedProfile) return

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/vpn/profiles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedProfile.id, ...formData }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update profile')
      }

      toast.success('Connection profile updated successfully')
      setShowEditDialog(false)
      setSelectedProfile(null)
      resetForm()
      fetchProfiles()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update profile')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm('Are you sure you want to delete this profile?')) return

    try {
      const response = await fetch(`/api/vpn/profiles?id=${profileId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete profile')

      toast.success('Profile deleted successfully')
      fetchProfiles()
    } catch (error) {
      toast.error('Failed to delete profile')
    }
  }

  const handlePreview = async (profileId?: string) => {
    try {
      const url = profileId 
        ? `/api/vpn/profiles?preview=true&id=${profileId}`
        : `/api/vpn/profiles?preview=true`
      
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to generate preview')
      
      const data = await response.json()
      setPreviewContent(data.config)
      setShowPreviewDialog(true)
    } catch (error) {
      toast.error('Failed to generate configuration preview')
    }
  }

  const handleApplyProfile = async (profileId: string) => {
    try {
      const response = await fetch('/api/vpn/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply', id: profileId }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to apply profile')

      toast.success(data.message || 'Profile applied successfully')
      fetchProfiles()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to apply profile')
    }
  }

  const handleApplyAll = async () => {
    try {
      const response = await fetch('/api/vpn/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'applyAll' }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to apply profiles')

      toast.success(data.message || 'Profiles applied successfully')
      fetchProfiles()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to apply profiles')
    }
  }

  const handleToggleEnabled = async (profileId: string, currentStatus: boolean) => {
    try {
      const response = await fetch('/api/vpn/profiles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: profileId, isEnabled: !currentStatus }),
      })

      if (!response.ok) throw new Error('Failed to update status')

      toast.success(`Profile ${!currentStatus ? 'enabled' : 'disabled'}`)
      fetchProfiles()
    } catch (error) {
      toast.error('Failed to update profile status')
    }
  }

  const handleSetDefault = async (profileId: string) => {
    try {
      const response = await fetch('/api/vpn/profiles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: profileId, isDefault: true }),
      })

      if (!response.ok) throw new Error('Failed to set default')

      toast.success('Default profile updated')
      fetchProfiles()
    } catch (error) {
      toast.error('Failed to set default profile')
    }
  }

  const openEditDialog = (profile: ConnectionProfile) => {
    setSelectedProfile(profile)
    setFormData({
      name: profile.name,
      description: profile.description || '',
      isDefault: profile.isDefault,
      isEnabled: profile.isEnabled,
      connectionName: profile.connectionName,
      ikeVersion: profile.ikeVersion,
      ikeProposals: profile.ikeProposals,
      espProposals: profile.espProposals,
      localAuth: profile.localAuth,
      localCert: profile.localCert,
      localId: profile.localId || '',
      remoteAuth: profile.remoteAuth,
      remoteCaId: profile.remoteCaId || '',
      poolId: profile.poolId || '',
      poolName: profile.poolName,
      poolAddressRange: profile.poolAddressRange,
      dnsServers: profile.dnsServers,
      localTrafficSelector: profile.localTrafficSelector,
      remoteTrafficSelector: profile.remoteTrafficSelector,
      mobike: profile.mobike,
      fragmentation: profile.fragmentation,
      reauthTime: profile.reauthTime,
      dpdTimeout: profile.dpdTimeout,
      dpdAction: profile.dpdAction,
      startAction: profile.startAction,
      serverHostnames: profile.serverHostnames || '',
      localAddrs: profile.localAddrs || '',
    })
    setShowEditDialog(true)
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
          <h1 className="text-2xl font-bold tracking-tight">Connection Profiles</h1>
          <p className="text-muted-foreground">
            Manage strongSwan VPN connection profiles
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handlePreview()}>
            <Eye className="mr-2 h-4 w-4" />
            Preview All
          </Button>
          <Button variant="outline" onClick={handleApplyAll}>
            <Play className="mr-2 h-4 w-4" />
            Apply All
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setShowAddDialog(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Add Profile
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Connection Profile</DialogTitle>
                <DialogDescription>
                  Create a new VPN connection profile for strongSwan
                </DialogDescription>
              </DialogHeader>
              <ProfileForm 
                formData={formData} 
                setFormData={setFormData} 
                ipPools={ipPools}
                caCertificates={caCertificates}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button onClick={handleAddProfile} disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Profile'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Profiles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profiles.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Enabled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {profiles.filter((p) => p.isEnabled).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Applied</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {profiles.filter((p) => p.configApplied).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Default Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium truncate">
              {profiles.find((p) => p.isDefault)?.name || 'None'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profiles Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-4">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search profiles..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profile</TableHead>
                  <TableHead>Connection</TableHead>
                  <TableHead>Auth</TableHead>
                  <TableHead>Pool</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No connection profiles found
                    </TableCell>
                  </TableRow>
                ) : (
                  profiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {profile.isDefault && (
                            <Badge variant="default" className="text-xs">Default</Badge>
                          )}
                          <div>
                            <p className="font-medium">{profile.name}</p>
                            <p className="text-xs text-muted-foreground">
                              IKEv{profile.ikeVersion}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {profile.connectionName}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Shield className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{profile.localAuth}/{profile.remoteAuth}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Globe className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{profile.poolName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {profile.isEnabled ? (
                            <Badge variant="default">Enabled</Badge>
                          ) : (
                            <Badge variant="secondary">Disabled</Badge>
                          )}
                          {profile.configApplied && (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              Applied
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handlePreview(profile.id)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Preview Config
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleApplyProfile(profile.id)}>
                              <Play className="mr-2 h-4 w-4" />
                              Apply to Server
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {!profile.isDefault && (
                              <DropdownMenuItem onClick={() => handleSetDefault(profile.id)}>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Set as Default
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleToggleEnabled(profile.id, profile.isEnabled)}>
                              {profile.isEnabled ? 'Disable' : 'Enable'} Profile
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEditDialog(profile)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeleteProfile(profile.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Profile
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Connection Profile</DialogTitle>
            <DialogDescription>
              Update VPN connection profile settings
            </DialogDescription>
          </DialogHeader>
          <ProfileForm 
            formData={formData} 
            setFormData={setFormData}
            ipPools={ipPools}
            caCertificates={caCertificates}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleEditProfile} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configuration Preview</DialogTitle>
            <DialogDescription>
              Generated swanctl.conf content
            </DialogDescription>
          </DialogHeader>
          <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto font-mono whitespace-pre-wrap">
            {previewContent}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Profile Form Component
function ProfileForm({ 
  formData, 
  setFormData,
  ipPools,
  caCertificates 
}: { 
  formData: Partial<ConnectionProfile>
  setFormData: React.Dispatch<React.SetStateAction<Partial<ConnectionProfile>>>
  ipPools: IpPool[]
  caCertificates: CaCertificate[]
}) {
  const updateField = (key: keyof ConnectionProfile, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  // Helper to get CA filename from certificate path
  const getCaFilename = (caId: string): string => {
    const ca = caCertificates.find(c => c.id === caId)
    if (!ca) return 'ca.pem'
    // Extract filename from path or use CA name
    if (ca.certificatePath) {
      const filename = ca.certificatePath.split('/').pop()
      if (filename) return filename
    }
    // Default to 'ca.pem' for the default CA
    return ca.isDefault ? 'ca.pem' : `${ca.name.toLowerCase().replace(/\s+/g, '-')}.pem`
  }

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Network className="h-4 w-4" />
          Basic Settings
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Profile Name *</Label>
            <Input
              value={formData.name || ''}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Production VPN"
            />
          </div>
          <div className="space-y-2">
            <Label>Connection Name</Label>
            <Input
              value={formData.connectionName || ''}
              onChange={(e) => updateField('connectionName', e.target.value)}
              placeholder="ikev2-cert"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={formData.description || ''}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Profile description..."
            rows={2}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enabled</Label>
              <p className="text-xs text-muted-foreground">Enable this profile</p>
            </div>
            <Switch
              checked={formData.isEnabled ?? true}
              onCheckedChange={(checked) => updateField('isEnabled', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Default</Label>
              <p className="text-xs text-muted-foreground">Use as default profile</p>
            </div>
            <Switch
              checked={formData.isDefault ?? false}
              onCheckedChange={(checked) => updateField('isDefault', checked)}
            />
          </div>
        </div>
      </div>

      {/* IKE/ESP Settings */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Settings className="h-4 w-4" />
          IKE/ESP Settings
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>IKE Version</Label>
            <Select 
              value={formData.ikeVersion?.toString() || '2'} 
              onValueChange={(v) => updateField('ikeVersion', parseInt(v))}
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
          <div className="space-y-2">
            <Label>DPD Timeout (seconds)</Label>
            <Input
              type="number"
              value={formData.dpdTimeout || 30}
              onChange={(e) => updateField('dpdTimeout', parseInt(e.target.value) || 30)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>IKE Proposals</Label>
          <Input
            value={formData.ikeProposals || ''}
            onChange={(e) => updateField('ikeProposals', e.target.value)}
            placeholder="aes256-sha256-modp1024,aes256-sha384-modp2048"
          />
          <p className="text-xs text-muted-foreground">
            Comma-separated proposals. modp1024 required for Windows clients.
          </p>
        </div>
        <div className="space-y-2">
          <Label>ESP Proposals</Label>
          <Input
            value={formData.espProposals || ''}
            onChange={(e) => updateField('espProposals', e.target.value)}
            placeholder="aes256-sha256,aes256gcm16-sha256"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>DPD Action</Label>
            <Select 
              value={formData.dpdAction || 'restart'} 
              onValueChange={(v) => updateField('dpdAction', v)}
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
          <div className="space-y-2">
            <Label>Start Action</Label>
            <Select 
              value={formData.startAction || 'none'} 
              onValueChange={(v) => updateField('startAction', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Manual)</SelectItem>
                <SelectItem value="start">Start on Boot</SelectItem>
                <SelectItem value="trap">Trap (On-demand)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>MOBIKE</Label>
              <p className="text-xs text-muted-foreground">Mobility and multihoming</p>
            </div>
            <Switch
              checked={formData.mobike ?? true}
              onCheckedChange={(checked) => updateField('mobike', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Fragmentation</Label>
              <p className="text-xs text-muted-foreground">IKE fragmentation</p>
            </div>
            <Switch
              checked={formData.fragmentation ?? true}
              onCheckedChange={(checked) => updateField('fragmentation', checked)}
            />
          </div>
        </div>
      </div>

      {/* Authentication Settings */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Authentication
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Local Auth</Label>
            <Select 
              value={formData.localAuth || 'pubkey'} 
              onValueChange={(v) => updateField('localAuth', v)}
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
            <Label>Remote Auth</Label>
            <Select 
              value={formData.remoteAuth || 'pubkey'} 
              onValueChange={(v) => updateField('remoteAuth', v)}
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
              value={formData.localCert || ''}
              onChange={(e) => updateField('localCert', e.target.value)}
              placeholder="vpn-server.pem"
            />
          </div>
          <div className="space-y-2">
            <Label>Local ID</Label>
            <Input
              value={formData.localId || ''}
              onChange={(e) => updateField('localId', e.target.value)}
              placeholder="vpn.server or IP"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Client CA Certificate</Label>
          <Select 
            value={formData.remoteCaId || ''} 
            onValueChange={(v) => {
              if (v === 'any') {
                updateField('remoteCaId', '')
              } else {
                updateField('remoteCaId', v)
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select CA for client authentication" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any Valid CA (No Restriction)</SelectItem>
              {caCertificates.map(ca => (
                <SelectItem key={ca.id} value={ca.id}>
                  {ca.name} {ca.isDefault ? '(Default)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Select the CA that signs client certificates. For the default CA, the cert file is &quot;ca.pem&quot; in /etc/swanctl/x509ca/
          </p>
        </div>
      </div>

      {/* Network Settings */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Network Settings
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>IP Pool</Label>
            <Select 
              value={formData.poolId || 'custom'} 
              onValueChange={(v) => {
                if (v === 'custom') {
                  updateField('poolId', null)
                } else {
                  const pool = ipPools.find(p => p.id === v)
                  if (pool) {
                    updateField('poolId', v)
                    updateField('poolName', pool.name)
                    updateField('poolAddressRange', pool.cidr)
                  }
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select pool" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom Settings</SelectItem>
                {ipPools.map(pool => (
                  <SelectItem key={pool.id} value={pool.id}>
                    {pool.name} ({pool.cidr})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Pool Name</Label>
            <Input
              value={formData.poolName || ''}
              onChange={(e) => updateField('poolName', e.target.value)}
              placeholder="vpn-pool"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Address Range (CIDR)</Label>
            <Input
              value={formData.poolAddressRange || ''}
              onChange={(e) => updateField('poolAddressRange', e.target.value)}
              placeholder="10.70.0.0/24"
            />
          </div>
          <div className="space-y-2">
            <Label>DNS Servers</Label>
            <Input
              value={formData.dnsServers || ''}
              onChange={(e) => updateField('dnsServers', e.target.value)}
              placeholder="8.8.8.8, 8.8.4.4"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Local Traffic Selector</Label>
            <Input
              value={formData.localTrafficSelector || ''}
              onChange={(e) => updateField('localTrafficSelector', e.target.value)}
              placeholder="0.0.0.0/0"
            />
          </div>
          <div className="space-y-2">
            <Label>Remote Traffic Selector</Label>
            <Input
              value={formData.remoteTrafficSelector || ''}
              onChange={(e) => updateField('remoteTrafficSelector', e.target.value)}
              placeholder="dynamic"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Server Hostnames/IPs</Label>
            <Input
              value={formData.serverHostnames || ''}
              onChange={(e) => updateField('serverHostnames', e.target.value)}
              placeholder="vpn.example.com, 192.168.1.1"
            />
          </div>
          <div className="space-y-2">
            <Label>Local Addresses</Label>
            <Input
              value={formData.localAddrs || ''}
              onChange={(e) => updateField('localAddrs', e.target.value)}
              placeholder="0.0.0.0"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
