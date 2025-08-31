import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { createSuccessResponse, createErrorResponse } from '../../utils/http'
import { getUserUsage, getUsageLimits } from '../../utils/usage/database'
import { validateJWT } from '../../middleware/jwtAuth'

export const getUserUsageHandler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    // Validate JWT token and get userId
    const { userId, error } = await validateJWT(event)
    if (!userId || error) {
      return createErrorResponse(401, error || 'Unauthorized')
    }

    // Get user usage and limits (limits depend on subscription plan)
    const usage = await getUserUsage(userId)
    const limits = await getUsageLimits(userId)
    
    // Calculate percentages
    const wordsPercentage = Math.round((usage.wordsUsed / limits.words) * 100)
    const questionsPercentage = Math.round((usage.questionsGenerated / limits.questions) * 100)
    const tokensPercentage = Math.round((usage.tokensUsed / limits.tokens) * 100)
    
    // Calculate remaining amounts
    const wordsRemaining = Math.max(0, limits.words - usage.wordsUsed)
    const questionsRemaining = Math.max(0, limits.questions - usage.questionsGenerated)
    const tokensRemaining = Math.max(0, limits.tokens - usage.tokensUsed)
    
    return createSuccessResponse({
      current: {
        words: usage.wordsUsed,
        questions: usage.questionsGenerated,
        tokens: usage.tokensUsed
      },
      limits: {
        words: limits.words,
        questions: limits.questions,
        tokens: limits.tokens
      },
      remaining: {
        words: wordsRemaining,
        questions: questionsRemaining,
        tokens: tokensRemaining
      },
      percentages: {
        words: wordsPercentage,
        questions: questionsPercentage,
        tokens: tokensPercentage
      },
      resetDate: usage.resetDate,
      resetDateFormatted: new Date(usage.resetDate).toLocaleDateString()
    })
    
  } catch (error) {
    console.error('Error getting user usage:', error)
    return createErrorResponse(500, 'Failed to retrieve usage information')
  }
}