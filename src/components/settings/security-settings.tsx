'use client'

import { useState, useEffect } from 'react'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Shield, KeyRound, AlertTriangle, CheckCircle2, Smartphone, QrCode, Loader2, Fingerprint, Activity, Search, Server,
} from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'
import { getAuthToken } from '@/lib/auth-helpers'

interface TwoFactorStatus {
  twoFactorEnabled: boolean
  hasSecret: boolean
  email: string
}

interface OcspStatus {
  isRunning: boolean
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  lastRequest: string | null
}

export function SecuritySettings() {
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [showSetupDialog, setShowSetupDialog] = useState(false)
  const [showDisableDialog, setShowDisableDialog] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [setupLoading, setSetupLoading] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [disableLoading, setDisableLoading] = useState(false)
  const [disableCode, setDisableCode] = useState('')

  const [ocspStatus, setOcspStatus] = useState<OcspStatus | null>(null)
  const [loadingOcsp, setLoadingOcsp] = useState(true)
  const [checkSerial, setCheckSerial] = useState('')
  const [checkingCert, setCheckingCert] = useState(false)
  const [certStatus, setCertStatus] = useState<{ status: string; serialNumber: string } | null>(null)

  useEffect(() => {
    fetchTwoFactorStatus()
    fetchOcspStatus()
  }, [])

  const getToken = getAuthToken

  const fetchTwoFactorStatus = async () => {
    setLoadingStatus(true)
    try {
      const response = await fetch('/api/auth/2fa/status', {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (response.ok) {
        const data = await response.json()
        setTwoFactorStatus(data)
      }
    } catch (error) {
      console.error('Failed to fetch 2FA status:', error)
    } finally {
      setLoadingStatus(false)
    }
  }

  const fetchOcspStatus = async () => {
    setLoadingOcsp(true)
    try {
      const response = await fetch('/api/ocsp/status')
      if (response.ok) {
        const data = await response.json()
        setOcspStatus(data)
      }
    } catch (error) {
      console.error('Failed to fetch OCSP status:', error)
    } finally {
      setLoadingOcsp(false)
    }
  }

  const handleSetup2FA = async () => {
    setSetupLoading(true)
    try {
      const response = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (response.ok) {
        const data = await response.json()
        setQrCode(data.qrCode)
        setSecret(data.secret)
        setShowSetupDialog(true)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to setup 2FA')
      }
    } catch (error) {
      toast.error('Failed to setup 2FA')
    } finally {
      setSetupLoading(false)
    }
  }

  const handleVerify2FA = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      toast.error('Please enter a 6-digit code')
      return
    }
    setVerifyLoading(true)
    try {
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ code: verifyCode, enableTwoFactor: true }),
      })
      if (response.ok) {
        toast.success('Two-factor authentication enabled successfully')
        setShowSetupDialog(false)
        setVerifyCode('')
        setQrCode(null)
        setSecret(null)
        fetchTwoFactorStatus()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Invalid verification code')
      }
    } catch (error) {
      toast.error('Failed to verify code')
    } finally {
      setVerifyLoading(false)
    }
  }

  const handleDisable2FA = async () => {
    if (!disableCode || disableCode.length !== 6) {
      toast.error('Please enter a 6-digit code')
      return
    }
    setDisableLoading(true)
    try {
      const response = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ code: disableCode }),
      })
      if (response.ok) {
        toast.success('Two-factor authentication disabled')
        setShowDisableDialog(false)
        setDisableCode('')
        fetchTwoFactorStatus()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to disable 2FA')
      }
    } catch (error) {
      toast.error('Failed to disable 2FA')
    } finally {
      setDisableLoading(false)
    }
  }

  const handleCheckCertificate = async () => {
    if (!checkSerial) {
      toast.error('Please enter a serial number')
      return
    }
    setCheckingCert(true)
    setCertStatus(null)
    try {
      const response = await fetch('/api/ocsp/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-certificate', serialNumber: checkSerial }),
      })
      if (response.ok) {
        const data = await response.json()
        setCertStatus(data)
      } else {
        toast.error('Failed to check certificate')
      }
    } catch (error) {
      toast.error('Failed to check certificate')
    } finally {
      setCheckingCert(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Two-Factor Authentication Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Two-Factor Authentication (2FA)
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account using TOTP authenticator apps
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loadingStatus ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    {twoFactorStatus?.twoFactorEnabled
                      ? '2FA is currently enabled for your account'
                      : 'Protect your account with an authenticator app'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {twoFactorStatus?.twoFactorEnabled ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="text-sm font-medium text-green-600">Enabled</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      <span className="text-sm font-medium text-amber-600">Disabled</span>
                    </>
                  )}
                </div>
              </div>

              <Alert>
                <KeyRound className="h-4 w-4" />
                <AlertTitle>How it works</AlertTitle>
                <AlertDescription>
                  When enabled, you&apos;ll need to enter a code from your authenticator app 
                  in addition to your password when logging in.
                </AlertDescription>
              </Alert>

              <Separator />

              <div className="flex gap-2">
                {twoFactorStatus?.twoFactorEnabled ? (
                  <Button variant="destructive" onClick={() => setShowDisableDialog(true)}>
                    Disable 2FA
                  </Button>
                ) : (
                  <Button onClick={handleSetup2FA} disabled={setupLoading}>
                    {setupLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Setting up...
                      </>
                    ) : (
                      <>
                        <QrCode className="mr-2 h-4 w-4" />
                        Setup 2FA
                      </>
                    )}
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* OCSP Responder Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            OCSP Responder
          </CardTitle>
          <CardDescription>
            Online Certificate Status Protocol responder for real-time certificate validation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">OCSP Responder Status</Label>
              <p className="text-sm text-muted-foreground">
                {loadingOcsp ? 'Checking status...' : 
                  ocspStatus?.isRunning ? 'OCSP responder is running' : 'OCSP responder is not running'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {loadingOcsp ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : ocspStatus?.isRunning ? (
                <>
                  <Activity className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium text-green-600">Running</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <span className="text-sm font-medium text-red-600">Stopped</span>
                </>
              )}
            </div>
          </div>

          {ocspStatus?.isRunning && (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 border rounded-lg">
                <p className="text-2xl font-bold">{ocspStatus.totalRequests}</p>
                <p className="text-xs text-muted-foreground">Total Requests</p>
              </div>
              <div className="p-3 border rounded-lg">
                <p className="text-2xl font-bold text-green-600">{ocspStatus.successfulRequests}</p>
                <p className="text-xs text-muted-foreground">Successful</p>
              </div>
              <div className="p-3 border rounded-lg">
                <p className="text-2xl font-bold text-red-600">{ocspStatus.failedRequests}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          )}

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium">Check Certificate Status</h4>
            <div className="flex gap-2">
              <Input
                placeholder="Enter certificate serial number"
                value={checkSerial}
                onChange={(e) => setCheckSerial(e.target.value)}
              />
              <Button variant="outline" onClick={handleCheckCertificate} disabled={checkingCert}>
                {checkingCert ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Check
              </Button>
            </div>
            
            {certStatus && (
              <Alert variant={certStatus.status === 'GOOD' ? 'default' : 'destructive'}>
                {certStatus.status === 'GOOD' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <AlertTitle>Certificate Status: {certStatus.status}</AlertTitle>
                <AlertDescription>Serial: {certStatus.serialNumber}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Setup 2FA Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Setup Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              Scan this QR code with your authenticator app, then enter the 6-digit code to verify.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {qrCode && (
              <div className="flex justify-center">
                <Image src={qrCode} alt="2FA QR Code" width={200} height={200} className="border rounded-lg" />
              </div>
            )}
            {secret && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Manual entry code:</p>
                <code className="text-sm bg-muted px-2 py-1 rounded font-mono">{secret}</code>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="verify-code">Verification Code</Label>
              <Input
                id="verify-code"
                placeholder="Enter 6-digit code"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="text-center text-2xl tracking-widest"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetupDialog(false)}>Cancel</Button>
            <Button onClick={handleVerify2FA} disabled={verifyLoading || verifyCode.length !== 6}>
              {verifyLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : 'Verify & Enable'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable 2FA Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Disable Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              Enter your current 2FA code to disable two-factor authentication.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                Disabling 2FA reduces your account security.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="disable-code">Verification Code</Label>
              <Input
                id="disable-code"
                placeholder="Enter 6-digit code"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="text-center text-2xl tracking-widest"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisableDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDisable2FA} disabled={disableLoading || disableCode.length !== 6}>
              {disableLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disabling...
                </>
              ) : 'Disable 2FA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
