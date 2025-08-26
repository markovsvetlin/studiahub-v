'use client'
import { useState, useEffect, useCallback } from 'react'

export interface UsageData {
  current: {
    words: number
    questions: number
    tokens: number
  }
  limits: {
    words: number
    questions: number
    tokens: number
  }
  remaining: {
    words: number
    questions: number
    tokens: number
  }
  percentages: {
    words: number
    questions: number
    tokens: number
  }
  resetDate: string
  resetDateFormatted: string
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000/api'

export function useUsage(userId?: string) {
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchUsage = useCallback(async () => {
    if (!userId) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/usage/${userId}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setUsage(data)
    } catch (err) {
      console.error('Error fetching usage:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch usage data')
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchUsage()
  }, [userId, fetchUsage])

  const refreshUsage = () => {
    fetchUsage()
  }

  return {
    usage,
    isLoading,
    error,
    refreshUsage
  }
}