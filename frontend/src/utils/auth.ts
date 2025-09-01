import { getSession, signIn } from 'next-auth/react'

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await getSession()
  
  // If there's no session, redirect to sign in
  if (!session) {
    console.warn('No session found. Redirecting to sign in.')
    await signIn('google', { callbackUrl: '/dashboard' })
    throw new Error('No authentication session. Please sign in.')
  }
  
  // If there's a refresh error, the user needs to sign in again
  if (session.error === "RefreshAccessTokenError") {
    console.warn('Access token refresh failed. Redirecting to sign in.')
    // Force sign in - this will redirect the user to the auth provider
    await signIn('google', { callbackUrl: '/dashboard' })
    throw new Error('Authentication expired. Please sign in again.')
  }
  
  if (session.accessToken) {
    return {
      'Authorization': `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    }
  }
  
  // For NextAuth, we can also pass the session user ID as fallback
  if (session.user?.id) {
    return {
      'X-User-ID': session.user.id,
      'X-User-Email': session.user.email || '',
      'Content-Type': 'application/json',
    }
  }
  
  // If we reach here, something is wrong with the session
  console.warn('Invalid session state. Redirecting to sign in.')
  await signIn('google', { callbackUrl: '/dashboard' })
  throw new Error('Invalid authentication session. Please sign in.')
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