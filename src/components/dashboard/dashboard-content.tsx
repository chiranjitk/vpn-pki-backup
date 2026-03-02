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
import { Progress } from '@/components/ui/progress'
import {
  Users,
  FileKey,
  ShieldCheck,
  AlertTriangle,
  Server,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Download,
  Plus,
} from 'lucide-react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface DashboardStats {
  totalUsers: number
  activeUsers: number
  totalCertificates: number
  activeCertificates: number
  expiredCertificates: number
  revokedCertificates: number
  expiringSoon: number
}

interface VpnStatus {
  status: string
  uptime?: number
  activeConnections: number
  version: string
}

interface CrlInfo {
  lastUpdate: string | null
  nextUpdate: string | null
  revokedCount: number
}

interface ExpiringCertificate {
  id: string
  commonName: string
  username: string
  expiryDate: string
  daysRemaining: number
}

interface RecentActivity {
  id: string
  action: string
  user: string
  timestamp: string
  status: 'success' | 'failure' | 'warning'
}

interface DashboardData {
  stats: DashboardStats
  vpn: VpnStatus
  crl: CrlInfo
  expiringCertificates: ExpiringCertificate[]
  recentActivity: RecentActivity[]
}

interface User {
  id: string
  username: string
  email: string
  fullName: string
  hasCert: boolean
}

