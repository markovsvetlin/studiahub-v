import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { createSuccessResponse, createErrorResponse } from '../../utils/http'
import { getUserSubscription, updateSubscription } from '../../utils/subscriptions/database'
import stripe from '../../services/stripe/stripe'

export const cancelSubscription = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  try {
    const { userId } = JSON.parse(event.body || '{}')
    
    if (!userId) {
      return createErrorResponse(400, 'userId is required')
    }

    // Get user subscription
    const subscription = await getUserSubscription(userId)
    
    if (subscription.plan !== 'pro' || !subscription.stripeSubscriptionId) {
      return createErrorResponse(400, 'No active Pro subscription found')
    }

    // Cancel the subscription at period end in Stripe
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      }
    )

    // Update our database
    await updateSubscription(userId, {
      cancelAtPeriodEnd: true
    })

    return createSuccessResponse({
      message: 'Subscription cancelled successfully',
      cancelAtPeriodEnd: true,
      periodEnd: subscription.currentPeriodEnd
    })
    
  } catch (error) {
    console.error('Error cancelling subscription:', error)
    return createErrorResponse(500, 'Failed to cancel subscription')
  }
}
