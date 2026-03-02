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
  Server,
  Search,
  Plus,
  Download,
  Eye,
  Upload,
  RefreshCw,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

interface ServerCertificate {
  id: string
  hostname: string
  commonName: string
  subject: string
  issuer: string
  serialNumber: string
  issueDate: string
  expiryDate: string
  status: string
  isDeployed: boolean
  deployedAt: string | null
  createdAt: string
}

interface CertificateStats {
  total: number
  active: number
  expired: number
  deployed: number
}

export function ServerCertificatesContent() {
  const [certificates, setCertificates] = useState<ServerCertificate[]>([])
  const [stats, setStats] = useState<CertificateStats>({ total: 0, active: 0, expired: 0, deployed: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [selectedCert, setSelectedCert] = useState<ServerCertificate | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [certToDelete, setCertToDelete] = useState<ServerCertificate | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Form state
  const [hostname, setHostname] = useState('')
  const [commonName, setCommonName] = useState('')
  const [validityDays, setValidityDays] = useState('730')
  const [keySize, setKeySize] = useState('4096')
  const [sanDomains, setSanDomains] = useState('')
  const [sanIPs, setSanIPs] = useState('')
  const [deployNow, setDeployNow] = useState(false)

  const fetchCertificates = async () => {
    try {
      const response = await fetch('/api/server-certificates')
      if (!response.ok) throw new Error('Failed to fetch server certificates')
      const data = await response.json()
      setCertificates(data.certificates)
      setStats(data.stats)
    } catch (error) {
      console.error('Error fetching server certificates:', error)
      toast.error('Failed to load server certificates')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCertificates()
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="default">Active</Badge>
      case 'EXPIRED':
        return <Badge variant="secondary">Expired</Badge>
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
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />
    }
  }

  const handleGenerateCertificate = async () => {
    if (!hostname && !commonName) {
      toast.error('Please enter a hostname or common name')
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch('/api/server-certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostname: hostname || undefined,
          commonName: commonName || undefined,
          validityDays: parseInt(validityDays),
          keySize: parseInt(keySize),
          sanDomains: sanDomains ? sanDomains.split(',').map(d => d.trim()).filter(Boolean) : [],
          sanIPs: sanIPs ? sanIPs.split(',').map(ip => ip.trim()).filter(Boolean) : [],
          deploy: deployNow,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate certificate')
      }

      const result = await response.json()
      toast.success(`Server certificate generated successfully for ${result.certificate.commonName}`)
      setShowGenerateDialog(false)
      resetForm()
      fetchCertificates()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate certificate')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDeploy = async (cert: ServerCertificate) => {
    if (!confirm(`Deploy certificate for ${cert.hostname} to VPN server? This will replace the current server certificate.`)) return

    setIsDeploying(true)
    try {
      const response = await fetch(`/api/server-certificates/${cert.id}/deploy`, {
        method: 'POST',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to deploy certificate')
      }

      toast.success('Server certificate deployed successfully')
      fetchCertificates()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to deploy certificate')
    } finally {
      setIsDeploying(false)
    }
  }

  const handleView = (cert: ServerCertificate) => {
    setSelectedCert(cert)
    setShowViewDialog(true)
  }

  const handleDownloadPEM = (cert: ServerCertificate) => {
    window.open(`/api/server-certificates/${cert.id}/download?format=pem`, '_blank')
    toast.success(`PEM certificate download started for ${cert.hostname}`)
  }

  const handleDownloadKey = (cert: ServerCertificate) => {
    window.open(`/api/server-certificates/${cert.id}/download?format=key`, '_blank')
    toast.success(`Private key download started for ${cert.hostname}`)
  }

  const handleDelete = (cert: ServerCertificate) => {
    setCertToDelete(cert)
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    if (!certToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/server-certificates/${certToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete certificate')
      }

      toast.success(`Server certificate for ${certToDelete.hostname} deleted successfully`)
      setShowDeleteDialog(false)
      setCertToDelete(null)
      fetchCertificates()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete certificate')
    } finally {
      setIsDeleting(false)
    }
  }

  const resetForm = () => {
    setHostname('')
    setCommonName('')
    setValidityDays('730')
    setKeySize('4096')
    setSanDomains('')
    setSanIPs('')
    setDeployNow(false)
  }

  const filteredCertificates = searchQuery
    ? certificates.filter(c =>
        c.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.commonName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.serialNumber.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : certificates

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
          <h1 className="text-2xl font-bold tracking-tight">Server Certificates</h1>
          <p className="text-muted-foreground">
            Manage VPN server certificates for IKEv2 authentication
          </p>
        </div>
        <Button onClick={() => setShowGenerateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Generate Certificate
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
            <CardTitle className="text-sm font-medium">Deployed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.deployed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Certificates Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search certificates..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCertificates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No server certificates found</p>
              <p className="text-sm mt-2">Generate a server certificate for IKEv2 VPN authentication</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Hostname</TableHead>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Deployed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCertificates.map((cert) => (
                    <TableRow key={cert.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(cert.status)}
                          {getStatusBadge(cert.status)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{cert.hostname}</p>
                          <p className="text-sm text-muted-foreground">{cert.commonName}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {cert.serialNumber.substring(0, 16)}...
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(cert.issueDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(cert.expiryDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {cert.isDeployed ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-sm">Yes</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No</span>
                        )}
                      </TableCell>
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
                            <DropdownMenuItem onClick={() => handleDownloadKey(cert)}>
                              <Download className="mr-2 h-4 w-4" />
                              Download Key
                            </DropdownMenuItem>
                            {!cert.isDeployed && cert.status === 'ACTIVE' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleDeploy(cert)}>
                                  <Upload className="mr-2 h-4 w-4" />
                                  Deploy to VPN
                                </DropdownMenuItem>
                              </>
                            )}
                            {!cert.isDeployed && (
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Certificate Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Server Certificate</DialogTitle>
            <DialogDescription>
              Create a new server certificate for IKEv2 VPN authentication
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hostname / IP</Label>
                <Input
                  placeholder="vpn.example.com"
                  value={hostname}
                  onChange={(e) => setHostname(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Common Name (CN)</Label>
                <Input
                  placeholder="Defaults to hostname"
                  value={commonName}
                  onChange={(e) => setCommonName(e.target.value)}
                />
              </div>
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
                <Label>Validity Period</Label>
                <Select value={validityDays} onValueChange={setValidityDays}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="365">1 Year</SelectItem>
                    <SelectItem value="730">2 Years</SelectItem>
                    <SelectItem value="1095">3 Years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Subject Alternative Names (SAN) - Domains</Label>
              <Input
                placeholder="Comma-separated: www.example.com, mail.example.com"
                value={sanDomains}
                onChange={(e) => setSanDomains(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Subject Alternative Names (SAN) - IPs</Label>
              <Input
                placeholder="Comma-separated: 192.168.1.1, 10.0.0.1"
                value={sanIPs}
                onChange={(e) => setSanIPs(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="deployNow"
                checked={deployNow}
                onChange={(e) => setDeployNow(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="deployNow" className="cursor-pointer">
                Deploy immediately after generation
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowGenerateDialog(false); resetForm() }}>
              Cancel
            </Button>
            <Button onClick={handleGenerateCertificate} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate Certificate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Certificate Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Server Certificate Details</DialogTitle>
            <DialogDescription>
              View certificate information
            </DialogDescription>
          </DialogHeader>
          {selectedCert && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Hostname</p>
                  <p className="font-medium">{selectedCert.hostname}</p>
                </div>
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
                  <p className="text-muted-foreground">Issue Date</p>
                  <p>{new Date(selectedCert.issueDate).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Expiry Date</p>
                  <p>{new Date(selectedCert.expiryDate).toLocaleString()}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Subject</p>
                  <p className="font-mono text-xs break-all">{selectedCert.subject}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Issuer</p>
                  <p className="font-mono text-xs break-all">{selectedCert.issuer}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Deployed</p>
                  <p>{selectedCert.isDeployed ? `Yes (${selectedCert.deployedAt ? new Date(selectedCert.deployedAt).toLocaleString() : ''})` : 'No'}</p>
                </div>
              </div>
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
                {!selectedCert.isDeployed && selectedCert.status === 'ACTIVE' && (
                  <Button onClick={() => { setShowViewDialog(false); handleDeploy(selectedCert) }}>
                    <Upload className="mr-2 h-4 w-4" />
                    Deploy
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Server Certificate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the certificate for <strong>{certToDelete?.hostname}</strong>?
              This action cannot be undone. The certificate files will be permanently removed.
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
    </div>
  )
}
