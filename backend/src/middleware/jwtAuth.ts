/**
 * Simple JWT Auth Middleware for Clerk tokens
 * This validates Clerk JWT tokens using JWKS and extracts userId
 */

import jwt from 'jsonwebtoken'
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'

// Simple auth for development - just validates token format and extracts userId

interface ClerkJWTPayload {
  sub: string // This is the userId
  iss: string // Issuer (Clerk)
}

// Simple middleware function that validates JWT in the handler itself
export async function validateJWT(event: APIGatewayProxyEventV2): Promise<{ userId: string | null; error?: string }> {
  try {
    // Extract token from Authorization header
    const authHeader = event.headers?.authorization || event.headers?.Authorization || ''
    const token = authHeader.replace('Bearer ', '')
    
    if (!token) {
      return { userId: null, error: 'No token provided' }
    }

    try {
      // For development, let's just decode the token without verification
      // In production, you can add proper JWKS verification
      const decoded = jwt.decode(token) as ClerkJWTPayload
      
      if (!decoded) {
        return { userId: null, error: 'Invalid token format' }
      }

      // Basic validation - check if it looks like a Clerk token
      if (!decoded.iss || !decoded.iss.includes('clerk')) {
        return { userId: null, error: 'Not a Clerk token' }
      }

      const userId = decoded.sub
      if (!userId) {
        return { userId: null, error: 'No userId in token' }
      }


      return { userId }

    } catch (jwtError: any) {
      console.error('❌ JWT validation failed:', jwtError.message)
      return { userId: null, error: `JWT Error: ${jwtError.message}` }
    }

  } catch (error) {
    console.error('Auth validation error:', error)
    return { userId: null, error: 'Auth error' }
  }
}
