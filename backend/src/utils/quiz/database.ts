import { PutCommand, UpdateCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../../db'

const QUIZ_TABLE = process.env.QUIZ_TABLE || 'studiahub-backend-dev-quiz'

export interface Question {
  questionText: string
  options: string[]        // Array of 4 options
  correctAnswer: number    // Index of correct option (0-3)
  explanation: string      // Why this answer is correct
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface Quiz {
  id: string              // UUID for quiz
  userId?: string         // For future user management (GSI)
  mode: 'specific' | 'general'
  query?: string          // Search query for specific mode
  questions?: Question[]  // Array of generated questions
  questionCount: number   // Requested number of questions
  status: 'generating' | 'ready' | 'error'
  progress: number        // 0-100 percentage
  chunksUsed?: string[]   // IDs of chunks used for generation
  createdAt: string       // ISO timestamp
  updatedAt: string       // ISO timestamp
  error?: string          // Error message if failed
}

export interface QuizData {
  mode: 'specific' | 'general'
  query?: string
  questionCount: number
  userId?: string
}

/**
 * Create a new quiz record with initial status
 */
export async function createQuiz(data: QuizData): Promise<Quiz> {
  const quiz: Quiz = {
    id: uuidv4(),
    userId: data.userId,
    mode: data.mode,
    query: data.query,
    questionCount: data.questionCount,
    status: 'generating',
    progress: 0,
    chunksUsed: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  try {
    console.log(`📝 Creating new quiz record: ${quiz.id}`)
    
    await db.send(new PutCommand({
      TableName: QUIZ_TABLE,
      Item: quiz
    }))

    console.log(`✅ Quiz ${quiz.id} created`)
    return quiz
    
  } catch (error) {
    console.error('❌ Failed to create quiz record:', error)
    throw new Error(`Failed to create quiz record: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Update quiz progress percentage
 */
export async function updateQuizProgress(id: string, progress: number): Promise<void> {
  try {
    // Ensure progress is between 0 and 100
    const clampedProgress = Math.max(0, Math.min(100, progress))
    
    await db.send(new UpdateCommand({
      TableName: QUIZ_TABLE,
      Key: { id },
      UpdateExpression: 'SET progress = :progress, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':progress': clampedProgress,
        ':updatedAt': new Date().toISOString()
      }
    }))
    
  } catch (error) {
    console.error(`❌ Failed to update quiz progress for ${id}:`, error)
    throw new Error(`Failed to update quiz progress: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Save generated questions to quiz and mark as ready
 */
export async function saveQuizQuestions(id: string, questions: Question[]): Promise<void> {
  try {

    
    // Validate questions before saving
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i]
      if (!question.questionText || !question.options || question.options.length !== 4) {
        throw new Error(`Invalid question at index ${i}: missing required fields or incorrect options count`)
      }
      if (question.correctAnswer < 0 || question.correctAnswer > 3) {
        throw new Error(`Invalid question at index ${i}: correctAnswer must be 0-3`)
      }
    }
    
    await db.send(new UpdateCommand({
      TableName: QUIZ_TABLE,
      Key: { id },
      UpdateExpression: 'SET questions = :questions, #status = :status, progress = :progress, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':questions': questions,
        ':status': 'ready',
        ':progress': 100,
        ':updatedAt': new Date().toISOString()
      }
    }))

    console.log(`✅ Quiz ${id} completed with ${questions.length} questions`)
    
  } catch (error) {
    console.error(`❌ Failed to save quiz questions for ${id}:`, error)
    throw new Error(`Failed to save quiz questions: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Update quiz status to error
 */
export async function updateQuizError(id: string, errorMessage: string): Promise<void> {
  try {
    console.log(`💥 Updating quiz ${id} with error: ${errorMessage}`)
    
    await db.send(new UpdateCommand({
      TableName: QUIZ_TABLE,
      Key: { id },
      UpdateExpression: 'SET #status = :status, #error = :error, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#error': 'error'
      },
      ExpressionAttributeValues: {
        ':status': 'error',
        ':error': errorMessage,
        ':updatedAt': new Date().toISOString()
      }
    }))

    console.log(`💥 Quiz ${id} marked as error`)
    
  } catch (error) {
    console.error(`❌ Failed to update quiz error status for ${id}:`, error)
    throw new Error(`Failed to update quiz error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get quiz by ID
 */
export async function getQuizById(id: string): Promise<Quiz | null> {
  try {
    console.log(`🔍 Getting quiz: ${id}`)
    
    const result = await db.send(new GetCommand({
      TableName: QUIZ_TABLE,
      Key: { id }
    }))

    if (!result.Item) {
      console.log(`❓ Quiz not found: ${id}`)
      return null
    }

    const quiz = result.Item as Quiz
    console.log(`✅ Found quiz: ${id} (status: ${quiz.status}, progress: ${quiz.progress}%)`)
    
    return quiz
    
  } catch (error) {
    console.error(`❌ Failed to get quiz ${id}:`, error)
    throw new Error(`Failed to get quiz: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
