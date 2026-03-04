'use client'

import { useState, useEffect } from 'react'
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
import { Badge } from '@/components/ui/badge'
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  Loader2,
  GripVertical,
  Users,
  Globe,
  Clock,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { toast } from 'sonner'

interface AccessPolicy {
  id: string
  name: string
  description: string | null
  type: 'USER' | 'GROUP' | 'CERTIFICATE' | 'IP_RANGE' | 'TIME_BASED'
  conditions: string
  action: 'ALLOW' | 'DENY'
  priority: number
  isEnabled: boolean
  createdAt: string
}

export function AccessPoliciesSettings() {
  const [policies, setPolicies] = useState<AccessPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<AccessPolicy | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'USER' as AccessPolicy['type'],
    conditions: '',
    action: 'ALLOW' as 'ALLOW' | 'DENY',
    isEnabled: true,
  })

  useEffect(() => {
    fetchPolicies()
  }, [])

  const fetchPolicies = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/access-policies')
      if (response.ok) {
        const data = await response.json()
        setPolicies(data.policies || [])
      }
    } catch (error) {
      console.error('Failed to fetch access policies:', error)
    } finally {
      setLoading(false)
    }
  }

  const openAddDialog = () => {
    setEditingPolicy(null)
    setFormData({
      name: '',
      description: '',
      type: 'USER',
      conditions: '',
      action: 'ALLOW',
      isEnabled: true,
    })
    setShowDialog(true)
  }

  const openEditDialog = (policy: AccessPolicy) => {
    setEditingPolicy(policy)
    setFormData({
      name: policy.name,
      description: policy.description || '',
      type: policy.type,
      conditions: policy.conditions,
      action: policy.action,
      isEnabled: policy.isEnabled,
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Policy name is required')
      return
    }

    setSaving(true)
    try {
      const url = editingPolicy ? `/api/access-policies/${editingPolicy.id}` : '/api/access-policies'
      const method = editingPolicy ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success(editingPolicy ? 'Policy updated' : 'Policy created')
        setShowDialog(false)
        fetchPolicies()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save policy')
      }
    } catch (error) {
      toast.error('Failed to save policy')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this access policy?')) return

    try {
      const response = await fetch(`/api/access-policies/${id}`, { method: 'DELETE' })
      if (response.ok) {
        toast.success('Policy deleted')
        fetchPolicies()
      }
    } catch (error) {
      toast.error('Failed to delete policy')
    }
  }

  const handleToggle = async (policy: AccessPolicy) => {
    try {
      const response = await fetch(`/api/access-policies/${policy.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !policy.isEnabled }),
      })
      if (response.ok) {
        toast.success(`Policy ${!policy.isEnabled ? 'enabled' : 'disabled'}`)
        fetchPolicies()
      }
    } catch (error) {
      toast.error('Failed to toggle policy')
    }
  }

  const handleMoveUp = async (policy: AccessPolicy) => {
    try {
      const response = await fetch('/api/access-policies/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyId: policy.id, direction: 'up' }),
      })
      if (response.ok) {
        fetchPolicies()
      }
    } catch (error) {
      toast.error('Failed to move policy')
    }
  }

  const handleMoveDown = async (policy: AccessPolicy) => {
    try {
      const response = await fetch('/api/access-policies/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyId: policy.id, direction: 'down' }),
      })
      if (response.ok) {
        fetchPolicies()
      }
    } catch (error) {
      toast.error('Failed to move policy')
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'USER': return <Users className="h-4 w-4" />
      case 'GROUP': return <Users className="h-4 w-4" />
      case 'CERTIFICATE': return <Shield className="h-4 w-4" />
      case 'IP_RANGE': return <Globe className="h-4 w-4" />
      case 'TIME_BASED': return <Clock className="h-4 w-4" />
      default: return <Shield className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Access Policies</h2>
          <p className="text-muted-foreground">Manage VPN access control policies</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Policy
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Access Control Policies
          </CardTitle>
          <CardDescription>
            Define rules to control VPN access based on users, groups, certificates, IP ranges, or time
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : policies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No access policies configured</p>
              <p className="text-sm">Add policies to control VPN access</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((policy, index) => (
                    <TableRow key={policy.id}>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <GripVertical className="h-4 w-4 opacity-50" />
                          {index + 1}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{policy.name}</div>
                          {policy.description && (
                            <p className="text-xs text-muted-foreground">{policy.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(policy.type)}
                          <span>{policy.type.replace('_', ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={policy.action === 'ALLOW' ? 'default' : 'destructive'}>
                          {policy.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={policy.isEnabled}
                          onCheckedChange={() => handleToggle(policy)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleMoveUp(policy)} disabled={index === 0}>
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleMoveDown(policy)} disabled={index === policies.length - 1}>
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(policy)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(policy.id)}>
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
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPolicy ? 'Edit Access Policy' : 'Add Access Policy'}</DialogTitle>
            <DialogDescription>Configure VPN access control rule</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Policy Name</Label>
              <Input
                placeholder="e.g., Allow Admins Full Access"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Optional description..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as AccessPolicy['type'] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">User</SelectItem>
                    <SelectItem value="GROUP">Group</SelectItem>
                    <SelectItem value="CERTIFICATE">Certificate</SelectItem>
                    <SelectItem value="IP_RANGE">IP Range</SelectItem>
                    <SelectItem value="TIME_BASED">Time Based</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Action</Label>
                <Select value={formData.action} onValueChange={(v: 'ALLOW' | 'DENY') => setFormData({ ...formData, action: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALLOW">ALLOW</SelectItem>
                    <SelectItem value="DENY">DENY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Conditions</Label>
              <Input
                placeholder={formData.type === 'USER' ? 'user1, user2, user3' : formData.type === 'IP_RANGE' ? '192.168.1.0/24' : ''}
                value={formData.conditions}
                onChange={(e) => setFormData({ ...formData, conditions: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                {formData.type === 'USER' && 'Comma-separated list of usernames'}
                {formData.type === 'GROUP' && 'Comma-separated list of groups'}
                {formData.type === 'CERTIFICATE' && 'Certificate patterns or serial numbers'}
                {formData.type === 'IP_RANGE' && 'CIDR notation for IP ranges'}
                {formData.type === 'TIME_BASED' && 'Time schedule (e.g., Mon-Fri 09:00-17:00)'}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch checked={formData.isEnabled} onCheckedChange={(v) => setFormData({ ...formData, isEnabled: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingPolicy ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
