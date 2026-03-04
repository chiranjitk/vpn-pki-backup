'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Activity,
  Network,
  Globe,
  Scan,
  Loader2,
  Terminal,
  Play,
  Copy,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'

type ToolType = 'ping' | 'traceroute' | 'dns' | 'port'

interface DiagnosticResult {
  success: boolean
  output: string
  error?: string
  duration?: number
}

export function DiagnosticsContent() {
  const [activeTool, setActiveTool] = useState<ToolType>('ping')
  const [target, setTarget] = useState('')
  const [port, setPort] = useState('80')
  const [dnsType, setDnsType] = useState('A')
  const [pingCount, setPingCount] = useState('4')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<DiagnosticResult | null>(null)
  const [copied, setCopied] = useState(false)

  const runDiagnostic = async () => {
    if (!target.trim()) {
      toast.error('Please enter a target host or IP')
      return
    }

    if (activeTool === 'port' && !port.trim()) {
      toast.error('Please enter a port number')
      return
    }

    setRunning(true)
    setResult(null)

    try {
      const response = await fetch('/api/network/diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: activeTool,
          target: target.trim(),
          options: {
            port: activeTool === 'port' ? parseInt(port) : undefined,
            dnsType: activeTool === 'dns' ? dnsType : undefined,
            count: activeTool === 'ping' ? parseInt(pingCount) : undefined,
          },
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setResult(data)
      } else {
        setResult({
          success: false,
          output: '',
          error: data.error || 'Diagnostic failed',
        })
      }
    } catch {
      setResult({
        success: false,
        output: '',
        error: 'Failed to run diagnostic',
      })
    } finally {
      setRunning(false)
    }
  }

  const copyToClipboard = async () => {
    if (result?.output) {
      await navigator.clipboard.writeText(result.output)
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const tools = [
    { id: 'ping' as ToolType, label: 'Ping', icon: Activity },
    { id: 'traceroute' as ToolType, label: 'Traceroute', icon: Network },
    { id: 'dns' as ToolType, label: 'DNS Lookup', icon: Globe },
    { id: 'port' as ToolType, label: 'Port Scanner', icon: Scan },
  ]

  const getPlaceholder = () => {
    switch (activeTool) {
      case 'ping':
        return 'e.g., 8.8.8.8 or google.com'
      case 'traceroute':
        return 'e.g., 8.8.8.8 or google.com'
      case 'dns':
        return 'e.g., google.com or 8.8.8.8'
      case 'port':
        return 'e.g., 192.168.1.1 or example.com'
      default:
        return 'Enter target'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Terminal className="h-6 w-6" />
            Network Diagnostics
          </h2>
          <p className="text-muted-foreground">
            Ping, traceroute, DNS lookup, and port scanner tools
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tool Selection */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Select Tool</CardTitle>
            <CardDescription>Choose a diagnostic tool to run</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {tools.map((tool) => (
              <Button
                key={tool.id}
                variant={activeTool === tool.id ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => {
                  setActiveTool(tool.id)
                  setResult(null)
                }}
              >
                <tool.icon className="h-4 w-4 mr-2" />
                {tool.label}
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Tool Configuration and Results */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {tools.find((t) => t.id === activeTool)?.icon && (
                <span>
                  {(() => {
                    const ToolIcon =
                      tools.find((t) => t.id === activeTool)?.icon || Activity
                    return <ToolIcon className="h-4 w-4" />
                  })()}
                </span>
              )}
              {tools.find((t) => t.id === activeTool)?.label}
            </CardTitle>
            <CardDescription>
              {activeTool === 'ping' &&
                'Test reachability and measure round-trip time'}
              {activeTool === 'traceroute' &&
                'Trace the path packets take to a destination'}
              {activeTool === 'dns' &&
                'Query DNS records for a domain or IP'}
              {activeTool === 'port' &&
                'Check if a specific port is open on a host'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Target Input */}
            <div className="space-y-2">
              <Label htmlFor="target">Target Host / IP</Label>
              <Input
                id="target"
                placeholder={getPlaceholder()}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runDiagnostic()}
              />
            </div>

            {/* Tool-specific options */}
            {activeTool === 'ping' && (
              <div className="space-y-2">
                <Label htmlFor="pingCount">Ping Count</Label>
                <Select value={pingCount} onValueChange={setPingCount}>
                  <SelectTrigger id="pingCount" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 packet</SelectItem>
                    <SelectItem value="4">4 packets</SelectItem>
                    <SelectItem value="10">10 packets</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {activeTool === 'dns' && (
              <div className="space-y-2">
                <Label htmlFor="dnsType">Record Type</Label>
                <Select value={dnsType} onValueChange={setDnsType}>
                  <SelectTrigger id="dnsType" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A (IPv4)</SelectItem>
                    <SelectItem value="AAAA">AAAA (IPv6)</SelectItem>
                    <SelectItem value="MX">MX (Mail)</SelectItem>
                    <SelectItem value="NS">NS (Nameserver)</SelectItem>
                    <SelectItem value="TXT">TXT (Text)</SelectItem>
                    <SelectItem value="CNAME">CNAME</SelectItem>
                    <SelectItem value="SOA">SOA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {activeTool === 'port' && (
              <div className="space-y-2">
                <Label htmlFor="port">Port Number</Label>
                <Input
                  id="port"
                  type="number"
                  min={1}
                  max={65535}
                  placeholder="80"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="w-32"
                />
                <div className="flex gap-2 mt-2">
                  <Badge
                    variant="outline"
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => setPort('22')}
                  >
                    SSH (22)
                  </Badge>
                  <Badge
                    variant="outline"
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => setPort('80')}
                  >
                    HTTP (80)
                  </Badge>
                  <Badge
                    variant="outline"
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => setPort('443')}
                  >
                    HTTPS (443)
                  </Badge>
                </div>
              </div>
            )}

            {/* Run Button */}
            <Button
              onClick={runDiagnostic}
              disabled={running || !target.trim()}
              className="w-full"
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run {tools.find((t) => t.id === activeTool)?.label}
                </>
              )}
            </Button>

            {/* Results */}
            {result && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={result.success ? 'default' : 'destructive'}>
                      {result.success ? 'Success' : 'Failed'}
                    </Badge>
                    {result.duration && (
                      <span className="text-sm text-muted-foreground">
                        Completed in {result.duration}ms
                      </span>
                    )}
                  </div>
                  {result.output && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyToClipboard}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 mr-1" />
                      ) : (
                        <Copy className="h-4 w-4 mr-1" />
                      )}
                      Copy
                    </Button>
                  )}
                </div>

                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg text-sm font-mono overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-all">
                    {result.error || result.output}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Info Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Ping
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Uses ICMP echo requests to test if a host is reachable and measures
            latency.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Network className="h-4 w-4" />
              Traceroute
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Displays the route packets take to reach a destination, showing each
            hop along the way.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="h-4 w-4" />
              DNS Lookup
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Queries DNS servers to retrieve records like A, AAAA, MX, NS, and
            TXT for domains.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Scan className="h-4 w-4" />
              Port Scanner
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Tests if a specific TCP port is open on a remote host using netcat.
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
