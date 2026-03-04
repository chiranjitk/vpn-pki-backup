/**
 * Rate Limiting Middleware
 * 
 * Implements configurable rate limiting using an in-memory store with TTL cleanup.
 * Can be upgraded to Redis for distributed deployments.
 */

import { NextRequest, NextResponse } from 'next/server';

// Rate limit configuration per endpoint type
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Custom error message
}

// Default rate limit configurations
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // Authentication endpoints - strict limits
  login: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    message: 'Too many login attempts. Please try again later.',
  },
  // Certificate generation - moderate limits
  certificate: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: 'Too many certificate requests. Please wait before generating more certificates.',
  },
  // General API endpoints
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    message: 'Too many requests. Please slow down.',
  },
  // Password reset - very strict
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    message: 'Too many password reset attempts. Please try again later.',
  },
  // VPN operations - higher limits for real-time monitoring
  vpn: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 120, // Allow 120 requests/min for real-time dashboard updates
    message: 'Too many VPN operations. Please wait.',
  },
};

// Entry in the rate limit store
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
class RateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Run cleanup every minute
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  get(key: string): RateLimitEntry | undefined {
    return this.store.get(key);
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry);
  }

  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.resetTime < now) {
      // Create new entry
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + windowMs,
      };
      this.store.set(key, newEntry);
      return { count: 1, resetTime: newEntry.resetTime };
    }

    // Increment existing entry
    entry.count++;
    this.store.set(key, entry);
    return { count: entry.count, resetTime: entry.resetTime };
  }

  // Clean up resources (for testing or shutdown)
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

// Singleton store instance
const rateLimitStore = new RateLimitStore();

// Determine the rate limit category based on the request path
export function getRateLimitCategory(pathname: string): string {
  if (pathname.includes('/auth/login') || pathname.includes('/auth/verify')) {
    return 'login';
  }
  if (pathname.includes('/auth/password-reset') || pathname.includes('/auth/forgot-password')) {
    return 'passwordReset';
  }
  if (pathname.includes('/certificates') || pathname.includes('/pki')) {
    return 'certificate';
  }
  if (pathname.includes('/vpn')) {
    return 'vpn';
  }
  return 'api';
}

// Get client identifier (IP address or forwarded header)
function getClientIdentifier(request: NextRequest): string {
  // Check for X-Forwarded-For header (common in reverse proxy setups)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP in the chain (original client)
    return forwardedFor.split(',')[0].trim();
  }

  // Check for X-Real-IP header (used by some proxies)
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fall back to a default identifier
  // In production, you might want to use request.ip if available
  return 'unknown';
}

// Log rate limit violation
function logRateLimitViolation(
  clientId: string,
  path: string,
  limit: number,
  windowMs: number
): void {
  const timestamp = new Date().toISOString();
  console.warn(
    `[${timestamp}] RATE LIMIT VIOLATION - Client: ${clientId}, Path: ${path}, ` +
    `Limit: ${limit} requests per ${windowMs / 1000}s`
  );
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

/**
 * Check rate limit for a request
 * Returns result with headers to add to response
 */
export function checkRateLimit(
  request: NextRequest,
  category?: string
): RateLimitResult {
  const pathname = request.nextUrl.pathname;
  const determinedCategory = category || getRateLimitCategory(pathname);
  const config = RATE_LIMIT_CONFIGS[determinedCategory] || RATE_LIMIT_CONFIGS.api;

  const clientId = getClientIdentifier(request);
  const key = `${determinedCategory}:${clientId}`;

  const { count, resetTime } = rateLimitStore.increment(key, config.windowMs);
  const remaining = Math.max(0, config.maxRequests - count);

  if (count > config.maxRequests) {
    logRateLimitViolation(clientId, pathname, config.maxRequests, config.windowMs);
    
    return {
      success: false,
      limit: config.maxRequests,
      remaining: 0,
      reset: resetTime,
      retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
    };
  }

  return {
    success: true,
    limit: config.maxRequests,
    remaining,
    reset: resetTime,
  };
}

/**
 * Apply rate limiting headers to response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', result.reset.toString());

  if (result.retryAfter) {
    response.headers.set('Retry-After', result.retryAfter.toString());
  }

  return response;
}

/**
 * Create rate limit exceeded response
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  category: string
): NextResponse {
  const config = RATE_LIMIT_CONFIGS[category] || RATE_LIMIT_CONFIGS.api;
  
  const response = NextResponse.json(
    {
      error: 'Too Many Requests',
      message: config.message || 'Rate limit exceeded. Please try again later.',
      retryAfter: result.retryAfter,
    },
    { status: 429 }
  );

  addRateLimitHeaders(response, result);
  return response;
}

/**
 * Rate limiting middleware wrapper
 */
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse> | NextResponse,
  category?: string
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    const determinedCategory = category || getRateLimitCategory(request.nextUrl.pathname);
    const result = checkRateLimit(request, determinedCategory);

    if (!result.success) {
      return createRateLimitResponse(result, determinedCategory);
    }

    const response = await handler(request);
    addRateLimitHeaders(response, result);
    return response;
  };
}

// Export the store for testing purposes
export { rateLimitStore };
