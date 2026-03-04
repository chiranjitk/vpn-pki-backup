'use client'

import { useState, useEffect } from 'react'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
<<<<<<< HEAD
=======
import { Switch } from '@/components/ui/switch'
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Shield, ShieldCheck, ShieldAlert, RefreshCw, Terminal, 
<<<<<<< HEAD
  AlertTriangle, Copy, Info
=======
  AlertTriangle, CheckCircle2, Copy, Play, Square, Info
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
} from 'lucide-react'
import { toast } from 'sonner'

interface FirewallStatus {
  enabled: boolean
  installed: boolean
  rules: string[]
  stats: {
    sshBlocked: number
    appBlocked: number
    vpnBlocked: number
    scanBlocked: number
  }
}

export function FirewallSettings() {
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<FirewallStatus | null>(null)
  const [sshPort, setSshPort] = useState('22')
  const [appPort, setAppPort] = useState('3000')
  const [sshRate, setSshRate] = useState('4')
  const [appRate, setAppRate] = useState('150')
  const [vpnRate, setVpnRate] = useState('100')

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/settings/firewall')
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
<<<<<<< HEAD
        if (data.config) {
          setSshPort(data.config.sshPort || '22')
          setAppPort(data.config.appPort || '3000')
          setSshRate(data.config.sshRate || '4')
          setAppRate(data.config.appRate || '150')
          setVpnRate(data.config.vpnRate || '100')
        }
=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
      }
    } catch (error) {
      console.error('Failed to fetch firewall status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const copyCommand = (command: string) => {
    navigator.clipboard.writeText(command)
    toast.success('Command copied to clipboard')
  }

  const commands = {
    install: `cd /opt/vpn-pki && sudo ./scripts/firewall-setup.sh install`,
    remove: `cd /opt/vpn-pki && sudo ./scripts/firewall-setup.sh remove`,
    status: `sudo ./scripts/firewall-setup.sh status`,
    save: `sudo ./scripts/firewall-setup.sh save`,
<<<<<<< HEAD
    customInstall: `sudo APP_PORT=${appPort} SSH_PORT=${sshPort} SSH_RATE=${sshRate} APP_RATE=${appRate} VPN_RATE=${vpnRate} ./scripts/firewall-setup.sh install`,
=======
    customInstall: `sudo APP_PORT=${appPort} SSH_PORT=${sshPort} ./scripts/firewall-setup.sh install`,
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            System Firewall (nftables)
          </CardTitle>
          <CardDescription>
            Kernel-level rate limiting and DDoS protection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Status */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              {status?.installed ? (
                status?.enabled ? (
                  <ShieldCheck className="h-8 w-8 text-green-500" />
                ) : (
                  <ShieldAlert className="h-8 w-8 text-yellow-500" />
                )
              ) : (
                <Shield className="h-8 w-8 text-muted-foreground" />
              )}
              <div>
                <div className="font-medium">
                  Firewall Status: {status?.installed ? (
                    status?.enabled ? (
                      <Badge className="ml-2 bg-green-500">ACTIVE</Badge>
                    ) : (
                      <Badge className="ml-2 bg-yellow-500" variant="outline">INSTALLED (Disabled)</Badge>
                    )
                  ) : (
                    <Badge className="ml-2" variant="outline">NOT INSTALLED</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {status?.installed 
                    ? 'Kernel-level protection is configured'
                    : 'Run the install command below to enable firewall rules'}
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchStatus} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Defense-in-Depth Security</AlertTitle>
            <AlertDescription>
              This firewall provides <strong>kernel-level protection</strong> that works alongside 
              the application-level rate limiting. It blocks malicious traffic before it reaches 
              your application.
            </AlertDescription>
          </Alert>

          {/* Protection Layers */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Terminal className="h-4 w-4 text-blue-500" />
                <span className="font-medium text-sm">SSH Brute Force</span>
              </div>
              <div className="text-2xl font-bold">{sshRate}</div>
              <div className="text-xs text-muted-foreground">attempts/min per IP</div>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-green-500" />
                <span className="font-medium text-sm">App Rate Limit</span>
              </div>
              <div className="text-2xl font-bold">{appRate}</div>
              <div className="text-xs text-muted-foreground">requests/min per IP</div>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-purple-500" />
                <span className="font-medium text-sm">VPN IKE/ESP</span>
              </div>
              <div className="text-2xl font-bold">{vpnRate}</div>
              <div className="text-xs text-muted-foreground">packets/min per IP</div>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                <span className="font-medium text-sm">Port Scan</span>
              </div>
              <div className="text-2xl font-bold">10</div>
              <div className="text-xs text-muted-foreground">ports/min threshold</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>Firewall Configuration</CardTitle>
          <CardDescription>Customize ports and rate limits before installing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
<<<<<<< HEAD
          <div className="grid gap-4 md:grid-cols-5">
=======
          <div className="grid gap-4 md:grid-cols-3">
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
            <div className="space-y-2">
              <Label htmlFor="ssh-port">SSH Port</Label>
              <Input 
                id="ssh-port" 
                value={sshPort} 
                onChange={(e) => setSshPort(e.target.value)}
                placeholder="22"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-port">Application Port</Label>
              <Input 
                id="app-port" 
                value={appPort} 
                onChange={(e) => setAppPort(e.target.value)}
                placeholder="3000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ssh-rate">SSH Rate (attempts/min)</Label>
              <Input 
                id="ssh-rate" 
                value={sshRate} 
                onChange={(e) => setSshRate(e.target.value)}
                placeholder="4"
              />
            </div>
<<<<<<< HEAD
            <div className="space-y-2">
              <Label htmlFor="app-rate">App Rate (req/min)</Label>
              <Input 
                id="app-rate" 
                value={appRate} 
                onChange={(e) => setAppRate(e.target.value)}
                placeholder="150"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vpn-rate">VPN Rate (pkts/min)</Label>
              <Input 
                id="vpn-rate" 
                value={vpnRate} 
                onChange={(e) => setVpnRate(e.target.value)}
                placeholder="100"
              />
            </div>
=======
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
          </div>

          <Separator />

          {/* Installation Commands */}
          <div className="space-y-4">
            <Label>Installation Commands</Label>
            <p className="text-sm text-muted-foreground">
              Run these commands on your server terminal (requires sudo access):
            </p>

            {/* Install Command */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-600">Install Firewall Rules:</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => copyCommand(commands.customInstall)}
                >
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
              </div>
              <div className="p-3 rounded-lg bg-muted font-mono text-sm overflow-x-auto">
                {commands.customInstall}
              </div>
            </div>

            {/* Status Command */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-600">Check Status:</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => copyCommand(commands.status)}
                >
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
              </div>
              <div className="p-3 rounded-lg bg-muted font-mono text-sm overflow-x-auto">
                {commands.status}
              </div>
            </div>

            {/* Save Command */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-purple-600">Make Permanent (survive reboot):</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => copyCommand(commands.save)}
                >
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
              </div>
              <div className="p-3 rounded-lg bg-muted font-mono text-sm overflow-x-auto">
                {commands.save}
              </div>
            </div>

            {/* Remove Command */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-red-600">Remove Firewall Rules:</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => copyCommand(commands.remove)}
                >
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
              </div>
              <div className="p-3 rounded-lg bg-muted font-mono text-sm overflow-x-auto">
                {commands.remove}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How It Works Card */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
          <CardDescription>Understanding the two-layer defense system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-lg border-l-4 border-l-green-500 bg-green-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="h-5 w-5 text-green-500" />
                  <span className="font-medium">Layer 1: Firewall (nftables)</span>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Kernel-level packet filtering</li>
                  <li>• Blocks traffic before reaching app</li>
                  <li>• Lower resource usage</li>
                  <li>• DDoS protection</li>
                  <li>• Port scan detection</li>
                </ul>
              </div>
              
              <div className="p-4 rounded-lg border-l-4 border-l-blue-500 bg-blue-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-5 w-5 text-blue-500" />
                  <span className="font-medium">Layer 2: Application (Middleware)</span>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Per-endpoint rate limits</li>
                  <li>• Session-aware limiting</li>
                  <li>• Custom error messages</li>
                  <li>• Configurable via GUI</li>
                  <li>• Audit logging</li>
                </ul>
              </div>
            </div>

            <Alert className="bg-amber-500/10 border-amber-500/20">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertTitle>Important Security Note</AlertTitle>
              <AlertDescription>
                After installing firewall rules, make sure to save them with the <code className="bg-muted px-1 rounded">save</code> command 
                to ensure they persist after a server reboot.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
