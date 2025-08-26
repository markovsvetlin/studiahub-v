import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { createSuccessResponse, createErrorResponse } from '../../utils/http'
import { getUserUsage, getUsageLimits } from '../../utils/usage/database'

export const getUserUsageHandler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    // Get userId from path parameters or query
    const userId = event.pathParameters?.userId || event.queryStringParameters?.userId
    
    if (!userId) {
      return createErrorResponse(400, 'userId is required')
    }

    // Get user usage and limits
    const usage = await getUserUsage(userId)
    const limits = getUsageLimits()
    
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