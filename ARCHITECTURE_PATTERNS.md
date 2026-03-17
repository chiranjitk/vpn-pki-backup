# VPN PKI Manager - Architecture & Development Patterns

## Overview

This document serves as a comprehensive guide for developers working on the VPN PKI Manager codebase. It captures the architectural decisions, coding patterns, and best practices used throughout the project.

---

## Technology Stack

### Frontend Framework
- **Next.js 14+** with App Router
- **React 18+** with TypeScript
- **Tailwind CSS** for styling

### UI Component Library
- **shadcn/ui** - Built on Radix UI primitives
- **Lucide React** for icons
- **Sonner** for toast notifications
- **Recharts** for data visualization

### Key Dependencies
```json
{
  "@radix-ui/react-*": "Various primitives",
  "lucide-react": "^0.x.x",
  "sonner": "^1.x.x",
  "recharts": "^2.x.x",
  "tailwindcss": "^3.x.x"
}
```

---

## Component Architecture Patterns

### 1. Page Component Structure

Every page component follows this consistent structure:

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
// ... other imports

interface Entity {
  id: string
  // ... properties
}

export function EntityContent() {
  // 1. State declarations
  const [items, setItems] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<Entity | null>(null)

  // 2. Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isEnabled: true,
  })

  // 3. Data fetching on mount
  useEffect(() => {
    fetchItems()
  }, [])

  // 4. API functions
  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/entity')
      if (response.ok) {
        const data = await response.json()
        setItems(data.items || [])
      }
    } catch (error) {
      console.error('Failed to fetch:', error)
      toast.error('Failed to load items')
    } finally {
      setLoading(false)
    }
  }, [])

  // 5. CRUD handlers
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required')
      return
    }
    
    setSaving(true)
    try {
      const url = editingItem ? `/api/entity/${editingItem.id}` : '/api/entity'
      const method = editingItem ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success(editingItem ? 'Item updated' : 'Item created')
        setShowDialog(false)
        fetchItems()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this item?')) return
    
    try {
      const response = await fetch(`/api/entity/${id}`, { method: 'DELETE' })
      if (response.ok) {
        toast.success('Item deleted')
        fetchItems()
      }
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleToggle = async (item: Entity) => {
    try {
      const response = await fetch(`/api/entity/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !item.isEnabled }),
      })
      if (response.ok) {
        toast.success(`Item ${!item.isEnabled ? 'enabled' : 'disabled'}`)
        fetchItems()
      }
    } catch {
      toast.error('Failed to update')
    }
  }

  // 6. Dialog helpers
  const openCreateDialog = () => {
    setEditingItem(null)
    setFormData({ name: '', description: '', isEnabled: true })
    setShowDialog(true)
  }

  const openEditDialog = (item: Entity) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      description: item.description || '',
      isEnabled: item.isEnabled,
    })
    setShowDialog(true)
  }

  // 7. Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // 8. Render
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Entity Name</h1>
          <p className="text-muted-foreground">Entity description</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchItems}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Entity
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Stat cards */}
      </div>

      {/* Main Content */}
      <Card>
        {/* Table or content */}
      </Card>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        {/* Dialog content */}
      </Dialog>
    </div>
  )
}
```

---

## State Management Patterns

### useState Hook Patterns

```typescript
// Entity list state
const [items, setItems] = useState<Entity[]>([])

// Loading states
const [loading, setLoading] = useState(true)
const [saving, setSaving] = useState(false)
const [deleting, setDeleting] = useState<string | null>(null)

// Dialog states
const [showDialog, setShowDialog] = useState(false)
const [showDeleteDialog, setShowDeleteDialog] = useState(false)

// Selection state
const [selectedItem, setSelectedItem] = useState<Entity | null>(null)
const [editingItem, setEditingItem] = useState<Entity | null>(null)

// Form state (group related fields)
const [formData, setFormData] = useState({
  name: '',
  description: '',
  isEnabled: true,
  // ... other fields
})

// Update form field pattern
setFormData(prev => ({ ...prev, name: value }))
```

### useCallback for Data Fetching

```typescript
const fetchData = useCallback(async () => {
  setLoading(true)
  try {
    const response = await fetch('/api/entity')
    if (response.ok) {
      const data = await response.json()
      setItems(data.items || [])
    }
  } catch (error) {
    console.error('Failed to fetch:', error)
    toast.error('Failed to load data')
  } finally {
    setLoading(false)
  }
}, [dependency1, dependency2]) // Include dependencies

useEffect(() => {
  fetchData()
}, [fetchData])
```

---

## API Interaction Patterns

### Standard CRUD Operations

#### GET (List)
```typescript
const fetchItems = async () => {
  try {
    const params = new URLSearchParams()
    if (searchQuery) params.append('search', searchQuery)
    if (statusFilter) params.append('status', statusFilter)

    const response = await fetch(`/api/entity?${params.toString()}`)
    if (response.ok) {
      const data = await response.json()
      setItems(data.items || [])
    }
  } catch (error) {
    toast.error('Failed to fetch')
  }
}
```

#### POST (Create)
```typescript
const handleCreate = async () => {
  setSaving(true)
  try {
    const response = await fetch('/api/entity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })

    if (response.ok) {
      toast.success('Created successfully')
      fetchItems()
    } else {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create')
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to create')
  } finally {
    setSaving(false)
  }
}
```

#### PUT (Update)
```typescript
const handleUpdate = async () => {
  setSaving(true)
  try {
    const response = await fetch('/api/entity', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingItem.id, ...formData }),
    })

    if (response.ok) {
      toast.success('Updated successfully')
      setShowDialog(false)
      fetchItems()
    } else {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update')
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to update')
  } finally {
    setSaving(false)
  }
}
```

#### DELETE
```typescript
const handleDelete = async (id: string) => {
  try {
    const response = await fetch(`/api/entity/${id}`, {
      method: 'DELETE',
    })

    if (response.ok) {
      toast.success('Deleted successfully')
      fetchItems()
    } else {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete')
    }
  } catch (error) {
    toast.error('Failed to delete')
  }
}
```

#### PATCH (Partial Update)
```typescript
const handleToggle = async (id: string, currentValue: boolean) => {
  try {
    const response = await fetch(`/api/entity/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled: !currentValue }),
    })

    if (response.ok) {
      toast.success('Status updated')
      fetchItems()
    }
  } catch {
    toast.error('Failed to update')
  }
}
```

---

## UI Component Patterns

### Page Header Pattern
```tsx
<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <div>
    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
      <Icon className="h-6 w-6 text-primary" />
      Page Title
    </h1>
    <p className="text-muted-foreground">Page description</p>
  </div>
  <div className="flex gap-2">
    <Button variant="outline" size="sm" onClick={fetchData}>
      <RefreshCw className="h-4 w-4 mr-2" />
      Refresh
    </Button>
    <Button size="sm" onClick={openCreateDialog}>
      <Plus className="h-4 w-4 mr-2" />
      Add Item
    </Button>
  </div>
