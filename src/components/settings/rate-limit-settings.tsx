'use client'

import { useState, useEffect } from 'react'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
<<<<<<< HEAD
  Shield, Save, RefreshCw, AlertTriangle, Clock,
=======
  Shield, Save, RefreshCw, AlertTriangle, CheckCircle2, Clock,
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
} from 'lucide-react'
import { toast } from 'sonner'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  message: string
}

interface RateLimitSettings {
  login: RateLimitConfig
  certificate: RateLimitConfig
  api: RateLimitConfig
  passwordReset: RateLimitConfig
  vpn: RateLimitConfig
}

<<<<<<< HEAD
=======
interface RateLimitStatus {
  enabled: boolean
  settings: RateLimitSettings
}

>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
// Default values
const DEFAULT_SETTINGS: RateLimitSettings = {
  login: { windowMs: 60000, maxRequests: 5, message: 'Too many login attempts. Please try again later.' },
  certificate: { windowMs: 60000, maxRequests: 10, message: 'Too many certificate requests. Please wait before generating more certificates.' },
  api: { windowMs: 60000, maxRequests: 100, message: 'Too many requests. Please slow down.' },
  passwordReset: { windowMs: 3600000, maxRequests: 3, message: 'Too many password reset attempts. Please try again later.' },
  vpn: { windowMs: 60000, maxRequests: 120, message: 'Too many VPN operations. Please wait.' },
}

const CATEGORY_INFO: Record<string, { name: string; description: string; icon: string }> = {
  login: { name: 'Login', description: 'Authentication endpoints', icon: '🔐' },
  certificate: { name: 'Certificates', description: 'Certificate generation and PKI', icon: '📜' },
  api: { name: 'General API', description: 'All other API endpoints', icon: '🔌' },
  passwordReset: { name: 'Password Reset', description: 'Password recovery endpoints', icon: '🔑' },
  vpn: { name: 'VPN Operations', description: 'Real-time VPN monitoring', icon: '🌐' },
}

export function RateLimitSettings() {
  const [isLoading, setIsLoading] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [settings, setSettings] = useState<RateLimitSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/rate-limit')
      if (response.ok) {
        const data = await response.json()
        setEnabled(data.enabled ?? true)
        if (data.settings) {
          setSettings(data.settings)
        }
      }
    } catch (error) {
      console.error('Failed to fetch rate limit settings:', error)
    }
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/settings/rate-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, settings }),
      })
      if (!response.ok) throw new Error('Failed to save settings')
      toast.success('Rate limit settings saved successfully')
    } catch (error) {
      toast.error('Failed to save rate limit settings')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS)
    toast.info('Settings reset to defaults')
  }

<<<<<<< HEAD
  const updateCategory = (category: keyof RateLimitSettings, field: string, value: number) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
=======
  const updateCategory = (category: keyof RateLimitConfig, field: string, value: number) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category as keyof RateLimitSettings],
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
        [field]: value,
      },
    }))
  }

  const formatWindow = (ms: number) => {
    if (ms >= 3600000) return `${ms / 3600000}h`
    if (ms >= 60000) return `${ms / 60000}m`
    return `${ms / 1000}s`
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Rate Limiting Configuration
          </CardTitle>
          <CardDescription>
            Configure API rate limits to protect against abuse and ensure fair usage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Switch */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Rate Limiting</Label>
              <p className="text-sm text-muted-foreground">
                Protect API endpoints from excessive requests
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <Separator />

          {/* Rate Limit Categories Table */}
          <div className="space-y-4">
            <Label>Rate Limit Categories</Label>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Time Window</TableHead>
                    <TableHead>Max Requests</TableHead>
                    <TableHead>Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(Object.keys(settings) as Array<keyof RateLimitSettings>).map((key) => {
                    const config = settings[key]
                    const info = CATEGORY_INFO[key]
                    const rate = config.maxRequests / (config.windowMs / 60000)
                    
                    return (
                      <TableRow key={key}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{info.icon}</span>
                            <div>
                              <div className="font-medium">{info.name}</div>
                              <div className="text-xs text-muted-foreground">{info.description}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={config.windowMs / 60000}
                              onChange={(e) => updateCategory(key, 'windowMs', (parseInt(e.target.value) || 1) * 60000)}
                              className="w-20"
                              min={1}
                              disabled={!enabled}
                            />
                            <span className="text-sm text-muted-foreground">min</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={config.maxRequests}
                            onChange={(e) => updateCategory(key, 'maxRequests', parseInt(e.target.value) || 1)}
                            className="w-24"
                            min={1}
                            disabled={!enabled}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            ~{rate.toFixed(1)} req/min
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Info Box */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Important Notes
            </div>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>VPN monitoring requires higher limits for real-time dashboard updates</li>
              <li>Login and password reset should have strict limits for security</li>
              <li>Changes take effect immediately after saving</li>
              <li>Rate limits are per-IP address</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isLoading}>
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={isLoading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Rate Limits Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Active Rate Limits
          </CardTitle>
          <CardDescription>Summary of current rate limit configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {(Object.keys(settings) as Array<keyof RateLimitSettings>).map((key) => {
              const config = settings[key]
              const info = CATEGORY_INFO[key]
              
              return (
                <div key={key} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{info.icon}</span>
                    <span className="font-medium text-sm">{info.name}</span>
                  </div>
                  <div className="text-2xl font-bold">{config.maxRequests}</div>
                  <div className="text-xs text-muted-foreground">
                    requests per {formatWindow(config.windowMs)}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