function formatUptime(seconds: number): string {
  if (!seconds) return 'N/A'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${days}d ${hours}h ${mins}m`
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) return `${diffDays}d ago`
  if (diffHours > 0) return `${diffHours}h ago`
  if (diffMins > 0) return `${diffMins}m ago`
  return 'Just now'
}

export function DashboardContent() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showNewCertDialog, setShowNewCertDialog] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [validityDays, setValidityDays] = useState('365')
  const [keySize, setKeySize] = useState('4096')
  const [isGenerating, setIsGenerating] = useState(false)
  const [validityMode, setValidityMode] = useState<'preset' | 'custom'>('preset')
  const [customExpiryDate, setCustomExpiryDate] = useState<string>('')

  const fetchData = async () => {
    try {
      const response = await fetch('/api/dashboard')
      if (!response.ok) throw new Error('Failed to fetch dashboard data')
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching dashboard:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const result = await response.json()
        setUsers(result.users.map((u: any) => ({
          id: u.id,
          username: u.username,
          email: u.email,
          fullName: u.fullName,
          hasCert: u.certificateStatus === 'ACTIVE',
        })))
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (showNewCertDialog) {
      fetchUsers()
    }
  }, [showNewCertDialog])

  const handleRefresh = () => {
    setIsLoading(true)
    fetchData()
    toast.success('Dashboard data refreshed')
  }

  const handleNewCertificate = () => {
    setShowNewCertDialog(true)
  }

  const handleGenerateCertificate = async () => {
    if (!selectedUser) {
      toast.error('Please select a user')
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
      toast.success(`Certificate generated for ${result.certificate.commonName}`)
      setShowNewCertDialog(false)
      setSelectedUser('')
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate certificate')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleReloadVPN = async () => {
    try {
      const response = await fetch('/api/vpn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reload' }),
      })
      const result = await response.json()
      if (result.success) {
        toast.success('VPN configuration reloaded')
      } else {
        toast.error(result.message || 'Failed to reload VPN')
      }
    } catch (error) {
      toast.error('Failed to reload VPN')
    }
  }

  const handleViewLogs = () => {
    router.push('/audit')
  }

  const handleViewAllCertificates = () => {
    router.push('/certificates')
  }

  const handleExportCRL = async () => {
    try {
      const response = await fetch('/api/pki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_crl' }),
      })
      if (response.ok) {
        toast.success('CRL regenerated successfully')
        fetchData()
      }
    } catch (error) {
      toast.error('Failed to export CRL')
    }
  }

  const handleRenewCert = async (certId: string) => {
    toast.info('Certificate renewal - please use the Certificates page')
    router.push('/certificates')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-12 w-12 text-yellow-500" />
        <p className="text-muted-foreground">Failed to load dashboard data</p>
        <Button onClick={fetchData}>Retry</Button>
      </div>
    )
  }

  const certificateHealthPercent = data.stats.totalCertificates > 0
    ? Math.round((data.stats.activeCertificates / data.stats.totalCertificates) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            VPN Server Management Overview
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={handleNewCertificate}>
            <Plus className="mr-2 h-4 w-4" />
            New Certificate
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => router.push('/users')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {data.stats.activeUsers} active
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => router.push('/certificates')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Certificates</CardTitle>
            <FileKey className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.activeCertificates}</div>
            <p className="text-xs text-muted-foreground">
              of {data.stats.totalCertificates} total
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => router.push('/revocation')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revoked</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.revokedCertificates}</div>
            <p className="text-xs text-muted-foreground">
              certificates revoked
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => router.push('/certificates')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{data.stats.expiringSoon}</div>
            <p className="text-xs text-muted-foreground">
              within 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* VPN Status & Certificate Health */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              VPN Service Status
            </CardTitle>
            <CardDescription>strongSwan 6.0.1 IKEv2 EAP-TLS</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {data.vpn.status === 'RUNNING' ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Running</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="font-medium">{data.vpn.status}</span>
                  </>
                )}
              </div>
              <Badge variant={data.vpn.status === 'RUNNING' ? 'default' : 'destructive'}>
                {data.vpn.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Uptime</p>
                <p className="font-medium">{formatUptime(data.vpn.uptime || 0)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Active Connections</p>
                <p className="font-medium">{data.vpn.activeConnections}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last CRL Update</p>
                <p className="font-medium">
                  {data.crl.lastUpdate ? formatRelativeTime(data.crl.lastUpdate) : 'Never'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Next CRL Update</p>
                <p className="font-medium">
                  {data.crl.nextUpdate ? formatRelativeTime(data.crl.nextUpdate) : 'N/A'}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={handleReloadVPN}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reload VPN
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={handleViewLogs}>
                <Activity className="mr-2 h-4 w-4" />
                View Logs
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileKey className="h-5 w-5" />
              Certificate Health
            </CardTitle>
            <CardDescription>Certificate lifecycle status overview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Active</span>
                <span className="font-medium">{certificateHealthPercent}%</span>
              </div>
              <Progress value={certificateHealthPercent} className="h-2" />
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg bg-green-500/10 p-3">
                <p className="text-2xl font-bold text-green-600">{data.stats.activeCertificates}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
              <div className="rounded-lg bg-yellow-500/10 p-3">
                <p className="text-2xl font-bold text-yellow-600">{data.stats.expiredCertificates}</p>
                <p className="text-xs text-muted-foreground">Expired</p>
              </div>
              <div className="rounded-lg bg-red-500/10 p-3">
                <p className="text-2xl font-bold text-red-600">{data.stats.revokedCertificates}</p>
                <p className="text-xs text-muted-foreground">Revoked</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={handleViewAllCertificates}>
                View All Certificates
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={handleExportCRL}>
                <Download className="mr-2 h-4 w-4" />
                Export CRL
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expiring Certificates & Recent Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Certificates Expiring Soon
            </CardTitle>
            <CardDescription>Certificates that need renewal within 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {data.expiringCertificates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No certificates expiring soon</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Common Name</TableHead>
                    <TableHead>Days Left</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.expiringCertificates.map((cert) => (
                    <TableRow key={cert.id}>
                      <TableCell className="font-medium">{cert.commonName}</TableCell>
                      <TableCell>
                        <Badge variant={cert.daysRemaining <= 7 ? 'destructive' : 'secondary'}>
                          {cert.daysRemaining} days
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleRenewCert(cert.id)}>
                          Renew
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest system events and operations</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No recent activity</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      {activity.status === 'success' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : activity.status === 'failure' ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{activity.action}</p>
                        <p className="text-xs text-muted-foreground">
                          by {activity.user}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(activity.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Certificate Dialog */}
      <Dialog open={showNewCertDialog} onOpenChange={setShowNewCertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate New Certificate</DialogTitle>
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
                      {user.hasCert ? ' - Has Certificate' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Button variant="outline" onClick={() => setShowNewCertDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateCertificate} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Certificate'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
