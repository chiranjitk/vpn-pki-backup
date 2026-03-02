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
  DialogTrigger,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  History,
  Search,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Trash2,
  AlertOctagon,
} from 'lucide-react'
import { toast } from 'sonner'

interface AuditLog {
  id: string
  action: string
  category: string
  actor: string
  actorType: string
  targetId: string | null
  targetType: string | null
  details: any
  status: string
  errorMessage: string | null
  createdAt: string
}

interface AuditStats {
  todayTotal: number
  todaySuccess: number
  todayFailure: number
}

const categoryColors: Record<string, string> = {
  AUTHENTICATION: 'bg-blue-500/10 text-blue-600',
  USER_MANAGEMENT: 'bg-green-500/10 text-green-600',
  CERTIFICATE_OPERATIONS: 'bg-purple-500/10 text-purple-600',
  PKI_MANAGEMENT: 'bg-orange-500/10 text-orange-600',
  REVOCATION: 'bg-red-500/10 text-red-600',
  CRL_OPERATIONS: 'bg-cyan-500/10 text-cyan-600',
  VPN_INTEGRATION: 'bg-pink-500/10 text-pink-600',
  SYSTEM_CONFIG: 'bg-gray-500/10 text-gray-600',
  CA_OPERATIONS: 'bg-yellow-500/10 text-yellow-600',
  ADMIN_OPERATIONS: 'bg-indigo-500/10 text-indigo-600',
}

export function AuditContent() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [stats, setStats] = useState<AuditStats>({ todayTotal: 0, todaySuccess: 0, todayFailure: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })
  const [clearMode, setClearMode] = useState<'all' | 'keep-recent'>('keep-recent')
  const [keepDays, setKeepDays] = useState(30)
  const [clearing, setClearing] = useState(false)

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.append('search', searchQuery)
      if (categoryFilter !== 'all') params.append('category', categoryFilter)
      params.append('page', String(pagination.page))
      params.append('limit', '50')

      const response = await fetch(`/api/audit?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch audit logs')
      const data = await response.json()
      setLogs(data.logs)
      setStats(data.stats)
      setPagination(prev => ({ ...prev, total: data.pagination.total, totalPages: data.pagination.totalPages }))
    } catch (error) {
      console.error('Error fetching audit logs:', error)
      toast.error('Failed to load audit logs')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [searchQuery, categoryFilter, pagination.page])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'FAILURE':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'WARNING':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default:
        return null
    }
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (categoryFilter !== 'all') params.append('category', categoryFilter)

      const response = await fetch(`/api/audit?${params.toString()}&format=csv`, {
        method: 'POST',
      })

      if (!response.ok) throw new Error('Failed to export')

      const csv = await response.text()
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)

      toast.success('Audit logs exported')
    } catch (error) {
      toast.error('Failed to export audit logs')
    }
  }

  const handleClearLogs = async () => {
    setClearing(true)
    try {
      const params = new URLSearchParams()
      params.append('mode', clearMode)
      if (clearMode === 'keep-recent') {
        params.append('keepDays', String(keepDays))
      }

      const response = await fetch(`/api/audit?${params.toString()}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to clear logs')

      const data = await response.json()
      toast.success(data.message)
      fetchLogs()
    } catch (error) {
      toast.error('Failed to clear audit logs')
    } finally {
      setClearing(false)
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
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">
            System activity and operation history
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchLogs}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Logs
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <div className="flex items-center gap-2">
                  <AlertOctagon className="h-5 w-5 text-destructive" />
                  <AlertDialogTitle>Clear Audit Logs</AlertDialogTitle>
                </div>
                <AlertDialogDescription className="space-y-4 pt-2">
                  <p className="text-destructive font-medium">
                    ⚠️ Warning: This action cannot be undone!
                  </p>
                  <p>
                    This will permanently delete audit log records. Consider exporting logs before clearing.
                  </p>
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium">Clear Mode:</span>
                      <Select value={clearMode} onValueChange={(v: 'all' | 'keep-recent') => setClearMode(v)}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="keep-recent">Keep Recent (Recommended)</SelectItem>
                          <SelectItem value="all">Clear All Logs</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {clearMode === 'keep-recent' && (
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium">Keep days:</span>
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          value={keepDays}
                          onChange={(e) => setKeepDays(parseInt(e.target.value) || 30)}
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">days of logs</span>
                      </div>
                    )}
                    {clearMode === 'all' && (
                      <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                        <p className="text-sm text-destructive font-medium">
                          All {pagination.total} audit log records will be permanently deleted!
                        </p>
                      </div>
                    )}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearLogs}
                  disabled={clearing}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {clearing ? 'Clearing...' : 'Clear Logs'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Today's Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayTotal}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Success</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.todaySuccess}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failures</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.todayFailure}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagination.total}</div>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-4">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                  <SelectItem value="USER_MANAGEMENT">User Management</SelectItem>
                  <SelectItem value="CERTIFICATE_OPERATIONS">Certificate Ops</SelectItem>
                  <SelectItem value="PKI_MANAGEMENT">PKI Management</SelectItem>
                  <SelectItem value="REVOCATION">Revocation</SelectItem>
                  <SelectItem value="CRL_OPERATIONS">CRL Operations</SelectItem>
                  <SelectItem value="VPN_INTEGRATION">VPN Integration</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No audit logs found</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {formatDate(log.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {log.action.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${categoryColors[log.category] || ''}`}>
                          {log.category.replace(/_/g, ' ')}
                        </span>
                      </TableCell>
                      <TableCell>
                        {log.actor || log.actorType}
                      </TableCell>
                      <TableCell>
                        {log.targetType ? `${log.targetType}` : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.status)}
                          <span className="capitalize">{log.status.toLowerCase()}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
