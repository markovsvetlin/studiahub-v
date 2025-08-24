import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { SendMessageCommand } from '@aws-sdk/client-sqs'
import { sqs } from '../../utils/sqs'
import { createErrorResponse, createSuccessResponse } from '../../utils/http'
import { retrieveChunksForQuiz } from '../../services/quiz/chunks'
import { generateQuizQuestions } from '../../services/quiz/gpt'
import { ChunkContent } from '../../services/quiz/prompts'
import { 
  createQuizRecord, 
  completeQuiz, 
  markQuizError,
  QuizMetadata 
} from '../../utils/quiz/database'
import { initializeCompletion } from '../../utils/quiz/completionTracker'
import { QUIZ_QUEUE_URL } from '../../utils/constants'

const IS_LOCAL = process.env.IS_OFFLINE === 'true' || process.env.NODE_ENV === 'development'

interface GenerateQuizRequest {
  userId: string
  questionCount: number
  quizName: string
  minutes: number
  difficulty: 'easy' | 'medium' | 'hard'
  topic?: string
  additionalInstructions?: string
}

interface WorkerTask {
  quizId: string
  chunks: ChunkContent[]
  difficulty: 'easy' | 'medium' | 'hard'
  topic?: string
  questionCount: number
  workerIndex: number
}

/**
 * Quiz Generation Orchestrator
 * Handles both local (direct) and production (worker-based) flows
 */
export async function generateQuiz(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const orchestratorStartTime = Date.now();
  console.log(`🕐 Quiz orchestrator started at ${new Date().toISOString()}`);
  try {
    if (!event.body) {
      return createErrorResponse(400, 'Request body required')
    }
    
    let request: GenerateQuizRequest
    try {
      request = JSON.parse(event.body)
    } catch {
      return createErrorResponse(400, 'Invalid JSON in request body')
    }
    
    // Validate request
    const validationError = validateRequest(request)
    if (validationError) {
      return createErrorResponse(400, validationError)
    }

    console.log(`🎯 Generating quiz (${IS_LOCAL ? 'LOCAL' : 'PROD'}): ${request.questionCount} ${request.difficulty} questions`);
    
    const retrievedChunks = await retrieveChunksForQuiz({
      focusArea: request.topic,
      questionCount: request.questionCount,
      userId: request.userId
    })

    if (retrievedChunks.length === 0) {
      return createErrorResponse(400, 'No relevant content found. Please ensure you have uploaded and enabled files.')
    }

    // Convert to ChunkContent format
    const chunks: ChunkContent[] = retrievedChunks.map(chunk => ({
      id: chunk.id,
      text: chunk.text,
      fileId: chunk.fileId,
      fileName: `file_${chunk.fileId}` // We'll improve this later
    }))

    // Create quiz metadata
    const metadata: QuizMetadata = {
      quizName: request.quizName,
      minutes: request.minutes,
      difficulty: request.difficulty,
      topic: request.topic,
      additionalInstructions: request.additionalInstructions,
      questionCount: request.questionCount
    }

    let result;
    if (IS_LOCAL) {
      result = await handleLocalFlow(chunks, metadata, request.userId)
    } else {
      result = await handleProductionFlow(chunks, metadata, request.userId)
    }
    
    const orchestratorDurationMs = Date.now() - orchestratorStartTime;
    console.log(`⏱️ Quiz orchestrator completed in ${orchestratorDurationMs}ms (${(orchestratorDurationMs/1000).toFixed(2)}s)`);
    return result;

  } catch (error) {
    const orchestratorDurationMs = Date.now() - orchestratorStartTime;
    console.error(`❌ Quiz orchestrator failed after ${orchestratorDurationMs}ms:`, error)
    return createErrorResponse(500, `Quiz generation failed: ${(error as Error).message}`)
  }
}

/**
 * Local development flow - direct GPT call
 */
async function handleLocalFlow(
  chunks: ChunkContent[], 
  metadata: QuizMetadata, 
  userId: string
): Promise<APIGatewayProxyResultV2> {
  console.log('🚀 Using LOCAL flow - direct GPT generation')
  
  try {
    // Create quiz record
    const quiz = await createQuizRecord({
      userId,
      metadata
    })

    // Generate questions directly (no progress updates)
    const questions = await generateQuizQuestions({
      chunks,
      metadata,
      questionCount: metadata.questionCount
    })

    // Complete quiz
    await completeQuiz(quiz.id, questions)

    console.log(`🎉 Quiz ${quiz.id} completed locally`);

    return createSuccessResponse({
      quizId: quiz.id,
      status: 'ready',
      questionCount: questions.length,
      message: 'Quiz generated successfully!'
    })

  } catch (error) {
    console.error('❌ Local flow failed:', error)
    throw error
  }
}

/**
 * Production flow - worker-based processing
 */
