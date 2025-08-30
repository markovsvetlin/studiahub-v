import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { createSuccessResponse, createErrorResponse } from '../../utils/http'
import { getUserSubscription, updateSubscription } from '../../utils/subscriptions/database'
import stripe from '../../services/stripe/stripe'

export const renewSubscription = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  try {
    const { userId } = JSON.parse(event.body || '{}')
    
    if (!userId) {
      return createErrorResponse(400, 'userId is required')
    }

    // Get user subscription
    const subscription = await getUserSubscription(userId)
    
    if (subscription.plan !== 'pro' || !subscription.stripeSubscriptionId) {
      return createErrorResponse(400, 'No Pro subscription found to renew')
    }

    if (!subscription.cancelAtPeriodEnd) {
      return createErrorResponse(400, 'Subscription is not cancelled - no need to renew')
    }

    // Remove the cancellation from Stripe subscription
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: false,
      }
    )

    // Update our database
    await updateSubscription(userId, {
      cancelAtPeriodEnd: false
    })

    return createSuccessResponse({
      message: 'Subscription renewed successfully',
      cancelAtPeriodEnd: false,
      periodEnd: subscription.currentPeriodEnd
    })
    
  } catch (error) {
    console.error('Error renewing subscription:', error)
    return createErrorResponse(500, 'Failed to renew subscription')
  }
}
