import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { createQuiz, QuizData } from '../../utils/quiz/database'
import { quizGenerator } from '../../services/quiz/generator'
import { sendToQuizQueue } from '../../utils/quiz/workers'
import { createResponse } from '../../utils/http'

interface GenerateQuizRequest {
  mode: 'specific' | 'general'
  query?: string
  questionCount: number
  userId?: string
}

interface GenerateQuizResponse {
  quizId: string
  status: 'generating'
  message: string
}

/**
 * Lambda handler for POST /quiz/generate
 * Creates a new quiz and initiates generation process
 */
export async function generate(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('🚀 Quiz generation request received')

  try {
    // Validate HTTP method (handle both HTTP API v1 and v2 formats)
    const method = event.httpMethod || (event as any).requestContext?.http?.method
    if (method !== 'POST') {
      return createResponse(405, {
        error: 'Method not allowed',
        message: `Only POST method is supported, received: ${method}`
      })
    }

    // Parse and validate request body
    if (!event.body) {
      return createResponse(400, {
        error: 'Bad request',
        message: 'Request body is required'
      })
    }

    let requestData: GenerateQuizRequest
    try {
      requestData = JSON.parse(event.body)
    } catch (parseError) {
      return createResponse(400, {
        error: 'Bad request',
        message: 'Invalid JSON in request body'
      })
    }


    console.log(`📋 Generating ${requestData.questionCount} questions (${requestData.mode} mode)`)

    // Create quiz record in database
    const quizData: QuizData = {
      mode: requestData.mode,
      query: requestData.query,
      questionCount: requestData.questionCount,
      userId: requestData.userId
    }

    const quiz = await createQuiz(quizData)

    // Detect environment and start generation
    const isOffline = process.env.IS_OFFLINE === 'true'
    
    if (isOffline) {
      
      // Start generation in background (don't await)
      quizGenerator.generateQuiz({
        quizId: quiz.id,
        mode: requestData.mode,
        query: requestData.query,
        questionCount: requestData.questionCount,
        userId: requestData.userId
      }).catch(error => {
        console.error(`❌ Background quiz generation failed for ${quiz.id}:`, error)
      })
      
    } else {
      console.log('☁️ Production mode - queuing generation task')
      
      // Queue the generation task for processing
      try {
        await sendToQuizQueue(quiz.id, 'START_GENERATION', {
          mode: requestData.mode,
          query: requestData.query,
          questionCount: requestData.questionCount,
          userId: requestData.userId
        })
      } catch (queueError) {
        console.error('❌ Failed to queue generation task:', queueError)
        // Fall back to direct generation if queue fails
        console.log('🔄 Falling back to direct generation')
        
        quizGenerator.generateQuiz({
          quizId: quiz.id,
          mode: requestData.mode,
          query: requestData.query,
          questionCount: requestData.questionCount,
          userId: requestData.userId
        }).catch(error => {
          console.error(`❌ Fallback quiz generation failed for ${quiz.id}:`, error)
        })
      }
    }

    // Return quiz ID immediately
    const response: GenerateQuizResponse = {
      quizId: quiz.id,
      status: 'generating',
      message: `Quiz generation started for ${requestData.questionCount} questions`
    }

    console.log(`🎉 Quiz generation initiated: ${quiz.id}`)
    
    return createResponse(202, response) // 202 Accepted

  } catch (error) {
    console.error('❌ Quiz generation endpoint error:', error)
    
    return createResponse(500, {
      error: 'Internal server error',
      message: 'Failed to start quiz generation',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
    })
  }
}

// Export the handler
export const handler = generate
