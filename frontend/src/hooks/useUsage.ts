'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {  getAuthHeaders } from '../utils/auth'

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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE || 'https://oyehv715ef.execute-api.us-east-1.amazonaws.com'

export function useUsage(userId?: string) {
  const { data: session } = useSession()
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchUsage = useCallback(async () => {
    if (!session) return

    setIsLoading(true)
    setError(null)

    try {
      const headers = await getAuthHeaders()
      
      const response = await fetch(`${API_BASE_URL}/usage/current`, {
        headers
      })
      
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
  }, [session])

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