import { SQSEvent, SQSRecord } from 'aws-lambda'
import { quizGenerator } from '../../services/quiz/generator'
import { sendToQuizQueue } from '../../utils/quiz/workers'
import { getQuizById, updateQuizProgress } from '../../utils/quiz/database'

/**
 * Main worker handler for SQS quiz generation queue
 * Processes quiz generation requests and coordinates sub-workers
 */
export async function process(event: SQSEvent): Promise<void> {

  for (const record of event.Records) {
    await processQuizMessage(record)
  }
}

/**
 * Process individual SQS message for quiz generation
 */
async function processQuizMessage(record: SQSRecord): Promise<void> {
  try {
    // Parse message body
    let message: any
    try {
      message = JSON.parse(record.body)
    } catch (parseError) {
      console.error('❌ Failed to parse SQS message:', parseError)
      return // Skip invalid messages
    }



    // Handle different message types
    switch (message.type) {
      case 'START_GENERATION':
        await handleStartGeneration(message)
        break
        
      case 'WORKER_COMPLETED':
        await handleWorkerCompleted(message)
        break
        
      case 'QUESTIONS_GENERATED':
        await handleQuestionsGenerated(message)
        break
        
      default:
        console.warn(`⚠️ Unknown message type: ${message.type}`)
    }

  } catch (error) {
    console.error('❌ Failed to process quiz message:', error)
    console.error('Record details:', {
      messageId: record.messageId,
      body: record.body
    })
    
    // In production, this message would be retried or sent to DLQ
    throw error
  }
}

/**
 * Handle START_GENERATION message
 */
async function handleStartGeneration(message: any): Promise<void> {
  try {
    const { quizId, payload } = message

    if (!payload) {
      throw new Error('Missing payload in START_GENERATION message')
    }

    // Verify quiz exists and is in correct state
    const quiz = await getQuizById(quizId)
    if (!quiz) {
      throw new Error(`Quiz not found: ${quizId}`)
    }

    if (quiz.status !== 'generating') {
      console.warn(`⚠️ Quiz ${quizId} is not in generating state (current: ${quiz.status})`)
      return
    }

    // Start quiz generation
    await quizGenerator.generateQuiz({
      quizId,
      mode: payload.mode,
      query: payload.query,
      questionCount: payload.questionCount,
      userId: payload.userId
    })

  } catch (error) {
    console.error('❌ Failed to handle START_GENERATION:', error)
    
    // Update quiz with error status
    try {
      await updateQuizError(message.quizId, error instanceof Error ? error.message : 'Generation start failed')
    } catch (updateError) {
      console.error('❌ Failed to update quiz error status:', updateError)
    }
    
    throw error
  }
}

// Global tracking for worker completions (in production, use Redis/DynamoDB)
const workerCompletions = new Map<string, Array<{workerId: string, questions: any[], success: boolean}>>()

/**
 * Handle WORKER_COMPLETED message (from sub-workers)
 */
async function handleWorkerCompleted(message: any): Promise<void> {
  try {
    const { quizId, payload } = message

    if (!payload || !payload.workerId) {
      throw new Error('Invalid WORKER_COMPLETED message format')
    }

    const { workerId, questions, success, error } = payload

    // Track this worker completion
    if (!workerCompletions.has(quizId)) {
      workerCompletions.set(quizId, [])
    }
    
    const completions = workerCompletions.get(quizId)!
    completions.push({ workerId, questions: questions || [], success })

    if (!success && error) {
      console.error(`❌ Worker ${workerId} failed:`, error)
    }

    // Update progress incrementally as workers complete
    await updateProgressForCompletedWorker(quizId, completions.length)

    // Check if all workers completed
    await checkAndFinalizeQuiz(quizId, completions)

  } catch (error) {
    console.error('❌ Failed to handle WORKER_COMPLETED:', error)
    throw error
  }
}

/**
 * Update progress incrementally as each worker completes
 */
async function updateProgressForCompletedWorker(quizId: string, completedCount: number): Promise<void> {
  try {
    // Get the quiz to see expected worker count
    const quiz = await getQuizById(quizId)
    if (!quiz) return

    const expectedWorkers = calculateExpectedWorkers(quiz.questionCount)
    
    // Progress calculation:
    // 0-30%: Initial setup (already done)
    // 30-95%: Worker completion (65% total, divided by number of workers)
    const workerProgressRange = 65 // 95% - 30%
    const progressPerWorker = workerProgressRange / expectedWorkers
    const currentProgress = 30 + Math.floor(progressPerWorker * completedCount)
    
    await updateQuizProgress(quizId, currentProgress)
    
  } catch (error) {
    console.error(`❌ Failed to update progress for ${quizId}:`, error)
  }
}

