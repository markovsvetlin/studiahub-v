import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { getQuizById, Quiz } from '../../utils/quiz/database'
import { createResponse } from '../../utils/http'

interface QuizStatusResponse {
  id: string
  mode: 'specific' | 'general'
  query?: string
  status: 'generating' | 'ready' | 'error'
  progress: number
  questionCount: number
  questions?: any[]  // Only included when status is 'ready'
  createdAt: string
  updatedAt: string
  error?: string
  estimatedTimeRemaining?: string
}

/**
 * Lambda handler for GET /quiz/{id}
 * Returns the current status and data for a quiz
 */
export async function get(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {

  try {
    // Validate HTTP method (handle both HTTP API v1 and v2 formats)
    const method = event.httpMethod || (event as any).requestContext?.http?.method
    if (method !== 'GET') {
      return createResponse(405, {
        error: 'Method not allowed',
        message: `Only GET method is supported, received: ${method}`
      })
    }

    // Get quiz ID from path parameters
    const quizId = event.pathParameters?.id
    if (!quizId) {
      return createResponse(400, {
        error: 'Bad request',
        message: 'Quiz ID is required'
      })
    }

    // Get quiz from database
    const quiz = await getQuizById(quizId)
    if (!quiz) {
      return createResponse(404, {
        error: 'Not found',
        message: `Quiz with ID ${quizId} not found`
      })
    }

    // Build response based on quiz status
    const response = buildStatusResponse(quiz)
    
    return createResponse(200, response)

  } catch (error) {
    console.error('❌ Quiz status endpoint error:', error)
    
    return createResponse(500, {
      error: 'Internal server error',
      message: 'Failed to get quiz status',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
    })
  }
}

/**
 * Build status response based on quiz data
 */
function buildStatusResponse(quiz: Quiz): QuizStatusResponse {
  const baseResponse: QuizStatusResponse = {
    id: quiz.id,
    mode: quiz.mode,
    query: quiz.query,
    status: quiz.status,
    progress: quiz.progress,
    questionCount: quiz.questionCount,
    createdAt: quiz.createdAt,
    updatedAt: quiz.updatedAt
  }

  // Add status-specific data
  switch (quiz.status) {
    case 'ready':
      baseResponse.questions = quiz.questions || []
      break
      
    case 'error':
      baseResponse.error = quiz.error || 'Unknown error occurred'
      break
      
    case 'generating':
      baseResponse.estimatedTimeRemaining = calculateEstimatedTimeRemaining(quiz)
      break
  }

  return baseResponse
}

/**
 * Calculate estimated time remaining for quiz generation
 */
function calculateEstimatedTimeRemaining(quiz: Quiz): string {
  if (quiz.progress >= 100) {
    return '0 seconds'
  }

  // Estimate based on typical generation time
  const baseTimePerQuestion = 3 // seconds
  const totalEstimatedTime = quiz.questionCount * baseTimePerQuestion
  const progressRatio = quiz.progress / 100
  const elapsedTime = totalEstimatedTime * progressRatio
  const remainingTime = Math.max(0, totalEstimatedTime - elapsedTime)

  if (remainingTime < 60) {
    return `${Math.ceil(remainingTime)} seconds`
  } else {
    const minutes = Math.ceil(remainingTime / 60)
    return `${minutes} minute${minutes > 1 ? 's' : ''}`
  }
}

// Export the handler
export const handler = get
