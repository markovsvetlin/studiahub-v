import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { createErrorResponse, createSuccessResponse } from '../../utils/http'
import { QuizService } from '../../services/quiz/QuizService'

const quizService = new QuizService()

export async function deleteQuiz(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const quizId = event.pathParameters?.id
    
    if (!quizId) {
      return createErrorResponse(400, 'Quiz ID is required')
    }
    
    const result = await quizService.deleteQuiz(quizId)
    return createSuccessResponse(result)
    
  } catch (error) {
    console.error('Failed to delete quiz:', error)
    return createErrorResponse(500, (error as Error).message)
  }
}