import { getSession } from 'next-auth/react'

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await getSession()
  
  if (session?.accessToken) {
    return {
      'Authorization': `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    }
  }
  
  // For NextAuth, we can also pass the session user ID
  if (session?.user?.id) {
    return {
      'X-User-ID': session.user.id,
      'X-User-Email': session.user.email || '',
      'Content-Type': 'application/json',
    }
  }
  
  return {
    'Content-Type': 'application/json',
  }
}

// Backwards compatibility - return session instead of token
export async function getToken() {
  const session = await getSession()
  return session?.accessToken || null
}

export async function makeAuthenticatedRequest(
  url: string, 
  options: RequestInit = {},
): Promise<Response> {
  const headers = await getAuthHeaders()
  
  return fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  })
}