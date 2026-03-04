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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  ShieldCheck,
  RefreshCw,
  Download,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  KeyRound,
  Globe,
  Calendar,
  Hash,
  FileKey,
  ExternalLink,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

interface CACertificate {
  id: string
  name: string
  type: 'ROOT' | 'INTERMEDIATE'
  status: 'ACTIVE' | 'DISABLED' | 'EXPIRED' | 'REVOKED'
  isDefault: boolean
  isExternal: boolean
  subject: string | null
  serialNumber: string | null
  issueDate: string | null
  expiryDate: string | null
  keySize: number | null
  crlUrl: string | null
  certificatePath: string | null
  filesExist: boolean
  crlInfo?: {
    version: number
    thisUpdate: string
    nextUpdate: string
    revokedCount: number
  } | null
}

interface CAStats {
  total: number
  active: number
  expired: number
  external: number
  managed: number
}

export function CAManagementContent() {
  const [cas, setCAs] = useState<CACertificate[]>([])
  const [stats, setStats] = useState<CAStats>({ total: 0, active: 0, expired: 0, external: 0, managed: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [selectedCA, setSelectedCA] = useState<CACertificate | null>(null)
  const [deploying, setDeploying] = useState<string | null>(null)
  const [regeneratingCrl, setRegeneratingCrl] = useState(false)

  useEffect(() => {
    fetchCAs()
  }, [])

  const fetchCAs = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/ca/list')
      if (response.ok) {
        const data = await response.json()
        setCAs(data.cas || [])
        setStats(data.stats || { total: 0, active: 0, expired: 0, external: 0, managed: 0 })
      } else {
        // Fallback to PKI endpoint for backward compatibility
        const pkiResponse = await fetch('/api/pki')
        if (pkiResponse.ok) {
          const pkiData = await pkiResponse.json()
          if (pkiData.ca) {
            setCAs([{
              id: pkiData.ca.id,
              name: pkiData.ca.name,
              type: 'ROOT',
              status: pkiData.ca.status,
              isDefault: pkiData.ca.isDefault,
              isExternal: pkiData.ca.isExternal,
              subject: pkiData.ca.subject,
              serialNumber: pkiData.ca.serialNumber,
              issueDate: pkiData.ca.issueDate,
              expiryDate: pkiData.ca.expiryDate,
              keySize: pkiData.ca.keySize,
              crlUrl: pkiData.ca.crlUrl,
              certificatePath: pkiData.ca.paths?.certificatePath,
              filesExist: pkiData.ca.filesExist,
              crlInfo: pkiData.crl ? {
                version: pkiData.crl.version,
                thisUpdate: pkiData.crl.thisUpdate,
                nextUpdate: pkiData.crl.nextUpdate,
                revokedCount: pkiData.crl.revokedCount,
              } : null,
            }])
            setStats({
              total: 1,
              active: pkiData.ca.status === 'ACTIVE' ? 1 : 0,
              expired: pkiData.ca.status === 'EXPIRED' ? 1 : 0,
              external: pkiData.ca.isExternal ? 1 : 0,
              managed: !pkiData.ca.isExternal ? 1 : 0,
            })
          } else {
            setCAs([])
            setStats({ total: 0, active: 0, expired: 0, external: 0, managed: 0 })
          }
        }
      }
    } catch (error) {
      console.error('Error fetching CAs:', error)
      toast.error('Failed to load CA certificates')
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewDetails = (ca: CACertificate) => {
    setSelectedCA(ca)
    setShowDetailsDialog(true)
  }

  const handleDownloadCA = (ca: CACertificate) => {
    window.open(`/api/pki/download?type=ca`, '_blank')
    toast.success('CA certificate download started')
  }

  const handleDeployCA = async (ca: CACertificate) => {
    setDeploying(ca.id)
    try {
      const response = await fetch('/api/pki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deploy_to_strongswan' }),
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Deployment failed')
      }

      if (result.reload?.success) {
        toast.success('CA deployed to strongSwan and configuration reloaded')
      } else {
        toast.warning(`CA deployed but reload failed: ${result.reload?.message}`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to deploy CA')
    } finally {
      setDeploying(null)
    }
  }

  const handleRegenerateCRL = async () => {
    setRegeneratingCrl(true)
    try {
      const response = await fetch('/api/pki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_crl' }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to regenerate CRL')
      }

      toast.success('CRL regenerated successfully')
      fetchCAs()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to regenerate CRL')
    } finally {
      setRegeneratingCrl(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="default">Active</Badge>
      case 'EXPIRED':
        return <Badge variant="secondary">Expired</Badge>
      case 'DISABLED':
        return <Badge variant="outline">Disabled</Badge>
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
      case 'DISABLED':
        return <XCircle className="h-4 w-4 text-gray-500" />
      case 'REVOKED':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />
    }
  }

  const getTypeBadge = (isExternal: boolean) => {
    return isExternal ? (
      <Badge variant="outline" className="border-amber-500 text-amber-600">
        <Globe className="h-3 w-3 mr-1" />
        External
      </Badge>
    ) : (
      <Badge variant="outline" className="border-green-500 text-green-600">
        <KeyRound className="h-3 w-3 mr-1" />
        Managed
      </Badge>
    )
  }

  const getDaysUntilExpiry = (expiryDate: string | null) => {
    if (!expiryDate) return null
    const expiry = new Date(expiryDate)
    const now = new Date()
    const diffTime = expiry.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const truncateText = (text: string | null, maxLength: number = 30) => {
    if (!text) return '-'
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
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
          <h1 className="text-2xl font-bold tracking-tight">CA Management</h1>
          <p className="text-muted-foreground">
            View and manage Certificate Authority certificates
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchCAs} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total CAs</CardTitle>
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
            <CardTitle className="text-sm font-medium">Managed PKI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.managed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">External CA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.external}</div>
          </CardContent>
        </Card>
      </div>

      {/* No CA Alert */}
      {cas.length === 0 && (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>No CA Certificates Found</AlertTitle>
          <AlertDescription>
            No Certificate Authority certificates have been configured yet.
            Go to <a href="/pki" className="underline font-medium">PKI Configuration</a> to initialize or import a CA.
          </AlertDescription>
        </Alert>
      )}

      {/* CA Table */}
      {cas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Certificate Authorities
            </CardTitle>
            <CardDescription>
              List of configured Certificate Authority certificates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Key Size</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>CRL Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cas.map((ca) => {
                    const daysUntilExpiry = getDaysUntilExpiry(ca.expiryDate)
                    const isExpiring = daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0
                    const isExpired = daysUntilExpiry !== null && daysUntilExpiry <= 0
                    
                    return (
                      <TableRow key={ca.id} className={isExpired ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(isExpired ? 'EXPIRED' : ca.status)}
                            {getStatusBadge(isExpired ? 'EXPIRED' : ca.status)}
                            {ca.isDefault && (
                              <Badge variant="outline" className="text-xs">Default</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{ca.name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={ca.subject || ''}>
                              {truncateText(ca.subject, 40)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {ca.type === 'ROOT' ? 'Root CA' : 'Intermediate CA'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getTypeBadge(ca.isExternal)}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">
                            {ca.keySize ? `${ca.keySize} bits` : '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {ca.expiryDate ? (
                            <div className="flex flex-col">
                              <span className="text-sm">
                                {new Date(ca.expiryDate).toLocaleDateString()}
                              </span>
                              {daysUntilExpiry !== null && (
                                <span className={`text-xs ${isExpiring || isExpired ? 'text-red-500' : 'text-muted-foreground'}`}>
                                  {isExpired 
                                    ? 'Expired' 
                                    : `${daysUntilExpiry} days left`
                                  }
                                </span>
                              )}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {ca.crlInfo ? (
                            <div className="flex flex-col">
                              <span className="text-sm">
                                v{ca.crlInfo.version}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {ca.crlInfo.revokedCount} revoked
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
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
                              <DropdownMenuItem onClick={() => handleViewDetails(ca)}>
                                <FileKey className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownloadCA(ca)}>
                                <Download className="mr-2 h-4 w-4" />
                                Download CA Cert
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDeployCA(ca)}
                                disabled={deploying === ca.id}
                              >
                                {deploying === ca.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                )}
                                Deploy to strongSwan
                              </DropdownMenuItem>
                              {!ca.isExternal && ca.crlInfo && (
                                <DropdownMenuItem 
                                  onClick={handleRegenerateCRL}
                                  disabled={regeneratingCrl}
                                >
                                  {regeneratingCrl ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                  )}
                                  Regenerate CRL
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CA Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              CA Certificate Details
            </DialogTitle>
            <DialogDescription>
              Detailed information about this Certificate Authority
            </DialogDescription>
          </DialogHeader>
          {selectedCA && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Name</p>
                  <p className="font-medium">{selectedCA.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(selectedCA.status)}
                    {getStatusBadge(selectedCA.status)}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p>{selectedCA.type === 'ROOT' ? 'Root CA' : 'Intermediate CA'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Mode</p>
                  <p>{selectedCA.isExternal ? 'External CA' : 'Managed PKI'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Subject DN</p>
                  <p className="font-mono text-xs break-all">{selectedCA.subject || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    Serial Number
                  </p>
                  <p className="font-mono text-xs break-all">{selectedCA.serialNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Key Size</p>
                  <p>{selectedCA.keySize ? `${selectedCA.keySize} bits` : '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Issue Date
                  </p>
                  <p>{selectedCA.issueDate ? new Date(selectedCA.issueDate).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Expiry Date
                  </p>
                  <p>{selectedCA.expiryDate ? new Date(selectedCA.expiryDate).toLocaleDateString() : '-'}</p>
                </div>
              </div>

              {/* CRL Information */}
              {selectedCA.crlInfo && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    CRL Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Version</p>
                      <p>{selectedCA.crlInfo.version}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Revoked Certificates</p>
                      <p>{selectedCA.crlInfo.revokedCount}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Last Update</p>
                      <p>{new Date(selectedCA.crlInfo.thisUpdate).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Next Update</p>
                      <p>{new Date(selectedCA.crlInfo.nextUpdate).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* External CA CRL URL */}
              {selectedCA.isExternal && selectedCA.crlUrl && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">CRL URL</h4>
                  <p className="font-mono text-xs break-all bg-muted p-2 rounded">
                    {selectedCA.crlUrl}
                  </p>
                </div>
              )}

              {/* Files Status */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <FileKey className="h-4 w-4" />
                  Files Status
                </h4>
                <div className="flex items-center gap-2">
                  {selectedCA.filesExist ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Certificate file exists</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm">Certificate file not found</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Close
            </Button>
            {selectedCA && (
              <>
                <Button variant="outline" onClick={() => handleDownloadCA(selectedCA)}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
                <Button onClick={() => handleDeployCA(selectedCA)} disabled={deploying === selectedCA.id}>
                  {deploying === selectedCA.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Deploy
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Actions */}
      {cas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common CA management operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <a href="/pki">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  PKI Configuration
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/certificates">
                  <FileKey className="mr-2 h-4 w-4" />
                  Client Certificates
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/server-certificates">
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Server Certificates
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/revocation">
                  <XCircle className="mr-2 h-4 w-4" />
                  Revocation List
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
