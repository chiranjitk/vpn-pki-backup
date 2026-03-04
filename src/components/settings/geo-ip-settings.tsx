'use client'

import { useState, useEffect } from 'react'
import {
<<<<<<< HEAD
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
=======
  Card, CardContent, CardDescription, CardHeader, CardTitle,
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
<<<<<<< HEAD
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
=======
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
<<<<<<< HEAD
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
  Globe,
  Shield,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Edit,
  Loader2,
  MapPin,
  Ban,
  UserX,
  Clock,
=======
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Globe, Shield, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Plus, Trash2, Edit, Loader2, MapPin, Ban,
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
} from 'lucide-react'
import { toast } from 'sonner'

interface GeoRestriction {
  id: string
  type: 'COUNTRY' | 'IP_ADDRESS' | 'IP_RANGE' | 'ASN'
  value: string
  description: string | null
  isEnabled: boolean
  action: 'BLOCK' | 'ALLOW'
<<<<<<< HEAD
  source: string
=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  createdAt: string
}

interface RestrictionStats {
  total: number
  enabled: number
  blocked: number
  allowed: number
  countries: number
  ips: number
  ranges: number
  asns: number
}

export function GeoIpSettings() {
  const [restrictions, setRestrictions] = useState<GeoRestriction[]>([])
  const [stats, setStats] = useState<RestrictionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  
<<<<<<< HEAD
  // Form state
=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  const [formType, setFormType] = useState<'COUNTRY' | 'IP_ADDRESS' | 'IP_RANGE' | 'ASN'>('COUNTRY')
  const [formValue, setFormValue] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formAction, setFormAction] = useState<'BLOCK' | 'ALLOW'>('BLOCK')
  const [formEnabled, setFormEnabled] = useState(true)

<<<<<<< HEAD
  // Check IP state
=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  const [checkIp, setCheckIp] = useState('')
  const [checkingIp, setCheckingIp] = useState(false)
  const [checkResult, setCheckResult] = useState<{ blocked: boolean; reason?: string } | null>(null)

<<<<<<< HEAD
  useEffect(() => {
    fetchRestrictions()
  }, [])
