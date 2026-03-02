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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Download,
  Ban,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  FileKey,
} from 'lucide-react'
import { toast } from 'sonner'

interface RevokedCertificate {
  id: string
  commonName: string
  username: string
  serialNumber: string
  revokedAt: string
  reason: string
  crlPublished: boolean
}

interface CrlInfo {
  version: number
  thisUpdate: string
  nextUpdate: string
  revokedCount: number
  fileExists: boolean
}

export function RevocationContent() {
  const [revokedCerts, setRevokedCerts] = useState<RevokedCertificate[]>([])
  const [crlInfo, setCrlInfo] = useState<CrlInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showRevokeDialog, setShowRevokeDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchData = async () => {
    try {
      // Fetch CRL info from PKI endpoint
      const pkiResponse = await fetch('/api/pki')
      if (pkiResponse.ok) {
        const pkiData = await pkiResponse.json()
        setCrlInfo(pkiData.crl)
      }

      // Fetch revoked certificates from certificates endpoint
      const certResponse = await fetch('/api/certificates?status=REVOKED')
      if (certResponse.ok) {
        const certData = await certResponse.json()
        const revoked = certData.certificates.map((cert: any) => ({
          id: cert.id,
          commonName: cert.commonName,
          username: cert.user?.username || cert.username || 'Unknown',
          serialNumber: cert.serialNumber,
          revokedAt: cert.revocation?.revokedAt || cert.updatedAt,
          reason: cert.revocation?.reason || 'UNSPECIFIED',
          crlPublished: cert.revocation?.crlPublished || false,
        }))
        setRevokedCerts(revoked)
      }
    } catch (error) {
      console.error('Error fetching revocation data:', error)
      toast.error('Failed to load revocation data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filteredCerts = revokedCerts.filter((cert) =>
    cert.commonName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cert.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cert.serialNumber.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleRegenerateCRL = async () => {
    try {
      const response = await fetch('/api/pki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_crl' }),
      })

      if (!response.ok) throw new Error('Failed to regenerate CRL')

      toast.success('CRL regenerated successfully')
      fetchData()
    } catch (error) {
      toast.error('Failed to regenerate CRL')
    }
  }

  const handleDownloadCRL = () => {
    window.open('/api/crl', '_blank')
    toast.success('CRL download started')
  }

  const handleDeployToStrongSwan = async () => {
    try {
      const response = await fetch('/api/pki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deploy_to_strongswan' }),
      })

      if (!response.ok) throw new Error('Failed to deploy')

      toast.success('CRL deployed to strongSwan')
      fetchData()
    } catch (error) {
      toast.error('Failed to deploy to strongSwan')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const reasonLabels: Record<string, string> = {
    UNSPECIFIED: 'Unspecified',
    KEY_COMPROMISE: 'Key Compromise',
    CA_COMPROMISE: 'CA Compromise',
    AFFILIATION_CHANGED: 'Affiliation Changed',
    SUPERSEDED: 'Superseded',
    CESSATION_OF_OPERATION: 'Cessation of Operation',
    CERTIFICATE_HOLD: 'Certificate Hold',
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
          <h1 className="text-2xl font-bold tracking-tight">Revocation Management</h1>
          <p className="text-muted-foreground">
            Certificate revocation and CRL management
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRegenerateCRL}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Regenerate CRL
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revoked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{crlInfo?.revokedCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In CRL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {crlInfo?.revokedCount || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">CRL Last Update</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {crlInfo?.thisUpdate ? formatDate(crlInfo.thisUpdate) : 'Never'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">CRL Next Update</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {crlInfo?.nextUpdate ? formatDate(crlInfo.nextUpdate) : 'N/A'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CRL Status */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              CRL Status
            </CardTitle>
            <CardDescription>
              Certificate Revocation List information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
              <div>
                <p className="font-medium">CRL File</p>
                <p className="text-sm text-muted-foreground font-mono">/etc/swanctl/x509crl/ca.crl.pem</p>
              </div>
              <Badge variant={crlInfo?.fileExists ? 'default' : 'secondary'}>
                {crlInfo?.fileExists ? 'Active' : 'Not Found'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">CRL Version</p>
                <p className="font-medium">{crlInfo?.version || 1}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Entries</p>
                <p className="font-medium">{crlInfo?.revokedCount || 0}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleDownloadCRL}>
                <Download className="mr-2 h-4 w-4" />
                Download CRL
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Deployment Status
            </CardTitle>
            <CardDescription>
              CRL deployment to strongSwan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Deployed</AlertTitle>
              <AlertDescription>
                CRL is deployed and active in strongSwan configuration.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Deploy To</Label>
              <div className="rounded-md bg-muted p-3 font-mono text-sm">
                /etc/swanctl/x509crl/
              </div>
            </div>

            <Button className="w-full" onClick={handleDeployToStrongSwan}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Deploy to strongSwan
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Revoked Certificates Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Revoked Certificates</CardTitle>
              <CardDescription>
                List of all revoked certificates
              </CardDescription>
            </div>
            <div className="relative sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <ShieldCheck className="h-8 w-8 mb-2 opacity-50" />
              <p>No revoked certificates</p>
              <p className="text-sm">Revoke certificates from the Certificates page</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Common Name</TableHead>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Revoked At</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>In CRL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCerts.map((cert) => (
                    <TableRow key={cert.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{cert.commonName}</p>
                          <p className="text-sm text-muted-foreground">{cert.username}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs break-all max-w-[150px]">
                        {cert.serialNumber}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(cert.revokedAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {reasonLabels[cert.reason] || cert.reason}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {cert.crlPublished ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
