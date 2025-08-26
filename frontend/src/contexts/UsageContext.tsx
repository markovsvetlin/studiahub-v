'use client'
import { createContext, useContext, ReactNode } from 'react'

interface UsageContextType {
  refreshUsage: () => void
}

const UsageContext = createContext<UsageContextType | null>(null)

export function UsageProvider({ children, refreshUsage }: { 
  children: ReactNode
  refreshUsage: () => void 
}) {
  return (
    <UsageContext.Provider value={{ refreshUsage }}>
      {children}
    </UsageContext.Provider>
  )
}

export function useUsageContext() {
  const context = useContext(UsageContext)
  if (!context) {
    // Return a no-op function instead of throwing error
    return { refreshUsage: () => {} }
  }
  return context
}