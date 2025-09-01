export interface SubscriptionData {
  plan: 'free' | 'pro'
  status: 'active' | 'cancelled' | 'past_due'
  nextBillingDate?: string
  cancelAtPeriodEnd?: boolean
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000'

/**
 * Get user subscription data
 */
import { getAuthHeaders } from '@/utils/auth'

export async function getSubscription(): Promise<SubscriptionData> {
  const headers = await getAuthHeaders()

  const response = await fetch(`${API_BASE_URL}/subscriptions/user`, {
    headers
  })
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return response.json()
}

/**
 * Create Stripe checkout session and redirect to checkout
 */
export async function upgradeToProPlan(): Promise<void> {
  const headers = await getAuthHeaders()

  const response = await fetch(`${API_BASE_URL}/subscriptions/checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}), // No userId needed - comes from JWT
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const { checkoutUrl } = await response.json()
  
  // Redirect to Stripe checkout
  window.location.href = checkoutUrl
}

/**
 * Cancel user subscription
 */
export async function cancelSubscription(userId: string): Promise<{ message: string; periodEnd?: string }> {
  const response = await fetch(`${API_BASE_URL}/subscriptions/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId }),
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return response.json()
}

/**
 * Renew cancelled subscription (remove cancellation)
 */
export async function renewSubscription(userId: string): Promise<{ message: string; periodEnd?: string }> {
  const response = await fetch(`${API_BASE_URL}/subscriptions/renew`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId }),
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return response.json()
}
