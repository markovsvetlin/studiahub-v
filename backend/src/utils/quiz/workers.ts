import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import { Chunk } from '../../services/quiz/chunksRetrieval'
import { Question } from './database'

// Initialize SQS client
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  // For local development (if SQS is not available, operations will be skipped)
  ...(process.env.IS_OFFLINE && {
    endpoint: 'http://localhost:9324', // ElasticMQ endpoint for local testing
    credentials: {
      accessKeyId: 'fake',
      secretAccessKey: 'fake'
    }
  })
})

const WORKER_QUEUE_URL = process.env.WORKER_QUEUE_URL
const QUIZ_QUEUE_URL = process.env.QUIZ_QUEUE_URL

export interface WorkerTask {
  workerId: string
  chunks: Chunk[]
  questionsToGenerate: number
  quizId?: string
}

export interface WorkerResult {
  workerId: string
  quizId: string
  questions: Question[]
  success: boolean
  error?: string
}

export interface WorkerConfig {
  workerCount: number
  questionsPerWorker: number
  chunksPerWorker: number
}

/**
 * Calculate optimal worker distribution based on question count
 */
export function calculateWorkerDistribution(questionCount: number): WorkerConfig {
  let workerCount: number
  
  if (questionCount <= 3) {
    workerCount = 1
  } else if (questionCount <= 9) {
    workerCount = 3
  } else if (questionCount <= 15) {
    workerCount = 5
  } else if (questionCount <= 30) {
    workerCount = 10
  } else {
    workerCount = Math.min(Math.ceil(questionCount / 3), 20) // Max 20 workers
  }
  
  const questionsPerWorker = Math.ceil(questionCount / workerCount)
  const chunksPerWorker = Math.max(2, Math.min(4, Math.ceil(15 / workerCount))) // 2-4 chunks per worker
  
  console.log(`📊 Worker distribution: ${workerCount} workers, ${questionsPerWorker} questions/worker, ${chunksPerWorker} chunks/worker`)
  
  return {
    workerCount,
    questionsPerWorker,
    chunksPerWorker
  }
}

/**
 * Send task to worker queue
 */
export async function sendToWorkerQueue(task: WorkerTask): Promise<void> {
  // Skip if in offline mode or no queue URL
  if (process.env.IS_OFFLINE === 'true' || !WORKER_QUEUE_URL) {
    console.log('⚠️ Skipping worker queue - running in offline mode or no queue URL')
    return
  }
  
  try {
    console.log(`📤 Sending task to worker queue: ${task.workerId}`)
    
    const message = {
      type: 'GENERATE_QUESTIONS',
      payload: task,
      timestamp: new Date().toISOString()
    }
    
    await sqsClient.send(new SendMessageCommand({
      QueueUrl: WORKER_QUEUE_URL,
      MessageBody: JSON.stringify(message),
      MessageAttributes: {
        'WorkerId': {
          DataType: 'String',
          StringValue: task.workerId
        },
        'QuizId': {
          DataType: 'String',
          StringValue: task.quizId || 'unknown'
        }
      }
    }))
    
    console.log(`✅ Task sent to worker queue: ${task.workerId}`)
    
  } catch (error) {
    console.error(`❌ Failed to send task to worker queue:`, error)
    throw new Error(`Failed to send task to worker queue: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Send message to main quiz queue (for orchestration)
 */
export async function sendToQuizQueue(quizId: string, action: string, payload?: any): Promise<void> {
  // Skip if in offline mode or no queue URL
  if (process.env.IS_OFFLINE === 'true' || !QUIZ_QUEUE_URL) {
    console.log('⚠️ Skipping quiz queue - running in offline mode or no queue URL')
    return
  }
  
  try {
    console.log(`📤 Sending message to quiz queue: ${quizId} - ${action}`)
    
    const message = {
      type: action,
      quizId,
      payload,
      timestamp: new Date().toISOString()
    }
    
    await sqsClient.send(new SendMessageCommand({
      QueueUrl: QUIZ_QUEUE_URL,
      MessageBody: JSON.stringify(message),
      MessageAttributes: {
        'QuizId': {
          DataType: 'String',
          StringValue: quizId
        },
        'Action': {
          DataType: 'String',
          StringValue: action
        }
      }
    }))
    
    console.log(`✅ Message sent to quiz queue: ${quizId} - ${action}`)
    
  } catch (error) {
    console.error(`❌ Failed to send message to quiz queue:`, error)
    throw new Error(`Failed to send message to quiz queue: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

