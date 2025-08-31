/**
 * Auth utility functions for making authenticated API requests
 */

import { useAuth } from '@clerk/nextjs'

/**
 * Get authenticated headers with Clerk JWT token
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  // This needs to be called from within a component that has access to Clerk context
  // We'll handle this in the API service functions instead
  return {
    'Content-Type': 'application/json'
  }
}

/**
 * Make an authenticated API request with Clerk JWT token
 */
export async function makeAuthenticatedRequest(
  url: string, 
  options: RequestInit = {},
  getToken?: () => Promise<string | null>
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>
  }

  // Add Authorization header if getToken function is provided
  if (getToken) {
    try {
      const token = await getToken()
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }
    } catch (error) {
      console.error('Failed to get auth token:', error)
    }
  }

  return fetch(url, {
    ...options,
    headers
  })
}
