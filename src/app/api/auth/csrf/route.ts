/**
 * CSRF Token API Route
 * 
 * GET: Generate and return a new CSRF token
 * - Sets token in httpOnly cookie for server-side validation
 * - Returns token in response body for client-side use in headers
 */

import { NextRequest, NextResponse } from 'next/server';
<<<<<<< HEAD
import { createCsrfToken, setCsrfCookie } from '@/lib/middleware/csrf';

export async function GET(request: NextRequest) {
  // Create new token
  const tokenData = await createCsrfToken(request);
=======
import {
  createCsrfToken,
  setCsrfCookie,
  refreshCsrfTokenIfNeeded,
  getCsrfTokenFromCookie,
} from '@/lib/middleware/csrf';

export async function GET(request: NextRequest) {
  // Check if we need to refresh an existing token
  const existingToken = getCsrfTokenFromCookie(request);
  
  let tokenData: { token: string; expiresAt: number };
  
  if (existingToken) {
    // Try to refresh if needed
    const refreshed = await refreshCsrfTokenIfNeeded(request);
    tokenData = refreshed || await createCsrfToken(request);
  } else {
    // Create new token
    tokenData = await createCsrfToken(request);
  }
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124

  // Create response with token
  const response = NextResponse.json({
    success: true,
    token: tokenData.token,
    expiresAt: tokenData.expiresAt,
    expiresIn: Math.floor((tokenData.expiresAt - Date.now()) / 1000),
  });

  // Set the CSRF token as an httpOnly cookie
  setCsrfCookie(response, tokenData.token, tokenData.expiresAt);

  return response;
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Allow': 'GET, OPTIONS',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}
