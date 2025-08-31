import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Define protected routes
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  // Add more protected routes here as needed
])

export default clerkMiddleware(async (auth, req) => {
  // Skip protection in development and let client-side handle auth
  return NextResponse.next()
}, {
  // Add explicit configuration for production
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}

