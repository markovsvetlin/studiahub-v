import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { createSuccessResponse, createErrorResponse } from '../../utils/http'
import { getUserSubscription, updateSubscription } from '../../utils/subscriptions/database'
import { validateJWT } from '../../middleware/jwtAuth'
import stripe from '../../services/stripe/stripe'

export const createCheckoutSession = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  try {
    // Validate JWT token and get userId
    const { userId, error } = await validateJWT(event)
    if (!userId || error) {
      return createErrorResponse(401, error || 'Unauthorized')
    }

    // Get or create user subscription record
    const subscription = await getUserSubscription(userId)
    
    // Check if user already has an active pro subscription
    if (subscription.plan === 'pro' && subscription.status === 'active') {
      return createErrorResponse(400, 'User already has an active Pro subscription')
    }

    let customerId = subscription.stripeCustomerId

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: {
          userId: userId
        }
      })
      customerId = customer.id

      // Update subscription record with customer ID
      await updateSubscription(userId, {
        stripeCustomerId: customerId
      })
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_MONTHLY_PRICE_ID!,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?success=true`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?cancelled=true`,
      metadata: {
        userId: userId
      },
      subscription_data: {
        metadata: {
          userId: userId
        }
      }
    })

    return createSuccessResponse({
      checkoutUrl: session.url,
      sessionId: session.id
    })
    
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return createErrorResponse(500, 'Failed to create checkout session')
  }
}