/**
 * Check if all workers completed and finalize quiz
 */
async function checkAndFinalizeQuiz(quizId: string, completions: any[]): Promise<void> {
  try {
    // Get the quiz to see expected worker count
    const quiz = await getQuizById(quizId)
    if (!quiz) return

    // Calculate expected workers (same logic as in generator)
    const expectedWorkers = calculateExpectedWorkers(quiz.questionCount)

    if (completions.length >= expectedWorkers) {
      console.log(`🎉 Finalizing quiz ${quizId}`)
      
      // Collect all questions from successful workers
      const allQuestions: any[] = []
      for (const completion of completions) {
        if (completion.success && completion.questions) {
          allQuestions.push(...completion.questions)
        }
      }

      if (allQuestions.length > 0) {
        // Import saveQuizQuestions dynamically to avoid circular dependencies
        const { saveQuizQuestions } = await import('../../utils/quiz/database')
        
        // Limit to requested count and remove duplicates
        const uniqueQuestions = removeDuplicates(allQuestions).slice(0, quiz.questionCount)
        await saveQuizQuestions(quizId, uniqueQuestions)
        
        // Calculate total generation time
        const totalDuration = Date.now() - new Date(quiz.createdAt).getTime()
        console.log(`✅ Quiz ${quizId} completed in ${formatDuration(totalDuration)} with ${uniqueQuestions.length} questions`)
      } else {
        console.error(`❌ No questions generated for quiz ${quizId}`)
        await updateQuizError(quizId, 'No questions were generated by workers')
      }

      // Clean up tracking
      workerCompletions.delete(quizId)
    }

  } catch (error) {
    console.error(`❌ Failed to finalize quiz ${quizId}:`, error)
    await updateQuizError(quizId, error instanceof Error ? error.message : 'Finalization failed')
  }
}

/**
 * Calculate expected number of workers (same as generator logic)
 */
function calculateExpectedWorkers(questionCount: number): number {
  if (questionCount <= 3) return 1
  if (questionCount <= 9) return 3
  if (questionCount <= 15) return 5
  if (questionCount <= 30) return 10
  return Math.min(Math.ceil(questionCount / 3), 20)
}

/**
 * Remove duplicate questions
 */
function removeDuplicates(questions: any[]): any[] {
  const seen = new Set<string>()
  const unique: any[] = []
  
  for (const question of questions) {
    const normalizedText = question.questionText?.toLowerCase().trim()
    if (normalizedText && !seen.has(normalizedText)) {
      seen.add(normalizedText)
      unique.push(question)
    }
  }
  
  return unique
}

/**
 * Handle QUESTIONS_GENERATED message (final results)
 */
async function handleQuestionsGenerated(message: any): Promise<void> {
  try {
    const { quizId, payload } = message
    console.log(`🎉 Questions generated for quiz: ${quizId}`)

    if (!payload) {
      throw new Error('Missing payload in QUESTIONS_GENERATED message')
    }

    const { questions, success, error } = payload

    if (success && questions && questions.length > 0) {
      console.log(`✅ Quiz ${quizId} completed with ${questions.length} questions`)
      
      // Questions should already be saved by the generator
      // This is just a notification that generation is complete
      
    } else {
      console.error(`❌ Quiz generation failed for ${quizId}:`, error)
    }

  } catch (error) {
    console.error('❌ Failed to handle QUESTIONS_GENERATED:', error)
    throw error
  }
}

/**
 * Update quiz with error status
 */
async function updateQuizError(quizId: string, errorMessage: string): Promise<void> {
  try {
    // Import here to avoid circular dependencies
    const { updateQuizError: updateError } = await import('../../utils/quiz/database')
    await updateError(quizId, errorMessage)
  } catch (error) {
    console.error('Failed to update quiz error status:', error)
  }
}

/**
 * Format duration in milliseconds to human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`
  } else {
    const minutes = Math.floor(ms / 60000)
    const seconds = ((ms % 60000) / 1000).toFixed(1)
    return `${minutes}m ${seconds}s`
  }
}

// Export the handler
export const handler = process
