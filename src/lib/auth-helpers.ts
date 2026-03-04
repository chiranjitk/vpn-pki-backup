// Helper to get auth token from zustand persisted storage
export function getAuthToken(): string {
  if (typeof window === 'undefined') return ''
  
  try {
    const stored = localStorage.getItem('vpn-pki-auth')
    if (stored) {
      const data = JSON.parse(stored)
      return data?.state?.token || ''
    }
  } catch {
    // Ignore parsing errors
  }
  
  return ''
}

// Helper to create authorized fetch headers
export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  }
}

// Helper for authorized fetch
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken()
  const headers = new Headers(options.headers || {})
  
  headers.set('Content-Type', 'application/json')
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  
  return fetch(url, {
    ...options,
    headers,
  })
}
