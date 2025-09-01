import { withAuth } from 'next-auth/middleware'

export default withAuth(
  // Optional: Add additional middleware logic here
  function middleware() {
    // You can add custom logic here if needed
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // If there's a refresh token error, deny access to force re-authentication
        if (token?.error === "RefreshAccessTokenError") {
          return false
        }
        
        // For dashboard routes, require valid authentication
        if (req.nextUrl.pathname.startsWith('/dashboard')) {
          return !!token
        }
        
        // For API routes, require valid authentication
        if (req.nextUrl.pathname.startsWith('/api/')) {
          return !!token
        }
        
        // Allow access to public routes
        return true
      },
    },
  }
)

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}

