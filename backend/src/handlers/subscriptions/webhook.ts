import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { createSuccessResponse, createErrorResponse } from '../../utils/http'
import { updateSubscription, getSubscriptionByCustomerId } from '../../utils/subscriptions/database'
import stripe from '../../services/stripe/stripe'

export const stripeWebhook = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  try {
    const signature = event.headers['stripe-signature']
    
    if (!signature) {
      return createErrorResponse(400, 'Missing Stripe signature')
    }

    // Verify webhook signature
    let stripeEvent
    try {
      stripeEvent = stripe.webhooks.constructEvent(
        event.body!,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      )
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return createErrorResponse(400, 'Invalid signature')
    }

    console.log('Processing Stripe webhook event:', stripeEvent.type)

    // Handle the event
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripeEvent.data.object as any)
        break

      case 'customer.subscription.created':
        await handleSubscriptionCreated(stripeEvent.data.object as any)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(stripeEvent.data.object as any)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(stripeEvent.data.object as any)
        break

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(stripeEvent.data.object as any)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(stripeEvent.data.object as any)
        break

      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`)
    }

    return createSuccessResponse({ received: true })
    
  } catch (error) {
    console.error('Error processing webhook:', error)
    return createErrorResponse(500, 'Webhook processing failed')
  }
}

async function handleCheckoutCompleted(session: any) {
  console.log('Checkout completed:', session.id)
  
  const userId = session.metadata?.userId
  if (!userId) {
    console.error('No userId in checkout session metadata')
    return
  }

  // The subscription will be handled by the subscription.created event
  // This is mainly for logging and potential additional setup
}

async function handleSubscriptionCreated(subscription: any) {
  console.log('Subscription created:', subscription.id)
  
  const userId = subscription.metadata?.userId
  const customerId = subscription.customer
  
  if (!userId) {
    // Try to find user by customer ID
    const existingSubscription = await getSubscriptionByCustomerId(customerId)
    if (!existingSubscription) {
      console.error('No userId found for subscription creation, customerId:', customerId)
      return
    }
    
    await updateSubscription(existingSubscription.userId, {
      stripeSubscriptionId: subscription.id,
      plan: 'pro',
      status: 'active',
      currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      priceId: subscription.items.data[0]?.price?.id,
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    })
  } else {
    await updateSubscription(userId, {
      stripeSubscriptionId: subscription.id,
      plan: 'pro',
      status: 'active',
      currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      priceId: subscription.items.data[0]?.price?.id,
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    })
  }
}

async function handleSubscriptionUpdated(subscription: any) {

  
  const userId = subscription.metadata?.userId
  const customerId = subscription.customer
  
  if (!userId) {
    console.log('No userId in metadata, searching by customer ID:', customerId)
    // Try to find user by customer ID
    const existingSubscription = await getSubscriptionByCustomerId(customerId)
    if (!existingSubscription) {
      console.error('No userId found for subscription update, customerId:', customerId)
      return
    }
    
    console.log('Found existing subscription for user:', existingSubscription.userId)
    
    // If subscription is active, upgrade to pro
    const updateData = {
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    }
    
    // If subscription is active and we don't have stripeSubscriptionId, set it and upgrade to pro
    if (subscription.status === 'active' && !existingSubscription.stripeSubscriptionId) {
      updateData.stripeSubscriptionId = subscription.id
      updateData.plan = 'pro'
      updateData.priceId = subscription.items.data[0]?.price?.id
      console.log('Upgrading user to Pro plan')
    }
    
    console.log('Updating subscription with data:', JSON.stringify(updateData))
    await updateSubscription(existingSubscription.userId, updateData)
    console.log('Subscription update completed for user:', existingSubscription.userId)
  } else {
    console.log('Found userId in metadata:', userId)
    const updateData = {
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    }
    
    console.log('Updating subscription with data:', JSON.stringify(updateData))
    await updateSubscription(userId, updateData)
    console.log('Subscription update completed for user:', userId)
  }
}

async function handleSubscriptionDeleted(subscription: any) {
  console.log('Subscription deleted:', subscription.id)
  
  const userId = subscription.metadata?.userId
  const customerId = subscription.customer
  
  if (!userId) {
    // Try to find user by customer ID
    const existingSubscription = await getSubscriptionByCustomerId(customerId)
    if (!existingSubscription) {
      console.error('No userId found for subscription deletion, customerId:', customerId)
      return
    }
    
    await updateSubscription(existingSubscription.userId, {
      plan: 'free',
      status: 'cancelled',
      stripeSubscriptionId: undefined,
      currentPeriodStart: undefined,
      currentPeriodEnd: undefined,
      cancelAtPeriodEnd: undefined,
      priceId: undefined
    })
  } else {
    await updateSubscription(userId, {
      plan: 'free',
      status: 'cancelled',
      stripeSubscriptionId: undefined,
      currentPeriodStart: undefined,
      currentPeriodEnd: undefined,
      cancelAtPeriodEnd: undefined,
      priceId: undefined
    })
  }
}

async function handlePaymentSucceeded(invoice: any) {
  console.log('Payment succeeded for invoice:', invoice.id)
  // Payment successful - subscription should already be active
  // Could add additional logging or notifications here
}

async function handlePaymentFailed(invoice: any) {
  console.log('Payment failed for invoice:', invoice.id)
  
  const subscriptionId = invoice.subscription
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const userId = subscription.metadata?.userId
    const customerId = subscription.customer
    
    if (!userId) {
      // Try to find user by customer ID
      const existingSubscription = await getSubscriptionByCustomerId(customerId as string)
      if (!existingSubscription) {
        console.error('No userId found for payment failure, customerId:', customerId)
        return
      }
      
      await updateSubscription(existingSubscription.userId, {
        status: 'past_due'
      })
    } else {
      await updateSubscription(userId, {
        status: 'past_due'
      })
    }
  }
}
