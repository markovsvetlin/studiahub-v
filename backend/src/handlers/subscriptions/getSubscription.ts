import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { createSuccessResponse, createErrorResponse } from '../../utils/http'
import { getUserSubscription } from '../../utils/subscriptions/database'
import { validateJWT } from '../../middleware/nextAuthMiddleware'

export const getSubscription = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  try {
    // Validate JWT token and get userId
    const { userId, error } = await validateJWT(event)
    if (!userId || error) {
      return createErrorResponse(401, error || 'Unauthorized')
    }

    // Get user subscription
    const subscription = await getUserSubscription(userId)
    
    // Format response data
    const responseData = {
      plan: subscription.plan,
      status: subscription.status,
      nextBillingDate: subscription.currentPeriodEnd 
        ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : undefined,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false
    }

    return createSuccessResponse(responseData)
    
  } catch (error) {
    console.error('Error getting subscription:', error)
    return createErrorResponse(500, 'Failed to retrieve subscription information')
  }
}
