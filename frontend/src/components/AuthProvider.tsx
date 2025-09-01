'use client'

import { SessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'

interface AuthProviderProps {
  children: ReactNode
}

export default function AuthProvider({ children }: AuthProviderProps) {
  return (
    <SessionProvider
      // Refetch session every 5 minutes
      refetchInterval={5 * 60}
      // Refetch on window focus
      refetchOnWindowFocus={true}
      // Keep session in sync across browser tabs
      refetchWhenOffline={false}
    >
      {children}
    </SessionProvider>
  )
}
