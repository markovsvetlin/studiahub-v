import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { createErrorResponse, createSuccessResponse } from '../../utils/http'
import { getQuizRecord, getUserQuizzes as dbGetUserQuizzes } from '../../utils/quiz/database'

/**
 * Get quiz status and progress
 */
export async function getQuizStatus(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const quizId = event.pathParameters?.id
    
    if (!quizId || typeof quizId !== 'string') {
      return createErrorResponse(400, 'Quiz ID is required')
    }

    console.log(`📊 Fetching status for quiz: ${quizId}`)

    // Get quiz record from database
    const quiz = await getQuizRecord(quizId)
    
    if (!quiz) {
      return createErrorResponse(404, 'Quiz not found')
    }

    // Calculate progress based on status and question count
    let progress = 0;
    if (quiz.status === 'ready') {
      progress = 100;
    } else if (quiz.status === 'processing') {
      // Show progress based on questions collected vs expected
      const currentQuestions = quiz.questions?.length || 0;
      const expectedQuestions = quiz.metadata.questionCount;
      progress = expectedQuestions > 0 ? Math.round((currentQuestions / expectedQuestions) * 100) : 0;
    }
    
    // Build streamlined response
    const response: any = {
      quizId: quiz.id,
      status: quiz.status,
      progress: progress,
      metadata: quiz.metadata,
      createdAt: quiz.createdAt
    }
    
    if (quiz.updatedAt) response.updatedAt = quiz.updatedAt
    if (quiz.status === 'ready') {
      response.questions = quiz.questions
      response.completedAt = quiz.completedAt
    }
    // No worker tracking needed
    if (quiz.status === 'error') response.error = quiz.error

    console.log(`✅ Quiz ${quizId} status: ${quiz.status} (${progress}%)`)

    return createSuccessResponse(response)

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Failed to get quiz status:', message)
    return createErrorResponse(500, `Failed to get quiz status: ${message}`)
  }
}

/**
 * List user's quizzes with pagination
 */
export async function getUserQuizzes(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = event.queryStringParameters?.userId
    if (!userId) {
      return createErrorResponse(400, 'userId query parameter required')
    }

    const quizzes = await dbGetUserQuizzes(userId)
    
    // Return summary info only (not full questions)
    const summaries = quizzes.map(quiz => ({
      quizId: quiz.id,
      quizName: quiz.metadata.quizName,
      status: quiz.status,
      progress: quiz.status === 'ready' ? 100 : 0,
      questionCount: quiz.metadata.questionCount,
      createdAt: quiz.createdAt,
      completedAt: quiz.completedAt
    }))

    return createSuccessResponse({ userId, quizzes: summaries })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Failed to get user quizzes:', message)
    return createErrorResponse(500, `Failed to get user quizzes: ${message}`)
  }
}