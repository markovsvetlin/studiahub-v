import { db } from '../../db'
import { PutCommand, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'

const SUBSCRIPTIONS_TABLE = process.env.SUBSCRIPTIONS_TABLE!

export interface SubscriptionRecord {
  userId: string
  stripeCustomerId?: string // Optional - only set when user interacts with Stripe
  stripeSubscriptionId?: string
  plan: 'free' | 'pro'
  status: 'active' | 'cancelled' | 'past_due' | 'incomplete'
  currentPeriodStart?: string // ISO date string
  currentPeriodEnd?: string // ISO date string
  cancelAtPeriodEnd?: boolean
  priceId?: string
  createdAt: number
  updatedAt: number
}

/**
 * Get or create subscription record for user
 */
export async function getUserSubscription(userId: string): Promise<SubscriptionRecord> {
  try {
    const result = await db.send(new GetCommand({
      TableName: SUBSCRIPTIONS_TABLE,
      Key: { userId }
    }))

    if (result.Item) {
      return result.Item as SubscriptionRecord
    }

    // Create new subscription record (starts as free plan)
    const newSubscription: SubscriptionRecord = {
      userId,
      // stripeCustomerId is undefined until user interacts with Stripe
      plan: 'free',
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    await db.send(new PutCommand({
      TableName: SUBSCRIPTIONS_TABLE,
      Item: newSubscription
    }))

    return newSubscription
  } catch (error) {
    console.error('Error getting user subscription:', error)
    throw new Error('Failed to retrieve subscription information')
  }
}

/**
 * Update subscription record
 */
export async function updateSubscription(
  userId: string, 
  updates: Partial<SubscriptionRecord>
): Promise<void> {
  try {
    const updateExpression = []
    const expressionAttributeNames: Record<string, string> = {}
    const expressionAttributeValues: Record<string, any> = {}

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'userId' && value !== undefined) {
        // Skip empty string values for Stripe IDs (they should be undefined instead)
        if ((key === 'stripeCustomerId' || key === 'stripeSubscriptionId') && 
            typeof value === 'string' && value.trim() === '') {

          return
        }
        
        updateExpression.push(`#${key} = :${key}`)
        expressionAttributeNames[`#${key}`] = key
        expressionAttributeValues[`:${key}`] = value

      }
    })

    // Always update the updatedAt timestamp
    updateExpression.push('#updatedAt = :updatedAt')
    expressionAttributeNames['#updatedAt'] = 'updatedAt'
    expressionAttributeValues[':updatedAt'] = Date.now()

    if (updateExpression.length === 1) {
      // Only updatedAt would be updated, skip the operation

      return
    }

    const result = await db.send(new UpdateCommand({
      TableName: SUBSCRIPTIONS_TABLE,
      Key: { userId },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    }))
    

  } catch (error) {
    console.error('Error updating subscription:', error)
    throw new Error('Failed to update subscription')
  }
}

/**
 * Get subscription by Stripe subscription ID
 */
export async function getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<SubscriptionRecord | null> {
  try {
    // Don't query if stripeSubscriptionId is empty or undefined
    if (!stripeSubscriptionId || stripeSubscriptionId.trim() === '') {
      return null
    }

    const result = await db.send(new QueryCommand({
      TableName: SUBSCRIPTIONS_TABLE,
      IndexName: 'stripe-subscription-index',
      KeyConditionExpression: 'stripeSubscriptionId = :subscriptionId',
      ExpressionAttributeValues: {
        ':subscriptionId': stripeSubscriptionId
      }
    }))

    return result.Items?.[0] as SubscriptionRecord || null
  } catch (error) {
    console.error('Error getting subscription by Stripe ID:', error)
    return null
  }
}

/**
 * Get subscription by Stripe customer ID
 */
export async function getSubscriptionByCustomerId(stripeCustomerId: string): Promise<SubscriptionRecord | null> {
  try {
    // Don't query if stripeCustomerId is empty or undefined
    if (!stripeCustomerId || stripeCustomerId.trim() === '') {
      return null
    }

    const result = await db.send(new QueryCommand({
      TableName: SUBSCRIPTIONS_TABLE,
      IndexName: 'stripe-customer-index',
      KeyConditionExpression: 'stripeCustomerId = :customerId',
      ExpressionAttributeValues: {
        ':customerId': stripeCustomerId
      }
    }))

    return result.Items?.[0] as SubscriptionRecord || null
  } catch (error) {
    console.error('Error getting subscription by customer ID:', error)
    return null
  }
}

/**
 * Check if user has active pro subscription (including cancelled but not yet expired)
 */
export async function userHasProSubscription(userId: string): Promise<boolean> {
  try {
    const subscription = await getUserSubscription(userId)
    
    // Pro users keep access until period ends, even if cancelled
    if (subscription.plan === 'pro' && subscription.status === 'active') {
      return true
    }
    
    // Also check if it's cancelled but still within the current period
    if (subscription.plan === 'pro' && 
        subscription.cancelAtPeriodEnd && 
        subscription.currentPeriodEnd) {
      const periodEndDate = new Date(subscription.currentPeriodEnd)
      const now = new Date()
      return now < periodEndDate // Still has access until period ends
    }
    
    return false
  } catch (error) {
    console.error('Error checking pro subscription:', error)
    return false
  }
}
