'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { getSubscription, upgradeToProPlan, cancelSubscription, renewSubscription, SubscriptionData } from '@/services/subscription'

export function useSubscription(userId?: string) {
  const { data: session } = useSession()
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSubscription = useCallback(async () => {
    if (!userId) return

    setIsLoading(true)
    setError(null)

    try {
      const data = await getSubscription()
      setSubscription(data)
    } catch (err) {
      console.error('Error fetching subscription:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch subscription data')
    } finally {
      setIsLoading(false)
    }
  }, [userId, session])

  useEffect(() => {
    fetchSubscription()
  }, [userId, fetchSubscription])

  const handleUpgrade = useCallback(async () => {
    if (!userId) return

    try {
      setError(null)
      await upgradeToProPlan()
      // User will be redirected to Stripe, no need to update state here
    } catch (err) {
      console.error('Error upgrading subscription:', err)
      setError(err instanceof Error ? err.message : 'Failed to upgrade subscription')
    }
  }, [userId, session])

  const handleCancel = useCallback(async () => {
    if (!userId) return

    try {
      setError(null)
      setIsLoading(true)
      const result = await cancelSubscription(userId)
      
      // Refresh subscription data to get updated cancellation status
      await fetchSubscription()
      
      return result
    } catch (err) {
      console.error('Error canceling subscription:', err)
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [userId, fetchSubscription])

  const handleRenew = useCallback(async () => {
    if (!userId) return

    try {
      setError(null)
      setIsLoading(true)
      const result = await renewSubscription(userId)
      
      // Refresh subscription data to get updated renewal status
      await fetchSubscription()
      
      return result
    } catch (err) {
      console.error('Error renewing subscription:', err)
      setError(err instanceof Error ? err.message : 'Failed to renew subscription')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [userId, fetchSubscription])

  const refreshSubscription = () => {
    fetchSubscription()
  }

  return {
    subscription,
    isLoading,
    error,
    handleUpgrade,
    handleCancel,
    handleRenew,
    refreshSubscription
  }
}
