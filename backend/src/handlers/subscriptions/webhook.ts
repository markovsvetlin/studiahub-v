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



    // Handle the event
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripeEvent.data.object as any)
        break

      case 'checkout.session.expired':
        await handleCheckoutExpired(stripeEvent.data.object as any)
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

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(stripeEvent.data.object as any)
        break

      default:
        console.log('Unhandled webhook event type:', stripeEvent.type)
    }

    return createSuccessResponse({ received: true })
    
  } catch (error) {
    console.error('Error processing webhook:', error)
    return createErrorResponse(500, 'Webhook processing failed')
  }
}

async function handleCheckoutCompleted(session: any) {
  console.log('Checkout session completed:', session.id, 'payment_status:', session.payment_status)
  
  const userId = session.metadata?.userId
  if (!userId) {
    console.error('No userId in checkout session metadata')
    return
  }

  // CRITICAL: Only proceed if payment was successful
  if (session.payment_status !== 'paid') {
    console.log('Payment not successful for session:', session.id, 'status:', session.payment_status)
    
    // If payment failed, ensure user doesn't have pro access
    if (session.payment_status === 'unpaid') {
      console.log('Payment failed, ensuring user remains on free plan')
      // Don't grant any subscription - user should remain on free plan
      // The subscription creation should only happen on successful payment
    }
    return
  }

  console.log('Payment successful for session:', session.id, 'userId:', userId)
  // The subscription will be handled by the subscription.created event
  // This is mainly for logging and potential additional setup
}

async function handleCheckoutExpired(session: any) {
  console.log('Checkout session expired:', session.id)
  
  const userId = session.metadata?.userId
  if (!userId) {
    console.error('No userId in expired checkout session metadata')
    return
  }

  console.log('Checkout session expired for user:', userId, '- ensuring they remain on free plan')
  // No action needed - user should remain on free plan since payment wasn't completed
}

async function handlePaymentIntentFailed(paymentIntent: any) {
  console.log('Payment intent failed:', paymentIntent.id)
  
  // Log the failure but don't change subscription status here
  // The subscription status should only be updated based on actual subscription events
  console.log('Payment failed for payment intent:', paymentIntent.id, 'amount:', paymentIntent.amount)
}

async function handleSubscriptionCreated(subscription: any) {
  console.log('Subscription created:', subscription.id, 'status:', subscription.status)
  
  const userId = subscription.metadata?.userId
  const customerId = subscription.customer
  
  // CRITICAL: Only grant pro access if subscription is active
  if (subscription.status !== 'active') {
    console.log('Subscription created but not active:', subscription.id, 'status:', subscription.status)
    return
  }
  
  if (!userId) {
    // Try to find user by customer ID
    const existingSubscription = await getSubscriptionByCustomerId(customerId)
    if (!existingSubscription) {
      console.error('No userId found for subscription creation, customerId:', customerId)
      return
    }
    
    console.log('Granting pro access to user:', existingSubscription.userId)
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
    console.log('Granting pro access to user:', userId)
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
  console.log('Subscription updated:', subscription.id, 'status:', subscription.status)
  
  const userId = subscription.metadata?.userId
  const customerId = subscription.customer
  
  if (!userId) {
    // Try to find user by customer ID
    const existingSubscription = await getSubscriptionByCustomerId(customerId)
    if (!existingSubscription) {
      console.error('No userId found for subscription update, customerId:', customerId)
      return
    }
    
    // Update subscription status but be careful about granting pro access
    const updateData: any = {
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    }
    
    // CRITICAL: Grant pro access when subscription becomes active
    if (subscription.status === 'active') {
      console.log('Granting pro access to user via subscription update:', existingSubscription.userId)
      updateData.stripeSubscriptionId = subscription.id
      updateData.plan = 'pro'
      updateData.priceId = subscription.items.data[0]?.price?.id
    } else if (subscription.status !== 'active') {
      // If subscription is not active, remove pro access
      console.log('Removing pro access - subscription not active:', subscription.status)
      updateData.plan = 'free'
    }
    
    await updateSubscription(existingSubscription.userId, updateData)
  } else {
    const updateData: any = {
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    }
    
    // Grant or remove pro access based on subscription status
    if (subscription.status === 'active') {
      console.log('Granting pro access to user via subscription update:', userId)
      updateData.plan = 'pro'
      updateData.priceId = subscription.items.data[0]?.price?.id
    } else {
      console.log('Removing pro access - subscription not active:', subscription.status)
      updateData.plan = 'free'
    }
    
    await updateSubscription(userId, updateData)
  }
}

async function handleSubscriptionDeleted(subscription: any) {

  
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
  console.log('💰 Payment succeeded for invoice:', invoice.id, 'amount:', invoice.amount_paid)
  
  const subscriptionId = invoice.subscription
  const customerId = invoice.customer
  
  if (subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      const userId = subscription.metadata?.userId
      
      if (userId) {
        console.log('✅ Payment successful for user:', userId, 'amount:', invoice.amount_paid / 100, invoice.currency.toUpperCase())
        
        // Payment successful - subscription should already be active from subscription.created event
        // This is for additional logging, analytics, or notifications
        
        // TODO: Add any post-payment actions here:
        // - Send payment confirmation email
        // - Log to analytics
        // - Update payment history
        
      } else {
        console.log('⚠️ Payment succeeded but no userId found in subscription metadata')
      }
    } catch (error) {
      console.error('Error processing payment success:', error)
    }
  } else {
    console.log('⚠️ Payment succeeded but no subscription ID found')
  }
}

async function handlePaymentFailed(invoice: any) {

  
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
