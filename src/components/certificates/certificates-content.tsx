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
  FileKey,
  Search,
  Plus,
  Download,
  Eye,
  Ban,
  RefreshCw,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trash2,
  Copy,
  Mail,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'

interface Certificate {
  id: string
  serialNumber: string
  commonName: string
  username: string
  email: string
  issueDate: string
  expiryDate: string
  status: string
  keySize: number
  pfxPassword?: string
  user: {
    id: string
    username: string
    email: string
    fullName: string
  }
  revocation?: {
    id: string
    reason: string
    revokedAt: string
  }
}

interface CertificateStats {
  total: number
  active: number
  expired: number
  revoked: number
  pending: number
}

interface User {
  id: string
  username: string
  email: string
  fullName: string
  certificateStatus: string
}

interface CertificateAuthority {
  id: string
  name: string
  subject: string
  isDefault: boolean
  isExternal: boolean
}

export function CertificatesContent() {
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [stats, setStats] = useState<CertificateStats>({ total: 0, active: 0, expired: 0, revoked: 0, pending: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [cas, setCas] = useState<CertificateAuthority[]>([])
  const [selectedCA, setSelectedCA] = useState<string>('')
  const [validityDays, setValidityDays] = useState('365')
  const [keySize, setKeySize] = useState('4096')
  const [isGenerating, setIsGenerating] = useState(false)
  const [validityMode, setValidityMode] = useState<'preset' | 'custom'>('preset')
  const [customExpiryDate, setCustomExpiryDate] = useState<string>('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [certToDelete, setCertToDelete] = useState<Certificate | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)

  const fetchCertificates = async () => {
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.append('search', searchQuery)
      if (statusFilter !== 'all') params.append('status', statusFilter)

      const response = await fetch(`/api/certificates?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch certificates')
      const data = await response.json()
      setCertificates(data.certificates)
      setStats(data.stats)
    } catch (error) {
      console.error('Error fetching certificates:', error)
      toast.error('Failed to load certificates')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchCAs = async () => {
    try {
      const response = await fetch('/api/certificates')
      if (response.ok) {
        const data = await response.json()
        setCas(data.cas || [])
        // Set default CA if available
        const defaultCA = data.cas?.find((ca: CertificateAuthority) => ca.isDefault && !ca.isExternal)
        if (defaultCA) {
          setSelectedCA(defaultCA.id)
        }
      }
    } catch (error) {
      console.error('Error fetching CAs:', error)
    }
  }

  useEffect(() => {
    fetchCertificates()
  }, [searchQuery, statusFilter])

  useEffect(() => {
    if (showGenerateDialog) {
      fetchUsers()
      fetchCAs()
    }
  }, [showGenerateDialog])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="default">Active</Badge>
      case 'EXPIRED':
        return <Badge variant="secondary">Expired</Badge>
      case 'REVOKED':
        return <Badge variant="destructive">Revoked</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'EXPIRED':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'REVOKED':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />
    }
  }

  const handleGenerateCertificate = async () => {
    if (!selectedUser) {
      toast.error('Please select a user')
      return
    }

    if (!selectedCA) {
      toast.error('Please select a Certificate Authority')
      return
    }

    // Calculate validity days
    let validity = 0
    if (validityMode === 'custom' && customExpiryDate) {
      const expiry = new Date(customExpiryDate)
      const now = new Date()
      const diffTime = expiry.getTime() - now.getTime()
      validity = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      if (validity <= 0) {
        toast.error('Expiry date must be in the future')
        return
      }
    } else {
      validity = parseInt(validityDays)
    }

    setIsGenerating(true)
    try {
      const response = await fetch('/api/certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser,
          caId: selectedCA,
          validityDays: validity,
          keySize: parseInt(keySize),
          generatePfx: true,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate certificate')
      }

      const result = await response.json()
      
      // Show password dialog after successful generation
      if (result.certificate.pfxPassword) {
        setGeneratedPassword(result.certificate.pfxPassword)
        setShowPasswordDialog(true)
      } else {
        toast.success(`Certificate generated successfully for ${result.certificate.commonName}`)
      }
      
      setShowGenerateDialog(false)
      setSelectedUser('')
      setSelectedCA('')
      fetchCertificates()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate certificate')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleView = (cert: Certificate) => {
    setSelectedCert(cert)
    setShowViewDialog(true)
  }

  const handleDownloadPEM = (cert: Certificate) => {
    window.open(`/api/certificates/${cert.id}/download?format=pem`, '_blank')
    toast.success(`PEM certificate download started for ${cert.commonName}`)
  }

  const handleDownloadPFX = (cert: Certificate) => {
    window.open(`/api/certificates/${cert.id}/download?format=pfx`, '_blank')
    if (cert.pfxPassword) {
      toast.success(
        <div className="space-y-1">
          <p className="font-medium">PKCS#12 download started</p>
          <p className="text-sm">Password: <code className="bg-muted px-1 rounded">{cert.pfxPassword}</code></p>
        </div>,
        { duration: 10000 }
      )
    } else {
      toast.success(`PKCS#12 certificate download started for ${cert.commonName}`)
    }
  }

  const handleDownloadKey = (cert: Certificate) => {
    window.open(`/api/certificates/${cert.id}/download?format=key`, '_blank')
    toast.success(`Private key download started for ${cert.commonName}`)
  }

  const handleRenew = async (cert: Certificate) => {
    toast.info('Certificate renewal - generate a new certificate for this user')
  }

  const handleSendEmail = async (cert: Certificate) => {
    if (!confirm(`Send certificate to ${cert.user?.email || cert.email}?`)) return

    try {
      const response = await fetch('/api/email/send-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certificateId: cert.id }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send certificate email')
      }

      toast.success(`Certificate sent to ${cert.user?.email || cert.email}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send certificate email')
    }
  }

  const handleRevoke = async (cert: Certificate) => {
    if (!confirm('Are you sure you want to revoke this certificate?')) return

    try {
      const response = await fetch(`/api/certificates/${cert.id}?reason=UNSPECIFIED`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to revoke certificate')

      toast.success('Certificate revoked')
      fetchCertificates()
    } catch (error) {
      toast.error('Failed to revoke certificate')
    }
  }

  const handleDelete = (cert: Certificate) => {
    setCertToDelete(cert)
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    if (!certToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/certificates/${certToDelete.id}/delete`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete certificate')
      }

      toast.success(`Certificate for ${certToDelete.commonName} deleted successfully`)
      setShowDeleteDialog(false)
      setCertToDelete(null)
      fetchCertificates()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete certificate')
    } finally {
      setIsDeleting(false)
    }
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
          <h1 className="text-2xl font-bold tracking-tight">Certificates</h1>
          <p className="text-muted-foreground">
            Certificate lifecycle management
          </p>
        </div>
        <Button onClick={() => setShowGenerateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Issue Certificate
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Certificates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.expired}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Revoked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.revoked}</div>
          </CardContent>
        </Card>
      </div>

      {/* Certificates Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-4">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search certificates..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                  <SelectItem value="REVOKED">Revoked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Common Name</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Key Size</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certificates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No certificates found
                    </TableCell>
                  </TableRow>
                ) : (
                  certificates.map((cert) => (
                    <TableRow key={cert.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(cert.status)}
                          {getStatusBadge(cert.status)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{cert.commonName}</p>
                          <p className="text-sm text-muted-foreground">{cert.user?.username || cert.username}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {cert.serialNumber}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(cert.issueDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(cert.expiryDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm">{cert.keySize} bits</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleView(cert)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadPEM(cert)}>
                              <Download className="mr-2 h-4 w-4" />
                              Download PEM
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadPFX(cert)}>
                              <FileKey className="mr-2 h-4 w-4" />
                              Download PKCS#12
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSendEmail(cert)}>
                              <Mail className="mr-2 h-4 w-4" />
                              Send via Email
                            </DropdownMenuItem>
                            {cert.status === 'ACTIVE' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleRenew(cert)}>
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Renew
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleRevoke(cert)}
                                >
                                  <Ban className="mr-2 h-4 w-4" />
                                  Revoke
                                </DropdownMenuItem>
                              </>
                            )}
                            {cert.status === 'REVOKED' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDelete(cert)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
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

      {/* Generate Certificate Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue New Certificate</DialogTitle>
            <DialogDescription>
              Create a new client certificate for VPN authentication
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select User</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.fullName || user.username} ({user.email})
                      {user.certificateStatus === 'ACTIVE' ? ' - Has Certificate' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Signing CA (Certificate Authority)</Label>
              <Select value={selectedCA} onValueChange={setSelectedCA}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a Certificate Authority" />
                </SelectTrigger>
                <SelectContent>
                  {cas.length === 0 ? (
                    <SelectItem value="_none" disabled>No CAs available - Initialize CA first</SelectItem>
                  ) : (
                    cas.filter(ca => !ca.isExternal).map((ca) => (
                      <SelectItem key={ca.id} value={ca.id}>
                        {ca.name} {ca.isDefault ? '(Default)' : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {cas.length === 0 && (
                <p className="text-xs text-amber-600">
                  No managed CAs available. Please initialize a CA in PKI Management first.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Key Size</Label>
                <Select value={keySize} onValueChange={setKeySize}>
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
                <Label>Validity Mode</Label>
                <Select value={validityMode} onValueChange={(v) => setValidityMode(v as 'preset' | 'custom')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preset">Preset Duration</SelectItem>
                    <SelectItem value="custom">Custom Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {validityMode === 'preset' ? (
              <div className="space-y-2">
                <Label>Validity Period</Label>
                <Select value={validityDays} onValueChange={setValidityDays}>
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
            ) : (
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={customExpiryDate}
                  onChange={(e) => setCustomExpiryDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
                <p className="text-xs text-muted-foreground">
                  Select the date when this certificate should expire
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateCertificate} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Issue Certificate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Certificate Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Certificate Details</DialogTitle>
            <DialogDescription>
              View certificate information
            </DialogDescription>
          </DialogHeader>
          {selectedCert && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Common Name</p>
                  <p className="font-medium">{selectedCert.commonName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Serial Number</p>
                  <p className="font-mono text-xs break-all">{selectedCert.serialNumber}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(selectedCert.status)}
                    {getStatusBadge(selectedCert.status)}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">Key Size</p>
                  <p>{selectedCert.keySize} bits</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Issue Date</p>
                  <p>{new Date(selectedCert.issueDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Expiry Date</p>
                  <p>{new Date(selectedCert.expiryDate).toLocaleDateString()}</p>
                </div>
              </div>
              {selectedCert.pfxPassword ? (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">PKCS#12 Password</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedCert.pfxPassword!)
                        toast.success('Password copied to clipboard')
                      }}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <p className="font-mono text-lg font-bold text-amber-900 dark:text-amber-100">{selectedCert.pfxPassword}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    Use this password when importing the PKCS#12 (.p12) file
                  </p>
                </div>
              ) : (
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground">
                    PKCS#12 password not available for this certificate. 
                    This may be an older certificate or the password was not stored.
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>
              Close
            </Button>
            {selectedCert && (
              <>
                <Button variant="outline" onClick={() => handleDownloadPEM(selectedCert)}>
                  <Download className="mr-2 h-4 w-4" />
                  PEM
                </Button>
                <Button onClick={() => handleDownloadPFX(selectedCert)}>
                  <FileKey className="mr-2 h-4 w-4" />
                  PKCS#12
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Certificate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the certificate for <strong>{certToDelete?.commonName}</strong>?
              This action cannot be undone. The certificate and its associated revocation record will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Certificate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password Success Dialog */}
      <AlertDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Certificate Generated Successfully!
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your PKCS#12 certificate has been generated. Please save this password - you will need it to import the certificate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 my-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">PKCS#12 Password</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(generatedPassword!)
                  toast.success('Password copied to clipboard')
                }}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </Button>
            </div>
            <p className="font-mono text-xl font-bold text-amber-900 dark:text-amber-100">{generatedPassword}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Use this password when importing the PKCS#12 (.p12) file on your device.
          </p>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              setShowPasswordDialog(false)
              setGeneratedPassword(null)
            }}>
              Done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
