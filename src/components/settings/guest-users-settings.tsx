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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
  UserPlus,
  UserX,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Calendar,
  Mail,
  Building,
  MoreHorizontal,
  Ban,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface GuestUser {
  id: string
  username: string
  email: string
  fullName: string | null
  phone: string | null
  company: string | null
  purpose: string | null
  sponsorId: string | null
  sponsorName: string | null
  sponsorEmail: string | null
  accessStartDate: string
  accessEndDate: string
  maxSessions: number
  allowedNetworks: string | null
  bandwidthLimit: number | null
  status: 'PENDING' | 'APPROVED' | 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'DENIED'
  approvalDate: string | null
  approvedBy: string | null
  certificateId: string | null
  lastAccessAt: string | null
  accessCount: number
  createdAt: string
}

export function GuestUsersSettings() {
  const [guests, setGuests] = useState<GuestUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showExtendDialog, setShowExtendDialog] = useState(false)
  const [selectedGuest, setSelectedGuest] = useState<GuestUser | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<string>('all')

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    fullName: '',
    phone: '',
    company: '',
    purpose: '',
    sponsorName: '',
    sponsorEmail: '',
    accessStartDate: '',
    accessEndDate: '',
    maxSessions: 1,
    bandwidthLimit: 1000,
    allowedNetworks: '',
  })
  const [extendDays, setExtendDays] = useState(7)

  useEffect(() => {
    fetchGuests()
  }, [filter])

  const fetchGuests = async () => {
    setLoading(true)
    try {
      const url = filter !== 'all' ? `/api/guest-users?status=${filter}` : '/api/guest-users'
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setGuests(data.guests || [])
      }
    } catch (error) {
      console.error('Failed to fetch guests:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formData.username || !formData.email || !formData.accessStartDate || !formData.accessEndDate) {
      toast.error('Please fill all required fields')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/guest-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success('Guest user created successfully')
        setShowAddDialog(false)
        resetForm()
        fetchGuests()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create guest user')
      }
    } catch (error) {
      toast.error('Failed to create guest user')
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async (guest: GuestUser) => {
    try {
      const response = await fetch(`/api/guest-users/${guest.id}/approve`, {
        method: 'POST',
      })
      if (response.ok) {
        toast.success('Guest user approved')
        fetchGuests()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to approve')
      }
    } catch (error) {
      toast.error('Failed to approve guest user')
    }
  }

  const handleRevoke = async (guest: GuestUser) => {
    if (!confirm(`Revoke access for ${guest.username}?`)) return

    try {
      const response = await fetch(`/api/guest-users/${guest.id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Administrative revocation' }),
      })
      if (response.ok) {
        toast.success('Guest access revoked')
        fetchGuests()
      }
    } catch (error) {
      toast.error('Failed to revoke access')
    }
  }

  const handleExtend = async () => {
    if (!selectedGuest) return

    setSaving(true)
    try {
      const response = await fetch(`/api/guest-users/${selectedGuest.id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extendDays }),
      })
      if (response.ok) {
        toast.success(`Access extended by ${extendDays} days`)
        setShowExtendDialog(false)
        fetchGuests()
      }
    } catch (error) {
      toast.error('Failed to extend access')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (guest: GuestUser) => {
    if (!confirm(`Delete guest user ${guest.username}?`)) return

    try {
      const response = await fetch(`/api/guest-users/${guest.id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        toast.success('Guest user deleted')
        fetchGuests()
      }
    } catch (error) {
      toast.error('Failed to delete guest user')
    }
  }

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      fullName: '',
      phone: '',
      company: '',
      purpose: '',
      sponsorName: '',
      sponsorEmail: '',
      accessStartDate: new Date().toISOString().split('T')[0],
      accessEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      maxSessions: 1,
      bandwidthLimit: 1000,
      allowedNetworks: '',
    })
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
      APPROVED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
      ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
      EXPIRED: 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400',
      REVOKED: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
      DENIED: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
    }
    return styles[status] || styles.PENDING
  }

  const formatDate = (date: string) => new Date(date).toLocaleDateString()

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate)
    const now = new Date()
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Guest Users</h2>
          <p className="text-muted-foreground">Manage temporary VPN access for external users</p>
        </div>
        <Button onClick={() => { resetForm(); setShowAddDialog(true); }}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Guest User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-500">
              {guests.filter(g => g.status === 'PENDING').length}
            </div>
            <p className="text-xs text-muted-foreground">Pending Approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-500">
              {guests.filter(g => g.status === 'ACTIVE' || g.status === 'APPROVED').length}
            </div>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-500">
              {guests.filter(g => g.status === 'EXPIRED').length}
            </div>
            <p className="text-xs text-muted-foreground">Expired</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-500">
              {guests.filter(g => g.status === 'REVOKED').length}
            </div>
            <p className="text-xs text-muted-foreground">Revoked</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
            <SelectItem value="REVOKED">Revoked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Guest List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : guests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserPlus className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No guest users found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Sponsor</TableHead>
                  <TableHead>Access Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guests.map((guest) => {
                  const daysRemaining = getDaysRemaining(guest.accessEndDate)
                  return (
                    <TableRow key={guest.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{guest.fullName || guest.username}</div>
                          <div className="text-xs text-muted-foreground">{guest.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>{guest.company || '-'}</TableCell>
                      <TableCell>
                        <div>
                          <div>{guest.sponsorName || '-'}</div>
                          {guest.sponsorEmail && (
                            <div className="text-xs text-muted-foreground">{guest.sponsorEmail}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(guest.accessStartDate)} - {formatDate(guest.accessEndDate)}
                          </div>
                          {daysRemaining > 0 && daysRemaining <= 7 && (
                            <div className="text-xs text-amber-500 mt-1">
                              {daysRemaining} days remaining
                            </div>
                          )}
                          {daysRemaining <= 0 && guest.status !== 'EXPIRED' && (
                            <div className="text-xs text-red-500 mt-1">Expired</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusBadge(guest.status)}`}>
                          {guest.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {guest.status === 'PENDING' && (
                              <DropdownMenuItem onClick={() => handleApprove(guest)}>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Approve
                              </DropdownMenuItem>
                            )}
                            {(guest.status === 'APPROVED' || guest.status === 'ACTIVE') && (
                              <>
                                <DropdownMenuItem onClick={() => { setSelectedGuest(guest); setShowExtendDialog(true); }}>
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Extend Access
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleRevoke(guest)} className="text-destructive">
                                  <Ban className="mr-2 h-4 w-4" />
                                  Revoke Access
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem onClick={() => handleDelete(guest)} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Guest Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Guest User</DialogTitle>
            <DialogDescription>Create temporary VPN access for external users</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Username *</Label>
                <Input
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Company</Label>
                <Input
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Purpose</Label>
                <Input
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                />
              </div>
            </div>
            <Separator />
            <Label>Sponsor Information</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sponsor Name</Label>
                <Input
                  value={formData.sponsorName}
                  onChange={(e) => setFormData({ ...formData, sponsorName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Sponsor Email</Label>
                <Input
                  type="email"
                  value={formData.sponsorEmail}
                  onChange={(e) => setFormData({ ...formData, sponsorEmail: e.target.value })}
                />
              </div>
            </div>
            <Separator />
            <Label>Access Settings</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={formData.accessStartDate}
                  onChange={(e) => setFormData({ ...formData, accessStartDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <Input
                  type="date"
                  value={formData.accessEndDate}
                  onChange={(e) => setFormData({ ...formData, accessEndDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Sessions</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={formData.maxSessions}
                  onChange={(e) => setFormData({ ...formData, maxSessions: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Bandwidth Limit (Kbps)</Label>
                <Input
                  type="number"
                  value={formData.bandwidthLimit}
                  onChange={(e) => setFormData({ ...formData, bandwidthLimit: parseInt(e.target.value) || 1000 })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Guest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Dialog */}
      <Dialog open={showExtendDialog} onOpenChange={setShowExtendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Access</DialogTitle>
            <DialogDescription>Extend the access period for {selectedGuest?.username}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Extend by (days)</Label>
            <Input
              type="number"
              min={1}
              max={90}
              value={extendDays}
              onChange={(e) => setExtendDays(parseInt(e.target.value) || 7)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExtendDialog(false)}>Cancel</Button>
            <Button onClick={handleExtend} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Extend Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Import needed
import { Separator } from '@/components/ui/separator'
import { Trash2 } from 'lucide-react'
