/**
 * CSRF Protection - Simplified for Edge Runtime
 */

import { NextRequest, NextResponse } from 'next/server';

export const CSRF_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';
export const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000;

interface CsrfTokenEntry {
  token: string;
  createdAt: number;
  expiresAt: number;
}

const tokenStore = new Map<string, CsrfTokenEntry>();

// Cleanup expired tokens every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of tokenStore.entries()) {
      if (entry.expiresAt < now) tokenStore.delete(key);
    }
  }, 10 * 60 * 1000);
}

async function generateToken(): Promise<string> {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSessionId(request: NextRequest): Promise<string> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const ua = request.headers.get('user-agent') || 'unknown';
  const encoder = new TextEncoder();
  const data = encoder.encode(`${ip}:${ua}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

export async function generateCsrfToken(): Promise<string> {
  return generateToken();
}

export async function createCsrfToken(request: NextRequest): Promise<{ token: string; expiresAt: number }> {
  const sessionId = await getSessionId(request);
  const token = await generateToken();
  const now = Date.now();
  const expiresAt = now + CSRF_TOKEN_EXPIRY;
  tokenStore.set(sessionId, { token, createdAt: now, expiresAt });
  return { token, expiresAt };
}

export async function validateCsrfToken(request: NextRequest, token?: string): Promise<{ valid: boolean; reason?: string }> {
  const sessionId = await getSessionId(request);
  const entry = tokenStore.get(sessionId);
  
  if (!entry) return { valid: false, reason: 'No CSRF token found for session' };
  if (entry.expiresAt < Date.now()) {
    tokenStore.delete(sessionId);
    return { valid: false, reason: 'CSRF token expired' };
  }
  
  const provided = token || request.headers.get(CSRF_HEADER_NAME) || request.headers.get('x-xsrf-token');
  if (!provided) return { valid: false, reason: 'CSRF token not provided' };
  
  if (provided.length !== entry.token.length) return { valid: false, reason: 'Invalid CSRF token' };
  
  // Constant-time comparison
  let result = 0;
  for (let i = 0; i < provided.length; i++) {
    result |= provided.charCodeAt(i) ^ entry.token.charCodeAt(i);
  }
  
  return result === 0 ? { valid: true } : { valid: false, reason: 'Invalid CSRF token' };
}

export function requiresCsrfValidation(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method.toUpperCase());
}

export function createCsrfErrorResponse(reason: string): NextResponse {
  return NextResponse.json(
    { error: 'Forbidden', message: 'CSRF validation failed. Please refresh the page and try again.', reason },
    { status: 403 }
  );
}

export function setCsrfCookie(response: NextResponse, token: string, expiresAt: number): void {
  const maxAge = Math.floor((expiresAt - Date.now()) / 1000);
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge,
  });
}

export function withCsrfProtection(
  handler: (request: NextRequest) => Promise<NextResponse> | NextResponse,
  options?: { skipValidation?: boolean }
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    if (!requiresCsrfValidation(request.method) || options?.skipValidation) {
      return handler(request);
    }
    const validation = await validateCsrfToken(request);
    if (!validation.valid) {
      return createCsrfErrorResponse(validation.reason || 'Validation failed');
    }
    return handler(request);
  };
}

export { tokenStore as csrfTokenStore };
<<<<<<< HEAD
=======

/**
 * Get CSRF token from cookie
 */
export function getCsrfTokenFromCookie(request: NextRequest): string | null {
  return request.cookies.get(CSRF_COOKIE_NAME)?.value || null;
}

/**
 * Refresh CSRF token if it's about to expire (within 10 minutes)
 */
export async function refreshCsrfTokenIfNeeded(request: NextRequest): Promise<{ token: string; expiresAt: number } | null> {
  const sessionId = await getSessionId(request);
  const entry = tokenStore.get(sessionId);
  
  if (!entry) return null;
  
  // If token expires in less than 10 minutes, refresh it
  const tenMinutes = 10 * 60 * 1000;
  if (entry.expiresAt - Date.now() < tenMinutes) {
    return null; // Let caller create new token
  }
  
  return { token: entry.token, expiresAt: entry.expiresAt };
}
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
