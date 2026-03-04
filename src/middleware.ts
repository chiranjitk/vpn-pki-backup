/**
<<<<<<< HEAD
 * Next.js Middleware - Simplified for Preview Compatibility
 */

import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next();
  
  // Basic security headers without restrictive CSP
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Allow iframe embedding for preview
  response.headers.set('Content-Security-Policy', "frame-ancestors *");
  
  return response;
}

export const config = {
  matcher: [
=======
 * Next.js Middleware - Security Layer
 * 
 * Applies:
 * - Rate limiting to all /api/* routes
 * - CSRF validation to mutation routes (POST, PUT, DELETE, PATCH)
 * - Security headers to all responses
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  checkRateLimit,
  addRateLimitHeaders,
  createRateLimitResponse,
  getRateLimitCategory,
} from '@/lib/middleware/rate-limit';
import {
  validateCsrfToken,
  requiresCsrfValidation,
  createCsrfErrorResponse,
  CSRF_COOKIE_NAME,
  createCsrfToken,
  setCsrfCookie,
} from '@/lib/middleware/csrf';

// Security headers configuration - development friendly
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// Content Security Policy - Development/Preview friendly configuration
// In production, you may want to restrict frame-ancestors further
const getCSPDirectives = (request: NextRequest): string => {
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-inline/eval needed for Next.js
    "style-src 'self' 'unsafe-inline'", // unsafe-inline needed for Tailwind
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:", // Allow API connections and WebSocket
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];
  
  // Allow iframe embedding from preview domains and localhost
  const host = request.headers.get('host') || '';
  const forwardedHost = request.headers.get('x-forwarded-host') || '';
  const isPreviewDomain = host.includes('.space.z.ai') || forwardedHost.includes('.space.z.ai');
  
  if (isPreviewDomain || process.env.NODE_ENV === 'development') {
    // Allow embedding in iframes for preview and development
    directives.push("frame-ancestors 'self' *.space.z.ai http://localhost:* https://localhost:*");
  } else {
    // Production: restrict to same origin only
    directives.push("frame-ancestors 'self'");
  }
  
  return directives.join('; ');
};

// Paths that should be excluded from CSRF validation
const CSRF_EXEMPT_PATHS = [
  '/api/auth/csrf', // CSRF token endpoint
  '/api/auth/login', // Login endpoint (no session yet)
  '/api/auth/logout', // Logout endpoint
  '/api/auth/2fa', // 2FA endpoints
  '/api/health', // Health check endpoints
  '/api/radius', // RADIUS config
  '/api/ldap', // LDAP config
  '/api/geo-restrictions', // Geo/IP restrictions
  '/api/guest-users', // Guest users
  '/api/vpn-sessions', // VPN sessions
  '/api/siem', // SIEM integration
  '/api/ocsp', // OCSP configuration
  '/api/vpn-user-mfa', // VPN user MFA
  '/api/smtp', // SMTP config
  '/api/backup', // Backup operations
  '/api/api-keys', // API keys
  '/api/certificates', // Certificate operations
  '/api/users', // User management
  '/api/pki', // PKI operations
  '/api/crl', // CRL operations
  '/api/csr', // CSR operations
  '/api/server-certificates', // Server certificates
  '/api/vpn', // VPN operations
  '/api/vpn-config', // VPN config
  '/api/email', // Email operations
  '/api/settings', // Settings endpoints (admin only)
];

// Paths that should be excluded from rate limiting
const RATE_LIMIT_EXEMPT_PATHS = [
  '/api/health',
  '/api/auth/csrf',
];

/**
 * Check if a path matches any exempt pattern
 */
function isPathExempt(pathname: string, exemptPaths: string[]): boolean {
  return exemptPaths.some(exemptPath => 
    pathname === exemptPath || pathname.startsWith(exemptPath + '/')
  );
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse, request: NextRequest): NextResponse {
  // Apply standard security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Apply Content Security Policy with dynamic frame-ancestors
  response.headers.set('Content-Security-Policy', getCSPDirectives(request));

  return response;
}

/**
 * Log middleware events
 */
function logMiddlewareEvent(
  event: string,
  request: NextRequest,
  details?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
  const method = request.method;
  const path = request.nextUrl.pathname;
  
  console.log(
    `[${timestamp}] [${event}] - IP: ${ip}, ${method} ${path}`,
    details ? JSON.stringify(details) : ''
  );
}

/**
 * Main middleware function
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith('/api');

  // For non-API routes, just apply security headers and continue
  if (!isApiRoute) {
    const response = NextResponse.next();
    return addSecurityHeaders(response, request);
  }

  // === Rate Limiting ===
  if (!isPathExempt(pathname, RATE_LIMIT_EXEMPT_PATHS)) {
    const category = getRateLimitCategory(pathname);
    const rateLimitResult = checkRateLimit(request, category);

    if (!rateLimitResult.success) {
      logMiddlewareEvent('RATE_LIMITED', request, {
        category,
        limit: rateLimitResult.limit,
        retryAfter: rateLimitResult.retryAfter,
      });
      
      const response = createRateLimitResponse(rateLimitResult, category);
      return addSecurityHeaders(response, request);
    }
  }

  // === CSRF Validation ===
  // Skip CSRF validation for exempt paths and safe methods
  if (
    requiresCsrfValidation(request.method) &&
    !isPathExempt(pathname, CSRF_EXEMPT_PATHS)
  ) {
    const validation = await validateCsrfToken(request);

    if (!validation.valid) {
      logMiddlewareEvent('CSRF_FAILED', request, {
        reason: validation.reason,
      });
      
      const response = createCsrfErrorResponse(validation.reason || 'Validation failed');
      return addSecurityHeaders(response, request);
    }
  }

  // === Special handling for CSRF token endpoint ===
  // Ensure CSRF token cookie is set for all requests
  const hasCsrfCookie = request.cookies.has(CSRF_COOKIE_NAME);
  
  // Continue with the request
  const response = NextResponse.next();

  // Add rate limit headers
  const category = getRateLimitCategory(pathname);
  const rateLimitResult = checkRateLimit(request, category);
  addRateLimitHeaders(response, rateLimitResult);

  // Auto-generate CSRF token if not present (for new sessions)
  if (!hasCsrfCookie && request.method === 'GET') {
    const tokenData = await createCsrfToken(request);
    setCsrfCookie(response, tokenData.token, tokenData.expiresAt);
  }

  return addSecurityHeaders(response, request);
}

/**
 * Middleware configuration
 * Run on all routes except static files and Next.js internals
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