async function handleProductionFlow(
  chunks: ChunkContent[],
  metadata: QuizMetadata,
  userId: string
): Promise<APIGatewayProxyResultV2> {
  console.log('⚙️ Using PRODUCTION flow - worker-based generation')

  try {
    // Calculate worker distribution
    const distribution = calculateWorkerDistribution(chunks.length, metadata.questionCount)
    console.log(`👥 Spawning ${distribution.workerCount} workers for ${chunks.length} chunks`);

    // Create quiz record
    const quiz = await createQuizRecord({
      userId,
      metadata
    })
    
    // Initialize completion tracking
    initializeCompletion(quiz.id, distribution.workerCount);

    // Split chunks and spawn workers
    const workerTasks = createWorkerTasks(chunks, metadata, distribution, quiz.id)
    
    // Send tasks to SQS queue
    await spawnWorkers(workerTasks)

    console.log(`🎯 Quiz ${quiz.id} processing started`);

    return createSuccessResponse({
      quizId: quiz.id,
      status: 'processing',
      message: 'Quiz generation started! Use the quiz ID to check progress.'
    })

  } catch (error) {
    console.error('❌ Production flow failed:', error)
    throw error
  }
}

/**
 * Worker distribution based on fixed question amounts
 * 10 questions → 2 workers (5 each)
 * 20 questions → 4 workers (5 each) 
 * 30 questions → 6 workers (5 each)
 */
function calculateWorkerDistribution(chunkCount: number, questionCount: number) {
  let workerCount: number;
  
  switch (questionCount) {
    case 10:
      workerCount = 2;
      break;
    case 20:
      workerCount = 4;
      break;
    case 30:
      workerCount = 6;
      break;
    default:
      // Fallback for any other amounts (shouldn't happen with UI dropdown)
      workerCount = Math.min(Math.ceil(questionCount / 5), 6);
      console.warn(`Unexpected question count: ${questionCount}, using ${workerCount} workers`);
  }
  
  return {
    workerCount,
    chunksPerWorker: Math.ceil(chunkCount / workerCount),
    questionsPerWorker: Math.ceil(questionCount / workerCount)
  }
}

/**
 * Create worker task objects
 */
function createWorkerTasks(
  chunks: ChunkContent[], 
  metadata: QuizMetadata,
  distribution: any,
  quizId: string
): WorkerTask[] {
  const tasks: WorkerTask[] = []
  
  for (let i = 0; i < distribution.workerCount; i++) {
    const startIndex = i * distribution.chunksPerWorker
    const endIndex = Math.min(startIndex + distribution.chunksPerWorker, chunks.length)
    const workerChunks = chunks.slice(startIndex, endIndex)
    
    // Calculate questions for this worker (distribute remainder)
    let questionsForThisWorker = distribution.questionsPerWorker
    if (i === distribution.workerCount - 1) {
      // Last worker gets any remaining questions
      const questionsAllocated = distribution.questionsPerWorker * (distribution.workerCount - 1)
      questionsForThisWorker = metadata.questionCount - questionsAllocated
    }

    const task = {
      quizId,
      chunks: workerChunks,
      difficulty: metadata.difficulty,
      topic: metadata.topic,
      questionCount: questionsForThisWorker,
      workerIndex: i
    };
    
    tasks.push(task);
  }

  return tasks
}

/**
 * Send worker tasks to SQS queue
 */
async function spawnWorkers(tasks: WorkerTask[]): Promise<void> {
  if (!QUIZ_QUEUE_URL) {
    throw new Error('QUIZ_QUEUE_URL not configured')
  }

  const promises = tasks.map(async (task, index) => {
    const command = new SendMessageCommand({
      QueueUrl: QUIZ_QUEUE_URL,
      MessageBody: JSON.stringify(task),
      MessageAttributes: {
        quizId: {
          DataType: 'String',
          StringValue: task.quizId
        },
        workerIndex: {
          DataType: 'Number', 
          StringValue: task.workerIndex.toString()
        }
      }
    })

    await sqs.send(command)
  })

  await Promise.all(promises)
  console.log(`✅ Spawned ${tasks.length} workers for quiz ${tasks[0]?.quizId}`);
}

/**
 * Validate incoming request
 */
function validateRequest(request: GenerateQuizRequest): string | null {
  if (!request.userId || typeof request.userId !== 'string') {
    return 'userId is required'
  }
  
  if (!request.quizName || typeof request.quizName !== 'string' || request.quizName.trim().length === 0) {
    return 'quizName is required'
  }
  
  if (typeof request.questionCount !== 'number' || ![10, 20, 30].includes(request.questionCount)) {
    return 'questionCount must be 10, 20, or 30'
  }
  
  if (typeof request.minutes !== 'number' || request.minutes < 1 || request.minutes > 180) {
    return 'minutes must be between 1 and 180'
  }
  
  if (!['easy', 'medium', 'hard'].includes(request.difficulty)) {
    return 'difficulty must be easy, medium, or hard'
  }

  if (request.topic && (typeof request.topic !== 'string' || request.topic.trim().length === 0)) {
    return 'topic must be a non-empty string if provided'
  }

  return null
}