import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { createErrorResponse, createSuccessResponse } from '../../utils/http'
import { QuizService } from '../../services/quiz/QuizService'
import { validateJWT } from '../../middleware/nextAuthMiddleware'

const quizService = new QuizService()

/**
 * Quiz Generation Handler - thin wrapper for QuizService
 */
export async function generateQuiz(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    // Validate JWT token and get userId
    const { userId, error } = await validateJWT(event)
    if (!userId || error) {
      return createErrorResponse(401, error || 'Unauthorized')
    }

    if (!event.body) {
      return createErrorResponse(400, 'Request body required')
    }
    
    let request: any;
    try {
      request = JSON.parse(event.body);
    } catch {
      return createErrorResponse(400, 'Invalid JSON in request body');
    }
    
    // Add userId to request from JWT token
    request.userId = userId;
    
    const result = await quizService.generateQuiz(request);
    return createSuccessResponse(result);

  } catch (error) {
    console.error('Quiz generation failed:', error);
    return createErrorResponse(500, (error as Error).message);
  }
}

