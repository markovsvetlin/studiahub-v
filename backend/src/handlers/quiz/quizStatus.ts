import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { createErrorResponse, createSuccessResponse } from '../../utils/http'
import { QuizService } from '../../services/quiz/QuizService'
import { validateJWT } from '../../middleware/jwtAuth'

const quizService = new QuizService()

/**
 * Get quiz status and progress
 */
export async function getQuizStatus(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const quizId = event.pathParameters?.id
    
    if (!quizId || typeof quizId !== 'string') {
      return createErrorResponse(400, 'Quiz ID is required')
    }

    const response = await quizService.getQuizStatus(quizId)
    return createSuccessResponse(response)

  } catch (error) {
    console.error('Failed to get quiz status:', error)
    return createErrorResponse(500, (error as Error).message)
  }
}

/**
 * List user's quizzes
 */
export async function getUserQuizzes(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    // Validate JWT token and get userId
    const { userId, error } = await validateJWT(event)
    if (!userId || error) {
      return createErrorResponse(401, error || 'Unauthorized')
    }

    const limitParam = event.queryStringParameters?.limit
    const limit = limitParam ? parseInt(limitParam) : 100

    const result = await quizService.getUserQuizzes(userId, limit)
    return createSuccessResponse(result)

  } catch (error) {
    console.error('Failed to get user quizzes:', error)
    return createErrorResponse(500, (error as Error).message)
  }
}