/**
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
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
