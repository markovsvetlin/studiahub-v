import { APIGatewayProxyEventV2 } from 'aws-lambda'

interface NextAuthUser {
  id: string
  email: string
  name: string
}

/**
 * Middleware to validate NextAuth session
 * Since NextAuth runs on the frontend, we'll expect user info in headers
 */
export async function validateNextAuthSession(event: APIGatewayProxyEventV2): Promise<{ userId: string | null; user?: NextAuthUser; error?: string }> {
  try {
    // For NextAuth, we can receive user info via headers or JWT token
    const authHeader = event.headers?.authorization || event.headers?.Authorization
    const userIdHeader = event.headers?.[`x-user-id`] || event.headers?.[`X-User-ID`]
    const userEmailHeader = event.headers?.[`x-user-email`] || event.headers?.[`X-User-Email`]
    
    // If we have a JWT token (Google access token), validate it
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      
      try {
        // Validate Google token by making a request to Google
        const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`)
        
        if (response.ok) {
          const tokenInfo = await response.json()
          
          return {
            userId: tokenInfo.user_id || tokenInfo.sub,
            user: {
              id: tokenInfo.user_id || tokenInfo.sub,
              email: tokenInfo.email,
              name: tokenInfo.name || tokenInfo.email
            }
          }
        }
      } catch (tokenError) {
        console.log('Token validation failed, trying header approach...', tokenError)
      }
    }
    
    // Fallback: use headers (simpler approach for development)
    if (userIdHeader && userEmailHeader) {
      return {
        userId: userIdHeader,
        user: {
          id: userIdHeader,
          email: userEmailHeader,
          name: userEmailHeader.split('@')[0]
        }
      }
    }
    
    // No authentication found
    return { userId: null, error: 'No authentication provided' }
    
  } catch (error) {
    console.error('NextAuth session validation error:', error)
    return { userId: null, error: 'Authentication validation failed' }
  }
}

/**
 * Backwards compatibility wrapper that mimics the Clerk JWT validation
 */
export async function validateJWT(event: APIGatewayProxyEventV2): Promise<{ userId: string | null; error?: string }> {
  const result = await validateNextAuthSession(event)
  return {
    userId: result.userId,
    error: result.error
  }
}