=======
  useEffect(() => { fetchRestrictions() }, [])
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124

  const fetchRestrictions = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/geo-restrictions')
      if (response.ok) {
        const data = await response.json()
        setRestrictions(data.restrictions || [])
        setStats(data.stats || null)
      }
    } catch (error) {
      console.error('Failed to fetch restrictions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formValue) {
      toast.error('Value is required')
      return
    }
<<<<<<< HEAD

=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
    setSaving(true)
    try {
      const url = editingId ? `/api/geo-restrictions/${editingId}` : '/api/geo-restrictions'
      const method = editingId ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formType,
          value: formValue,
          description: formDescription,
          action: formAction,
          isEnabled: formEnabled,
        }),
      })

      if (response.ok) {
        toast.success(editingId ? 'Restriction updated' : 'Restriction created')
        setShowAddDialog(false)
        resetForm()
        fetchRestrictions()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save')
      }
    } catch (error) {
      toast.error('Failed to save restriction')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (restriction: GeoRestriction) => {
    setEditingId(restriction.id)
    setFormType(restriction.type)
    setFormValue(restriction.value)
    setFormDescription(restriction.description || '')
    setFormAction(restriction.action)
    setFormEnabled(restriction.isEnabled)
    setShowAddDialog(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this restriction?')) return
<<<<<<< HEAD

=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
    try {
      const response = await fetch(`/api/geo-restrictions/${id}`, { method: 'DELETE' })
      if (response.ok) {
        toast.success('Restriction deleted')
        fetchRestrictions()
      }
    } catch (error) {
      toast.error('Failed to delete restriction')
    }
  }

  const handleToggle = async (id: string, isEnabled: boolean) => {
    try {
      const response = await fetch(`/api/geo-restrictions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !isEnabled }),
      })
<<<<<<< HEAD
      if (response.ok) {
        fetchRestrictions()
      }
=======
      if (response.ok) fetchRestrictions()
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
    } catch (error) {
      toast.error('Failed to update restriction')
    }
  }

  const handleCheckIp = async () => {
    if (!checkIp) {
      toast.error('Please enter an IP address')
      return
    }
<<<<<<< HEAD

=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
    setCheckingIp(true)
    setCheckResult(null)
    try {
      const response = await fetch('/api/geo-restrictions/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: checkIp }),
      })
      if (response.ok) {
        const data = await response.json()
        setCheckResult(data)
      }
    } catch (error) {
      toast.error('Failed to check IP')
    } finally {
      setCheckingIp(false)
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setFormType('COUNTRY')
    setFormValue('')
    setFormDescription('')
    setFormAction('BLOCK')
    setFormEnabled(true)
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'COUNTRY': return <Globe className="h-4 w-4" />
      case 'IP_ADDRESS': return <MapPin className="h-4 w-4" />
      case 'IP_RANGE': return <Shield className="h-4 w-4" />
      case 'ASN': return <ShieldCheck className="h-4 w-4" />
      default: return <Ban className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
<<<<<<< HEAD
      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Total Rules</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-500">{stats.blocked}</div>
              <p className="text-xs text-muted-foreground">Blocked</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-500">{stats.allowed}</div>
              <p className="text-xs text-muted-foreground">Whitelisted</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-amber-500">{stats.countries}</div>
              <p className="text-xs text-muted-foreground">Countries</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* IP Check Tool */}
=======
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><div className="text-2xl font-bold">{stats.total}</div><p className="text-xs text-muted-foreground">Total Rules</p></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-2xl font-bold text-red-500">{stats.blocked}</div><p className="text-xs text-muted-foreground">Blocked</p></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-2xl font-bold text-green-500">{stats.allowed}</div><p className="text-xs text-muted-foreground">Whitelisted</p></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-2xl font-bold text-amber-500">{stats.countries}</div><p className="text-xs text-muted-foreground">Countries</p></CardContent></Card>
        </div>
      )}

>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Check IP Address</CardTitle>
          <CardDescription>Test if an IP address would be blocked</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
<<<<<<< HEAD
            <Input
              placeholder="Enter IP address to check"
              value={checkIp}
              onChange={(e) => setCheckIp(e.target.value)}
            />
=======
            <Input placeholder="Enter IP address to check" value={checkIp} onChange={(e) => setCheckIp(e.target.value)} />
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
            <Button variant="outline" onClick={handleCheckIp} disabled={checkingIp}>
              {checkingIp ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check'}
            </Button>
          </div>
          {checkResult && (
            <Alert className="mt-4" variant={checkResult.blocked ? 'destructive' : 'default'}>
              {checkResult.blocked ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              <AlertTitle>{checkResult.blocked ? 'Blocked' : 'Allowed'}</AlertTitle>
              <AlertDescription>{checkResult.reason || 'No restrictions match this IP'}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

<<<<<<< HEAD
      {/* Restrictions List */}
=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Geo/IP Restrictions</CardTitle>
              <CardDescription>Block or allow access by country, IP, or network</CardDescription>
            </div>
            <Button onClick={() => { resetForm(); setShowAddDialog(true); }}>
<<<<<<< HEAD
              <Plus className="mr-2 h-4 w-4" />
              Add Rule
=======
              <Plus className="mr-2 h-4 w-4" />Add Rule
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
<<<<<<< HEAD
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
=======
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
          ) : restrictions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No restrictions configured</p>
<<<<<<< HEAD
              <p className="text-sm">Add rules to block or allow traffic by location</p>
=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {restrictions.map((restriction) => (
                    <TableRow key={restriction.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(restriction.type)}
                          <span>{restriction.type.replace('_', ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-1 rounded">{restriction.value}</code>
                        {restriction.description && (
                          <p className="text-xs text-muted-foreground mt-1">{restriction.description}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          restriction.action === 'BLOCK' 
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        }`}>
                          {restriction.action}
                        </span>
                      </TableCell>
                      <TableCell>
<<<<<<< HEAD
                        <Switch
                          checked={restriction.isEnabled}
                          onCheckedChange={() => handleToggle(restriction.id, restriction.isEnabled)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(restriction)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(restriction.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
=======
                        <Switch checked={restriction.isEnabled} onCheckedChange={() => handleToggle(restriction.id, restriction.isEnabled)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(restriction)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(restriction.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

<<<<<<< HEAD
      {/* Add/Edit Dialog */}
=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Restriction' : 'Add Restriction'}</DialogTitle>
<<<<<<< HEAD
            <DialogDescription>
              Configure a new geo/IP restriction rule
            </DialogDescription>
=======
            <DialogDescription>Configure a new geo/IP restriction rule</DialogDescription>
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as typeof formType)}>
<<<<<<< HEAD
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
=======
                <SelectTrigger><SelectValue /></SelectTrigger>
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
                <SelectContent>
                  <SelectItem value="COUNTRY">Country (ISO code)</SelectItem>
                  <SelectItem value="IP_ADDRESS">IP Address</SelectItem>
                  <SelectItem value="IP_RANGE">IP Range (CIDR)</SelectItem>
                  <SelectItem value="ASN">ASN</SelectItem>
                </SelectContent>
              </Select>
            </div>
<<<<<<< HEAD
            
=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                placeholder={formType === 'COUNTRY' ? 'e.g., CN, RU, IR' : formType === 'IP_RANGE' ? 'e.g., 192.168.1.0/24' : ''}
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
              />
<<<<<<< HEAD
              {formType === 'COUNTRY' && (
                <p className="text-xs text-muted-foreground">Enter ISO 3166-1 alpha-2 country code</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={formAction} onValueChange={(v) => setFormAction(v as typeof formAction)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
=======
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={formAction} onValueChange={(v) => setFormAction(v as typeof formAction)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
                <SelectContent>
                  <SelectItem value="BLOCK">Block</SelectItem>
                  <SelectItem value="ALLOW">Allow (Whitelist)</SelectItem>
                </SelectContent>
              </Select>
            </div>
<<<<<<< HEAD

=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
            <div className="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch checked={formEnabled} onCheckedChange={setFormEnabled} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
<<<<<<< HEAD
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
=======
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
