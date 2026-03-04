/**
 * Client-side CSRF Hook
 * 
 * Provides automatic CSRF token management for API requests:
 * - Fetches and stores CSRF token
 * - Auto-includes token in mutation requests
 * - Handles token refresh when expired
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_URL = '/api/auth/csrf';

interface CsrfTokenData {
  token: string;
  expiresAt: number;
}

interface UseCsrfReturn {
  token: string | null;
  isLoading: boolean;
  error: string | null;
  refreshToken: () => Promise<string | null>;
  getHeaders: () => Record<string, string>;
  fetchWithCsrf: (url: string, options?: RequestInit) => Promise<Response>;
}

/**
 * Hook for managing CSRF tokens in client-side code
 */
export function useCsrf(): UseCsrfReturn {
  const [tokenData, setTokenData] = useState<CsrfTokenData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchInProgressRef = useRef(false);

  /**
   * Fetch a new CSRF token from the server
   */
  const fetchToken = useCallback(async (): Promise<CsrfTokenData | null> => {
    // Prevent concurrent token fetches
    if (fetchInProgressRef.current) {
      return null;
    }

    fetchInProgressRef.current = true;

    try {
      const response = await fetch(CSRF_TOKEN_URL, {
        method: 'GET',
        credentials: 'include', // Include cookies
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.token) {
        throw new Error('Invalid CSRF token response');
      }

      const newTokenData: CsrfTokenData = {
        token: data.token,
        expiresAt: data.expiresAt,
      };

      setTokenData(newTokenData);
      setError(null);
      setIsLoading(false);

      return newTokenData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setIsLoading(false);
      console.error('[CSRF] Token fetch error:', errorMessage);
      return null;
    } finally {
      fetchInProgressRef.current = false;
    }
  }, []);

  /**
   * Schedule token refresh before it expires
   */
  const scheduleRefresh = useCallback((expiresAt: number) => {
    // Clear any existing timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    const now = Date.now();
    const expiresIn = expiresAt - now;

    // Refresh 5 minutes before expiry, or immediately if already expired
    const refreshIn = Math.max(0, expiresIn - 5 * 60 * 1000);

    refreshTimeoutRef.current = setTimeout(() => {
      fetchToken();
    }, refreshIn);
  }, [fetchToken]);

  /**
   * Refresh the CSRF token
   */
  const refreshToken = useCallback(async (): Promise<string | null> => {
    const newTokenData = await fetchToken();
    return newTokenData?.token ?? null;
  }, [fetchToken]);

  /**
   * Get headers with CSRF token included
   */
  const getHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {};

    if (tokenData?.token) {
      headers[CSRF_HEADER_NAME] = tokenData.token;
    }

    return headers;
  }, [tokenData]);

  /**
   * Fetch wrapper that automatically includes CSRF token for mutation requests
   */
  const fetchWithCsrf = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const method = (options.method || 'GET').toUpperCase();
      const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

      // Merge headers
      const headers = new Headers(options.headers);

      // Add CSRF token for mutation requests
      if (isMutation && tokenData?.token) {
        headers.set(CSRF_HEADER_NAME, tokenData.token);
      }

      // Make the request
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Include cookies
      });

      // Handle CSRF token expiry (403 with CSRF error)
      if (response.status === 403 && isMutation) {
        const clonedResponse = response.clone();
        try {
          const errorData = await clonedResponse.json();
          
          if (errorData.reason?.includes('CSRF')) {
            // Token expired or invalid, refresh and retry once
            const newTokenData = await fetchToken();
            
            if (newTokenData) {
              headers.set(CSRF_HEADER_NAME, newTokenData.token);
              
              return fetch(url, {
                ...options,
                headers,
                credentials: 'include',
              });
            }
          }
        } catch {
          // Not a JSON error response, return original response
        }
      }

      return response;
    },
    [tokenData, fetchToken]
  );

  // Initial token fetch and refresh scheduling
  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  // Schedule refresh when token data changes
  useEffect(() => {
    if (tokenData) {
      scheduleRefresh(tokenData.expiresAt);
    }

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [tokenData, scheduleRefresh]);

  return {
    token: tokenData?.token ?? null,
    isLoading,
    error,
    refreshToken,
    getHeaders,
    fetchWithCsrf,
  };
}

/**
 * Higher-order function to wrap fetch with CSRF protection
 * Use this for one-off fetch calls outside of React components
 */
let globalCsrfToken: string | null = null;

export async function fetchWithGlobalCsrf(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
  const headers = new Headers(options.headers);

  // Fetch token if needed for mutation
  if (isMutation && !globalCsrfToken) {
    try {
      const response = await fetch(CSRF_TOKEN_URL, {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.token) {
          globalCsrfToken = data.token;
        }
      }
    } catch (error) {
      console.error('[CSRF] Failed to fetch token:', error);
    }
  }

  if (isMutation && globalCsrfToken) {
    headers.set(CSRF_HEADER_NAME, globalCsrfToken);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Handle CSRF token expiry
  if (response.status === 403 && isMutation) {
    const clonedResponse = response.clone();
    try {
      const errorData = await clonedResponse.json();
      
      if (errorData.reason?.includes('CSRF')) {
        // Refetch token and retry
        const tokenResponse = await fetch(CSRF_TOKEN_URL, {
          method: 'GET',
          credentials: 'include',
        });

        if (tokenResponse.ok) {
          const data = await tokenResponse.json();
          if (data.success && data.token) {
            globalCsrfToken = data.token;
            headers.set(CSRF_HEADER_NAME, globalCsrfToken);
            
            return fetch(url, {
              ...options,
              headers,
              credentials: 'include',
            });
          }
        }
      }
    } catch {
      // Not a JSON error response, return original response
    }
  }

  return response;
}

export default useCsrf;
