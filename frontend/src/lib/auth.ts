import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile",
          access_type: "offline",
          prompt: "consent",
        },
      },
    })
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // Add user info to JWT token
      if (user) {
        token.userId = user.id
        token.email = user.email
        token.name = user.name
        token.image = user.image
      }
      
      // Add tokens from Google OAuth
      if (account) {
        token.accessToken = account.access_token || ''
        token.refreshToken = account.refresh_token
        token.accessTokenExpires = account.expires_at! * 1000 // Convert to milliseconds
      }

      // If access token is still valid, return existing token
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
        return token
      }

      // Access token has expired, try to refresh it
      if (token.refreshToken) {
        try {
          const refreshedTokens = await refreshAccessToken(token.refreshToken)
          return {
            ...token,
            accessToken: refreshedTokens.access_token,
            accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
            refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Keep old refresh token if none returned
          }
        } catch (error) {
          console.error('Error refreshing access token:', error)
          // Return token with error flag so we can handle this in the session callback
          return {
            ...token,
            error: "RefreshAccessTokenError"
          }
        }
      }
      
      return token
    },
    async session({ session, token }) {
      // Send properties to the client
      if (session.user) {
        session.user.id = token.userId as string
        session.user.email = token.email as string
        session.user.name = token.name as string
        session.user.image = token.image as string
      }
      
      // Add access token to session
      session.accessToken = token.accessToken as string
      session.error = token.error as string | undefined
      
      return session
    },
    async redirect({ url, baseUrl }) {
      // Redirect to dashboard after successful login
      if (url.startsWith('/dashboard') || url.startsWith(baseUrl + '/dashboard')) {
        return '/dashboard'
      }
      // Allow relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`
      // Allow callback URLs on the same origin
      if (new URL(url).origin === baseUrl) return url
      return baseUrl + '/dashboard'
    }
  },
  pages: {
    // Don't use custom pages - let NextAuth handle everything
    signIn: undefined,
    signOut: undefined,
    error: undefined
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 // 30 days
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}

/**
 * Refresh the Google access token using the refresh token
 */
async function refreshAccessToken(refreshToken: string) {
  try {
    const url = 'https://oauth2.googleapis.com/token'
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      })
    })

    const refreshedTokens = await response.json()

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}, message: ${refreshedTokens.error_description || refreshedTokens.error}`)
    }

    return refreshedTokens
  } catch (error) {
    console.error('Error refreshing access token:', error)
    throw error
  }
}
