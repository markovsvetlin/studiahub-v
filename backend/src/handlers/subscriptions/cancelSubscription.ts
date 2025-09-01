import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { createSuccessResponse, createErrorResponse } from '../../utils/http'
import { getUserSubscription, updateSubscription } from '../../utils/subscriptions/database'
import { validateJWT } from '../../middleware/jwtAuth'
import stripe from '../../services/stripe/stripe'

export const cancelSubscription = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  try {
    // Validate JWT token and get userId
    const { userId, error } = await validateJWT(event)
    if (!userId || error) {
      return createErrorResponse(401, error || 'Unauthorized')
    }

    // Get user subscription
    const subscription = await getUserSubscription(userId)
    
    console.log('Cancel subscription - User subscription data:', {
      userId,
      plan: subscription.plan,
      status: subscription.status,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      stripeCustomerId: subscription.stripeCustomerId
    })
    
    if (subscription.plan !== 'pro') {
      console.log('Cancel failed - plan is not pro:', subscription.plan)
      return createErrorResponse(400, `User is on ${subscription.plan} plan, not Pro`)
    }
    
    if (!subscription.stripeSubscriptionId) {
      console.log('No stripeSubscriptionId in database, trying to find it from Stripe customer...')
      
      if (!subscription.stripeCustomerId) {
        console.log('Cancel failed - no stripeCustomerId found either')
        return createErrorResponse(400, 'No Stripe subscription or customer ID found. Contact support.')
      }
      
      try {
        // Try to find active subscription for this customer
        const subscriptions = await stripe.subscriptions.list({
          customer: subscription.stripeCustomerId,
          status: 'active',
          limit: 1
        })
        
        if (subscriptions.data.length === 0) {
          console.log('No active subscriptions found for customer in Stripe')
          return createErrorResponse(400, 'No active subscription found in Stripe.')
        }
        
        const stripeSubscription = subscriptions.data[0]
        console.log('Found active subscription in Stripe:', stripeSubscription.id)
        
        // Update our database with the missing subscription ID
        await updateSubscription(userId, {
          stripeSubscriptionId: stripeSubscription.id
        })
        
        // Use this subscription ID for cancellation
        subscription.stripeSubscriptionId = stripeSubscription.id
        
      } catch (stripeError) {
        console.error('Error finding subscription in Stripe:', stripeError)
        return createErrorResponse(500, 'Error connecting to Stripe. Please try again.')
      }
    }

    console.log('Cancelling subscription in Stripe:', subscription.stripeSubscriptionId)
    
    // Cancel the subscription at period end in Stripe
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      }
    )

    console.log('Stripe subscription cancelled successfully, updating database...')

    // Update our database
    await updateSubscription(userId, {
      cancelAtPeriodEnd: true
    })

    console.log('✅ Subscription cancelled successfully for user:', userId)

    return createSuccessResponse({
      message: 'Subscription cancelled successfully. You will keep Pro access until the end of your billing period.',
      cancelAtPeriodEnd: true,
      periodEnd: subscription.currentPeriodEnd,
      billingPeriodEnd: subscription.currentPeriodEnd
    })
    
  } catch (error) {
    console.error('Error cancelling subscription:', error)
    return createErrorResponse(500, 'Failed to cancel subscription')
  }
}
