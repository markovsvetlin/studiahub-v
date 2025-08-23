import { SQSEvent, SQSRecord } from 'aws-lambda'
import { Question } from '../../utils/quiz/database'
import { sendToQuizQueue } from '../../utils/quiz/workers'
import { gptService } from '../../services/quiz/gptService'

/**
 * Sub-worker handler for individual question generation tasks
 * Each sub-worker generates questions from assigned chunks
 */
export async function process(event: SQSEvent): Promise<void> {
  console.log(`👷 Sub-worker received ${event.Records.length} tasks`)

  for (const record of event.Records) {
    await processWorkerTask(record)
  }
}

/**
 * Process individual worker task from SQS
 */
async function processWorkerTask(record: SQSRecord): Promise<void> {
  try {
    console.log('📨 Processing worker task:', {
      messageId: record.messageId
    })

    // Parse message body
    let message: any
    try {
      message = JSON.parse(record.body)
    } catch (parseError) {
      console.error('❌ Failed to parse worker task:', parseError)
      return
    }

    if (message.type !== 'GENERATE_QUESTIONS') {
      console.warn(`⚠️ Unknown worker task type: ${message.type}`)
      return
    }

    const task = message.payload
    const workerStartTime = Date.now()
    
    console.log(`👷 Worker ${task.workerId} starting:`, {
      quizId: task.quizId,
      chunks: task.chunks.length,
      questionsToGenerate: task.questionsToGenerate
    })

    // Generate questions for this task
    const result = await generateQuestionsForTask(task)

    // Send result back to main worker queue
    await sendWorkerResult(result)

    const workerDuration = Date.now() - workerStartTime
    console.log(`✅ Worker ${task.workerId} completed in ${formatDuration(workerDuration)} (${result.questions?.length || 0} questions)`)

  } catch (error) {
    console.error('❌ Worker task failed:', error)
    
    // Try to send error result
    try {
      const message = JSON.parse(record.body)
      if (message.payload) {
        await sendWorkerResult({
          workerId: message.payload.workerId,
          quizId: message.payload.quizId,
          questions: [],
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    } catch (resultError) {
      console.error('❌ Failed to send error result:', resultError)
    }
    
    throw error
  }
}

/**
 * Generate questions for a specific worker task
 */
async function generateQuestionsForTask(task: any): Promise<any> {
  try {
    const { workerId, quizId, chunks, questionsToGenerate } = task

    if (!chunks || chunks.length === 0) {
      throw new Error('No chunks provided for question generation')
    }

    if (!questionsToGenerate || questionsToGenerate <= 0) {
      throw new Error('Invalid question count requested')
    }

    console.log(`🤖 Worker ${workerId} generating ${questionsToGenerate} questions from ${chunks.length} chunks`)

    // Generate questions using GPT-4o
    const questions = await gptService.generateQuestions(chunks, questionsToGenerate)

    console.log(`✅ Worker ${workerId} generated ${questions.length} questions`)

    return {
      workerId,
      quizId,
      questions,
      success: true,
      chunksUsed: chunks.map((chunk: any) => chunk.id)
    }

  } catch (error) {
    console.error(`❌ Worker ${task.workerId} generation failed:`, error)
    
    return {
      workerId: task.workerId,
      quizId: task.quizId,
      questions: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Send worker result back to main quiz queue
 */
async function sendWorkerResult(result: any): Promise<void> {
  try {
    console.log(`📤 Sending worker result: ${result.workerId} (success: ${result.success})`)

    await sendToQuizQueue(result.quizId, 'WORKER_COMPLETED', result)

    console.log(`✅ Worker result sent for: ${result.workerId}`)

  } catch (error) {
    console.error('❌ Failed to send worker result:', error)
    throw error
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