</div>
```

### Stats Cards Pattern
```tsx
<div className="grid gap-4 md:grid-cols-4">
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2">
        <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <div className="text-2xl font-bold">{count}</div>
          <p className="text-xs text-muted-foreground">Label</p>
        </div>
      </div>
    </CardContent>
  </Card>
  {/* More stat cards */}
</div>
```

### Data Table Pattern
```tsx
<Card>
  <CardHeader>
    <CardTitle>Items</CardTitle>
    <CardDescription>Description of the table contents</CardDescription>
  </CardHeader>
  <CardContent>
    {loading ? (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ) : items.length === 0 ? (
      <div className="text-center py-8 text-muted-foreground">
        <Icon className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No items found</p>
        <Button variant="link" onClick={openCreateDialog}>Create first item</Button>
      </div>
    ) : (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Column</TableHead>
              {/* More columns */}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} className={!item.isEnabled ? 'opacity-50' : ''}>
                <TableCell>
                  <div className="font-medium">{item.name}</div>
                  {item.description && (
                    <div className="text-xs text-muted-foreground">{item.description}</div>
                  )}
                </TableCell>
                {/* More cells */}
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="h-4 w-4" />
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
```

### Dialog Form Pattern
```tsx
<Dialog open={showDialog} onOpenChange={setShowDialog}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>{editingItem ? 'Edit Item' : 'Add Item'}</DialogTitle>
      <DialogDescription>Configure item settings</DialogDescription>
    </DialogHeader>
    
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Field Name</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Enter value"
        />
      </div>
      
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Enabled</Label>
          <p className="text-xs text-muted-foreground">Description</p>
        </div>
        <Switch
          checked={formData.isEnabled}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isEnabled: checked }))}
        />
      </div>
    </div>
    
    <DialogFooter>
      <Button variant="outline" onClick={() => setShowDialog(false)}>
        Cancel
      </Button>
      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {editingItem ? 'Update' : 'Create'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Confirmation Dialog Pattern
```tsx
<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Item?</AlertDialogTitle>
      <AlertDialogDescription>
        This will permanently delete the item. This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
      <AlertDialogAction
        onClick={handleConfirmDelete}
        disabled={saving}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        {saving ? 'Deleting...' : 'Delete'}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## Form Handling Patterns

### Form State Management
```typescript
const [formData, setFormData] = useState({
  name: '',
  description: '',
  isEnabled: true,
  type: 'DEFAULT',
  port: 443,
})

// Update single field
const updateField = (key: keyof typeof formData, value: any) => {
  setFormData(prev => ({ ...prev, [key]: value }))
}

// Reset form
const resetForm = () => {
  setFormData({
    name: '',
    description: '',
    isEnabled: true,
    type: 'DEFAULT',
    port: 443,
  })
}
```

### Form Validation
```typescript
const handleSave = async () => {
  // Validation
  if (!formData.name.trim()) {
    toast.error('Name is required')
    return
  }
  
  if (!formData.host.trim()) {
    toast.error('Host is required')
    return
  }

  // Pattern validation
  const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
  if (!cidrRegex.test(formData.cidr)) {
    toast.error('Invalid CIDR format')
    return
  }

  // Proceed with save
  setSaving(true)
  // ... API call
}
```

---

## Common UI Patterns

### Status Badges
```tsx
// Simple status
<Badge variant={item.isEnabled ? 'default' : 'secondary'}>
  {item.isEnabled ? 'Active' : 'Inactive'}
</Badge>

// With colors
<Badge className="bg-green-500 text-white">Running</Badge>
<Badge variant="destructive">Error</Badge>

// Type-based colors
const getTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    'TYPE_A': 'bg-blue-500',
    'TYPE_B': 'bg-green-500',
    'TYPE_C': 'bg-purple-500',
  }
  return colors[type] || 'bg-gray-500'
}

