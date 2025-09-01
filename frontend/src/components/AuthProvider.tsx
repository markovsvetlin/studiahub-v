'use client'

import { SessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'

interface AuthProviderProps {
  children: ReactNode
}

export default function AuthProvider({ children }: AuthProviderProps) {
  return (
    <SessionProvider
      // Refetch session every 30 minutes (background refresh only)
      refetchInterval={30 * 60}
      // Don't refetch on tab switching - reduces unnecessary requests
      refetchOnWindowFocus={false}
      // Don't refetch when offline
      refetchWhenOffline={false}
    >
      {children}
    </SessionProvider>
  )
}
