import { chunksRetriever, Chunk } from './chunksRetrieval'
import { Question } from '../../utils/quiz/database'
import { gptService } from './gptService'
import { 
  createQuiz, 
  updateQuizProgress, 
  saveQuizQuestions, 
  updateQuizError,
  QuizData, 
  Quiz 
} from '../../utils/quiz/database'
import { 
  sendToWorkerQueue, 
  WorkerTask, 
  WorkerResult,
  calculateWorkerDistribution 
} from '../../utils/quiz/workers'

export interface QuizParams {
  quizId: string
  mode: 'specific' | 'general'
  query?: string
  questionCount: number
  userId?: string
}

export interface GenerationResult {
  success: boolean
  questionsGenerated: number
  error?: string
}

export class QuizGenerator {
  /**
   * Main entry point for quiz generation
   * Handles both local (synchronous) and production (worker) modes
   */
  async generateQuiz(params: QuizParams): Promise<GenerationResult> {
    const startTime = Date.now()
    console.log(`🚀 Starting quiz generation for ${params.questionCount} questions (mode: ${params.mode})`)
    
    try {
      // Update initial progress
      await updateQuizProgress(params.quizId, 10)
      
      // Detect environment and choose generation mode
      const isOffline = process.env.IS_OFFLINE === 'true'
      const useWorkers = !isOffline && process.env.QUIZ_QUEUE_URL
      
      if (isOffline || !useWorkers) {
        console.log('🔧 Using LOCAL MODE - synchronous generation')
        return await this.generateLocalMode(params)
      } else {
        console.log('☁️ Using PRODUCTION MODE - worker-based generation')
        return await this.generateWithWorkers(params)
      }
      
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`❌ Quiz generation failed after ${this.formatDuration(duration)}:`, error)
      
      // Update quiz status to error
      await updateQuizError(params.quizId, error instanceof Error ? error.message : 'Unknown error')
      
      return {
        success: false,
        questionsGenerated: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Local development mode - generate all questions synchronously
   */
  private async generateLocalMode(params: QuizParams): Promise<GenerationResult> {
    const localStartTime = Date.now()
    
    try {
      // Step 1: Retrieve relevant chunks
      const chunksStartTime = Date.now()
      await updateQuizProgress(params.quizId, 20)
      
      const chunks = await this.retrieveChunks(params.mode, params.query, params.userId)
      if (chunks.length === 0) {
        throw new Error('No relevant content found for quiz generation')
      }
      
      const chunksDuration = Date.now() - chunksStartTime
      console.log(`⏱️ Chunk retrieval completed in ${this.formatDuration(chunksDuration)} (${chunks.length} chunks)`)
      
      await updateQuizProgress(params.quizId, 30)
      
      // Step 2: Generate all questions in batches
      const questionsStartTime = Date.now()
      const questions: Question[] = []
      const taskCount = this.calculateTaskCount(params.questionCount)
      const questionsPerTask = Math.ceil(params.questionCount / taskCount)
      
      console.log(`⚙️ Generating questions in ${taskCount} batches`)
      
      for (let i = 0; i < taskCount; i++) {
        const startIdx = i * Math.ceil(chunks.length / taskCount)
        const endIdx = Math.min((i + 1) * Math.ceil(chunks.length / taskCount), chunks.length)
        const taskChunks = chunks.slice(startIdx, endIdx)
        
        if (taskChunks.length === 0) continue
        
        // Update progress
        const progressPercent = 30 + Math.floor((60 * i) / taskCount)
        await updateQuizProgress(params.quizId, progressPercent)
        
        // Generate questions for this batch
        const remainingQuestions = params.questionCount - questions.length
        const questionsToGenerate = Math.min(questionsPerTask, remainingQuestions)
        
        if (questionsToGenerate <= 0) break
        
        try {
          const batchQuestions = await gptService.generateQuestions(taskChunks, questionsToGenerate)
          questions.push(...batchQuestions)
        } catch (batchError) {
          console.error(`⚠️ Batch ${i + 1} failed:`, batchError)
          // Continue with other batches instead of failing completely
        }
        
        if (questions.length >= params.questionCount) break
      }
      
      // Step 3: Validate and save results
      await updateQuizProgress(params.quizId, 95)
      
      if (questions.length === 0) {
        throw new Error('Failed to generate any questions')
      }
      
      // Remove duplicates and limit to requested count
      const uniqueQuestions = this.removeDuplicateQuestions(questions)
      const finalQuestions = uniqueQuestions.slice(0, params.questionCount)
      
      const questionsDuration = Date.now() - questionsStartTime
      console.log(`⏱️ Question generation completed in ${this.formatDuration(questionsDuration)} (${finalQuestions.length} questions)`)
      
      await saveQuizQuestions(params.quizId, finalQuestions)
      
      await updateQuizProgress(params.quizId, 100)
      
      const totalDuration = Date.now() - localStartTime
      console.log(`🎉 Local mode generation completed in ${this.formatDuration(totalDuration)} (${finalQuestions.length} questions)`)
      
      return {
        success: true,
        questionsGenerated: finalQuestions.length
      }
      
    } catch (error) {
      console.error('❌ Local mode generation failed:', error)
      throw error
    }
  }

  /**
   * Production mode - distribute work to SQS workers
   */
  private async generateWithWorkers(params: QuizParams): Promise<GenerationResult> {
    const setupStartTime = Date.now()
    
    try {
      // Step 1: Retrieve chunks
      const chunksStartTime = Date.now()
      await updateQuizProgress(params.quizId, 20)
      
      const chunks = await this.retrieveChunks(params.mode, params.query, params.userId)
      if (chunks.length === 0) {
        throw new Error('No relevant content found for quiz generation')
      }
      
      const chunksDuration = Date.now() - chunksStartTime
      console.log(`⏱️ Chunk retrieval completed in ${this.formatDuration(chunksDuration)} (${chunks.length} chunks)`)
      
      await updateQuizProgress(params.quizId, 30)
      
      // Step 2: Distribute work to workers
      const tasks = await this.distributeWork(chunks, params.questionCount)
      await this.spawnWorkers(tasks, params.quizId)
      
      const setupDuration = Date.now() - setupStartTime
      console.log(`🚀 Spawned ${tasks.length} workers in ${this.formatDuration(setupDuration)} (async generation continues)`)
      
      // Workers will handle the rest asynchronously
      return {
        success: true,
        questionsGenerated: 0 // Will be updated by workers
      }
      
    } catch (error) {
      console.error('❌ Production mode setup failed:', error)
      throw error
    }
  }

  /**
   * Retrieve chunks based on mode
   */
  private async retrieveChunks(mode: string, query?: string, userId?: string): Promise<Chunk[]> {
    if (mode === 'specific' && query) {
      return await chunksRetriever.getSpecificChunks(query, 15, userId)
    } else {
      return await chunksRetriever.getGeneralChunks(20, userId)
    }
  }

  /**
   * Distribute work among workers
   */
  private async distributeWork(chunks: Chunk[], questionCount: number): Promise<WorkerTask[]> {
    const workerConfig = calculateWorkerDistribution(questionCount)
    const tasks: WorkerTask[] = []
    
    const chunksPerWorker = Math.ceil(chunks.length / workerConfig.workerCount)
    
    for (let i = 0; i < workerConfig.workerCount; i++) {
      const startIdx = i * chunksPerWorker
      const endIdx = Math.min(startIdx + chunksPerWorker, chunks.length)
      const workerChunks = chunks.slice(startIdx, endIdx)
      
      if (workerChunks.length === 0) continue
      
      tasks.push({
        workerId: `worker_${i}`,
        chunks: workerChunks,
        questionsToGenerate: Math.ceil(questionCount / workerConfig.workerCount)
      })
    }
    
    return tasks
  }

  /**
   * Spawn worker tasks
   */
  private async spawnWorkers(tasks: WorkerTask[], quizId: string): Promise<void> {
    for (const task of tasks) {
      await sendToWorkerQueue({
        ...task,
        quizId
      })
    }
  }

  /**
   * Calculate optimal number of tasks for local mode
   */
  private calculateTaskCount(questionCount: number): number {
    if (questionCount <= 3) return 1
    if (questionCount <= 9) return 3
    if (questionCount <= 15) return 5
    return Math.min(Math.ceil(questionCount / 3), 8) // Max 8 batches for local mode
  }

  /**
   * Remove duplicate questions based on question text
   */
  private removeDuplicateQuestions(questions: Question[]): Question[] {
    const seen = new Set<string>()
    const unique: Question[] = []
    
    for (const question of questions) {
      const normalizedText = question.questionText.toLowerCase().trim()
      if (!seen.has(normalizedText)) {
        seen.add(normalizedText)
        unique.push(question)
      }
    }
    
    console.log(`🔍 Removed ${questions.length - unique.length} duplicate questions`)
    return unique
  }

  /**
   * Format duration in milliseconds to human-readable format
   */
  private formatDuration(ms: number): string {
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
}

export const quizGenerator = new QuizGenerator()
