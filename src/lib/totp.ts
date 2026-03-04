import { TOTP } from '@otplib/totp'
import { NobleCryptoPlugin } from '@otplib/plugin-crypto-noble'
import { ScureBase32Plugin } from '@otplib/plugin-base32-scure'

// Create TOTP instance with plugins
const crypto = new NobleCryptoPlugin()
const base32 = new ScureBase32Plugin()

/**
 * Generate a new random secret for TOTP
 */
export function generateSecret(): string {
  const totp = new TOTP({ crypto, base32 })
  return totp.generateSecret()
}

/**
 * Generate a TOTP code for a given secret
 */
export async function generateTOTP(secret: string): Promise<string> {
  const totp = new TOTP({ secret, crypto, base32 })
  return totp.generate()
}

/**
 * Verify a TOTP code against a secret
 * Returns true if valid, false otherwise
 */
export async function verifyTOTP(token: string, secret: string): Promise<boolean> {
  const totp = new TOTP({ secret, crypto, base32 })
  const result = await totp.verify(token, { epochTolerance: 30 })
  return result.valid
}

/**
 * Generate an otpauth:// URI for QR codes
 */
export function generateKeyURI(user: string, service: string, secret: string): string {
  const totp = new TOTP({
    secret,
    label: user,
    issuer: service,
    crypto,
    base32
  })
  return totp.toURI()
}

/**
 * Synchronous verification for backwards compatibility
 */
export function verifyTOTPSync(token: string, secret: string): boolean {
  const totp = new TOTP({ secret, crypto, base32 })
  // Use the synchronous verify
  const result = totp.verify(token, { epochTolerance: 30 })
  // Since verify returns a Promise, we need to handle this differently
  // For sync operation, we'll use a workaround
  return verifySyncInternal(token, secret)
}

// Internal sync verification using generate and compare
function verifySyncInternal(token: string, secret: string): boolean {
  // For sync verification, we check current and adjacent periods
  const period = 30
  const digits = 6
  const now = Math.floor(Date.now() / 1000)
  const tolerance = 1 // Check ±1 period (±30 seconds)
  
  for (let i = -tolerance; i <= tolerance; i++) {
    const counter = Math.floor((now + i * period) / period)
    const expectedToken = generateHOTP(secret, counter, digits)
    if (token === expectedToken) {
      return true
    }
  }
  return false
}

// Generate HOTP value for sync verification
function generateHOTP(secret: string, counter: number, digits: number): string {
  // Decode base32 secret
  const secretBytes = base32.decode(secret.toUpperCase())
  
  // Create counter buffer (8 bytes, big-endian)
  const counterBuffer = new ArrayBuffer(8)
  const counterView = new DataView(counterBuffer)
  counterView.setBigUint64(0, BigInt(counter), false)
  
  // Generate HMAC-SHA1
  const hmac = crypto.hmac(secretBytes, new Uint8Array(counterBuffer))
  
  // Dynamic truncation
  const offset = hmac[hmac.length - 1] & 0x0f
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % Math.pow(10, digits)
  
  return code.toString().padStart(digits, '0')
}

// Export authenticator-like interface for backwards compatibility
export const authenticator = {
  generateSecret,
  generate: generateTOTP,
  check: verifySyncInternal, // Sync version for backwards compatibility
  keyuri: generateKeyURI,
  verify: verifyTOTP,
}