<Badge className={`${getTypeColor(type)} text-white`}>{type}</Badge>
```

### Action Buttons
```tsx
// Icon-only buttons
<Button variant="ghost" size="sm" onClick={handleEdit}>
  <Edit className="h-4 w-4" />
</Button>

// With text
<Button variant="ghost" size="sm" onClick={handleDelete}>
  <Trash2 className="h-4 w-4 mr-2" />
  Delete
</Button>

// Destructive button
<Button variant="ghost" size="sm" className="text-destructive" onClick={handleDelete}>
  <Trash2 className="h-4 w-4" />
</Button>
```

### Dropdown Menu Actions
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => handleEdit(item)}>
      <Edit className="mr-2 h-4 w-4" />
      Edit
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(item.id)}>
      <Trash2 className="mr-2 h-4 w-4" />
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Data Transformation Patterns

### Format Bytes
```typescript
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
}
```

### Format Numbers
```typescript
function formatNumber(num: number): string {
  return num.toLocaleString()
}
```

### Format Duration
```typescript
function formatDuration(seconds: number): string {
  if (!seconds) return '-'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
```

### Format Uptime
```typescript
function formatUptime(seconds: number): string {
  if (!seconds) return 'N/A'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h ${mins}m`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}
```

---

## Error Handling Patterns

### Try-Catch with Toast
```typescript
try {
  const response = await fetch('/api/entity')
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Operation failed')
  }
  
  const data = await response.json()
  toast.success('Operation successful')
  return data
} catch (error) {
  const message = error instanceof Error ? error.message : 'Operation failed'
  toast.error(message)
  console.error('Error:', error)
} finally {
  setLoading(false)
}
```

### Form Validation Errors
```typescript
const validateForm = (): string | null => {
  if (!formData.name.trim()) return 'Name is required'
  if (!formData.host.trim()) return 'Host is required'
  if (formData.port < 1 || formData.port > 65535) return 'Port must be 1-65535'
  return null
}

const handleSave = async () => {
  const error = validateForm()
  if (error) {
    toast.error(error)
    return
  }
  // Proceed...
}
```

---

## Tabs Pattern

```tsx
<Tabs defaultValue="overview" className="space-y-4">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="settings">Settings</TabsTrigger>
    <TabsTrigger value="advanced">Advanced</TabsTrigger>
  </TabsList>

  <TabsContent value="overview" className="space-y-4">
    {/* Overview content */}
  </TabsContent>

  <TabsContent value="settings" className="space-y-4">
    {/* Settings content */}
  </TabsContent>

  <TabsContent value="advanced" className="space-y-4">
    {/* Advanced content */}
  </TabsContent>
</Tabs>
```

---

## Alert Patterns

### Info Alert
```tsx
<Alert>
  <Info className="h-4 w-4" />
  <AlertTitle>Information</AlertTitle>
  <AlertDescription>
    Additional context or helpful information.
  </AlertDescription>
</Alert>
```

### Warning Alert
```tsx
<Alert variant="destructive">
  <AlertTriangle className="h-4 w-4" />
  <AlertTitle>Warning</AlertTitle>
  <AlertDescription>
    Something requires attention.
  </AlertDescription>
</Alert>
```

### Success Status
```tsx
<Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
  <CheckCircle2 className="h-4 w-4 text-green-500" />
  <AlertTitle>Success</AlertTitle>
  <AlertDescription>
    Operation completed successfully.
  </AlertDescription>
</Alert>
```

---

## Entity Interface Patterns

### Standard Entity Interface
```typescript
interface Entity {
  id: string
  name: string
  description?: string | null
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

interface EntityWithRelations extends Entity {
  relatedItems: RelatedItem[]
  itemCount: number
}
```

### Form Data Interface
```typescript
interface EntityFormData {
  name: string
  description: string
  isEnabled: boolean
  type: EntityType
}
```

---

## Best Practices Summary

1. **Always use TypeScript interfaces** for entities and form data
2. **Wrap fetch calls in try-catch** with appropriate error handling
3. **Use toast notifications** for user feedback
4. **Implement loading states** for all async operations
5. **Use useCallback** for functions passed to useEffect dependencies
6. **Reset form state** when opening create dialogs
7. **Pre-populate form state** when opening edit dialogs
8. **Use proper TypeScript types** for all state and props
9. **Follow the component structure** for consistency
10. **Handle edge cases**: empty states, loading states, error states

---

## Common Pitfalls to Avoid

1. **Forgetting to reset form state** - Always reset when opening create dialog
2. **Not handling null/undefined** - Use optional chaining and nullish coalescing
3. **Missing error boundaries** - Wrap API calls in try-catch
4. **Improper state updates** - Always use functional updates for derived state
5. **Memory leaks** - Clean up intervals and subscriptions in useEffect cleanup
6. **Race conditions** - Use AbortController for cancellable requests
7. **Stale closures** - Be careful with closure variables in async operations

---

## Custom Hooks

The project uses custom hooks for common functionality:

### useAuth - Authentication State Management

```typescript
// Using Zustand with persistence
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AdminUser {
  id: string
  username: string
  email: string
  role: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR' | 'VIEWER'
  status: 'ACTIVE' | 'DISABLED' | 'LOCKED'
}

interface AuthState {
  user: AdminUser | null
  token: string | null
  isAuthenticated: boolean
  login: (user: AdminUser, token: string) => void
  logout: () => void
  updateUser: (user: Partial<AdminUser>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('vpn-pki-auth')
          window.location.href = '/'
        }
        set({ user: null, token: null, isAuthenticated: false })
      },
      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),
    }),
    {
      name: 'vpn-pki-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

export function useAuth() {
  const { user, token, isAuthenticated, login, logout, updateUser } = useAuthStore()
  return { user, token, isAuthenticated, login, logout, updateUser }
}

// Permission checking hook
export function useHasPermission(requiredRole: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR' | 'VIEWER') {
  const { user } = useAuth()
  const roleHierarchy = {
    SUPER_ADMIN: 4,
    ADMIN: 3,
    OPERATOR: 2,
    VIEWER: 1,
  }
  
  if (!user) return false
  return roleHierarchy[user.role] >= roleHierarchy[requiredRole]
}
```

### Usage in Components

```typescript
import { useAuth } from '@/hooks/use-auth'

export function MyComponent() {
  const { user, token, isAuthenticated } = useAuth()
  
  // Use token for API calls
  const fetchData = async () => {
    const response = await fetch('/api/protected', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  }
  
  // Conditional rendering based on auth
  if (!isAuthenticated) {
    return <div>Please log in</div>
  }
  
  return <div>Welcome, {user?.username}</div>
}
```

### useLocalStorage - Persistent Local Storage

```typescript
import { useState, useEffect } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue)

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key)
      if (item) {
        setStoredValue(JSON.parse(item))
      }
    } catch (error) {
      console.error(error)
    }
  }, [key])

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      console.error(error)
    }
  }

  return [storedValue, setValue] as const
}
```

---

## File Organization

```
src/
├── app/                    # Next.js App Router pages
│   ├── (dashboard)/        # Dashboard layout group
│   └── api/                # API routes
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── vpn/                # VPN-related components
│   ├── pki/                # PKI management components
│   ├── settings/           # Settings components
│   └── ...                 # Feature-specific folders
├── lib/                    # Utility functions
├── hooks/                  # Custom React hooks
│   ├── use-auth.ts         # Authentication hook
│   ├── use-local-storage.ts
│   ├── use-mobile.ts
│   ├── use-toast.ts
│   └── use-csrf.ts
└── types/                  # TypeScript type definitions
```

---

## Component Naming Conventions

- **Page Components**: `EntityContent` (e.g., `UsersContent`, `CertificatesContent`)
- **Dialog Components**: Inline within page component or `EntityDialog`
- **Form Components**: `EntityForm` for reusable forms
- **List Components**: `EntityList` or inline table

---

This document should be updated as new patterns are established or existing patterns evolve.
