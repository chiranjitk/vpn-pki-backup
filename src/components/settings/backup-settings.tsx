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
  Database,
  Download,
  Upload,
  Trash2,
  Loader2,
  HardDrive,
  Clock,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

interface BackupRecord {
  id: string
  filename: string
  size: number
  type: string
  status: string
  createdAt: string
}

export function BackupSettings() {
  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingBackup, setCreatingBackup] = useState(false)
  const [restoringBackup, setRestoringBackup] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  useEffect(() => {
    fetchBackups()
  }, [])

  const fetchBackups = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/backup')
      if (response.ok) {
        const data = await response.json()
        setBackups(data.backups || [])
      }
    } catch (error) {
      console.error('Failed to fetch backups:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBackup = async (type: 'FULL' | 'DATABASE' | 'CONFIGURATION') => {
    setCreatingBackup(true)
    try {
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })

      if (!response.ok) throw new Error('Failed to create backup')

      const data = await response.json()
      toast.success(`Backup created: ${data.backup?.filename || 'successfully'}`)
      setShowCreateDialog(false)
      fetchBackups()
    } catch (error) {
      toast.error('Failed to create backup')
    } finally {
      setCreatingBackup(false)
    }
  }

  const handleDownloadBackup = async (backup: BackupRecord) => {
    window.open(`/api/backup/${backup.id}/download`, '_blank')
  }

  const handleRestoreBackup = async (backup: BackupRecord) => {
    if (!confirm(`Are you sure you want to restore from ${backup.filename}? This will overwrite current data.`)) return

    setRestoringBackup(backup.id)
    try {
      const response = await fetch(`/api/backup/${backup.id}/restore`, {
        method: 'POST',
      })

      if (!response.ok) throw new Error('Failed to restore backup')

      toast.success('Backup restored successfully. Please refresh the page.')
    } catch (error) {
      toast.error('Failed to restore backup')
    } finally {
      setRestoringBackup(null)
    }
  }

  const handleDeleteBackup = async (backup: BackupRecord) => {
    if (!confirm(`Delete backup ${backup.filename}?`)) return

    try {
      const response = await fetch(`/api/backup/${backup.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete backup')

      toast.success('Backup deleted')
      fetchBackups()
    } catch (error) {
      toast.error('Failed to delete backup')
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Backup & Restore</h2>
          <p className="text-muted-foreground">Manage system backups and restore points</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchBackups}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Backup
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Backup History
          </CardTitle>
          <CardDescription>
            List of all system backups
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filename</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        <HardDrive className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No backups available</p>
                        <p className="text-sm">Create your first backup to get started</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    backups.map((backup) => (
                      <TableRow key={backup.id}>
                        <TableCell className="font-medium font-mono text-sm">
                          {backup.filename}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{backup.type}</Badge>
                        </TableCell>
                        <TableCell>{formatBytes(backup.size)}</TableCell>
                        <TableCell>
                          <Badge variant={backup.status === 'COMPLETED' ? 'default' : 'secondary'}>
                            {backup.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(backup.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDownloadBackup(backup)}
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleRestoreBackup(backup)}
                              disabled={restoringBackup === backup.id}
                              title="Restore"
                            >
                              {restoringBackup === backup.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="h-4 w-4" />
                              )}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDeleteBackup(backup)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Backup Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Backup</DialogTitle>
            <DialogDescription>
              Choose the type of backup to create
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Button 
              className="w-full justify-start h-auto py-4" 
              variant="outline"
              onClick={() => handleCreateBackup('FULL')}
              disabled={creatingBackup}
            >
              <div className="flex items-start gap-3">
                <Database className="h-5 w-5 mt-0.5" />
                <div className="text-left">
                  <div className="font-semibold">Full Backup</div>
                  <div className="text-sm text-muted-foreground">
                    Complete backup including database, certificates, and configuration
                  </div>
                </div>
              </div>
            </Button>
            <Button 
              className="w-full justify-start h-auto py-4" 
              variant="outline"
              onClick={() => handleCreateBackup('DATABASE')}
              disabled={creatingBackup}
            >
              <div className="flex items-start gap-3">
                <HardDrive className="h-5 w-5 mt-0.5" />
                <div className="text-left">
                  <div className="font-semibold">Database Only</div>
                  <div className="text-sm text-muted-foreground">
                    Backup of the SQLite database only
                  </div>
                </div>
              </div>
            </Button>
            <Button 
              className="w-full justify-start h-auto py-4" 
              variant="outline"
              onClick={() => handleCreateBackup('CONFIGURATION')}
              disabled={creatingBackup}
            >
              <div className="flex items-start gap-3">
                <Database className="h-5 w-5 mt-0.5" />
                <div className="text-left">
                  <div className="font-semibold">Configuration Only</div>
                  <div className="text-sm text-muted-foreground">
                    System settings and VPN configuration
                  </div>
                </div>
              </div>
            </Button>
          </div>
          {creatingBackup && (
            <div className="flex items-center justify-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Creating backup...</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={creatingBackup}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
