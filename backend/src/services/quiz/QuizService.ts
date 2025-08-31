/**
 * Unified Quiz Service - handles all quiz operations
 */

import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { sqs } from '../../utils/sqs';
import { QUIZ_QUEUE_URL } from '../../utils/constants';
import { pineconeService } from '../files/pinecone';
import { EmbeddingService } from '../files/EmbeddingService';
import { getEnabledFileIds } from '../../utils/files/database';
import { validateUsage, incrementQuestionsGenerated } from '../../utils/usage/database';
import { 
  createQuizRecord, 
  getQuizRecord, 
  completeQuiz, 
  addQuestionsToQuiz,
  QuizMetadata,
  QuizQuestion,
} from '../../utils/quiz/database';
import fetch from 'node-fetch';

const IS_LOCAL = process.env.IS_OFFLINE === 'true' || process.env.NODE_ENV === 'development';

export interface GenerateQuizRequest {
  userId: string;
  questionCount: number;
  quizName: string;
  minutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
  topic?: string;
  additionalInstructions?: string;
}

export interface QuizGenerationResult {
  quizId: string;
  status: 'ready' | 'processing';
  message: string;
  questionCount?: number;
}

export interface ChunkContent {
  id: string;
  text: string;
  fileId: string;
  fileName: string;
}

interface WorkerTask {
  quizId: string;
  chunks: ChunkContent[];
  difficulty: 'easy' | 'medium' | 'hard';
  topic?: string;
  questionCount: number;
  workerIndex: number;
}

export class QuizService {
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Generate a new quiz
   */
  async generateQuiz(request: GenerateQuizRequest): Promise<QuizGenerationResult> {
    // Validate request
    this.validateGenerateRequest(request);
    
    // Validate usage
    const validation = await validateUsage(request.userId, 'questions', request.questionCount);
    if (!validation.canProceed) {
      throw new Error(validation.message!);
    }
    
    // Retrieve content chunks
    const chunks = await this.retrieveChunksForQuiz({
      focusArea: request.topic,
      questionCount: request.questionCount,
      userId: request.userId
    });

    if (chunks.length === 0) {
      throw new Error('No relevant content found. Please ensure you have uploaded and enabled files.');
    }

    // Create quiz metadata
    const metadata: QuizMetadata = {
      quizName: request.quizName,
      minutes: request.minutes,
      difficulty: request.difficulty,
      topic: request.topic,
      additionalInstructions: request.additionalInstructions,
      questionCount: request.questionCount
    };

    // Process based on environment
    if (IS_LOCAL) {
      return await this.processQuizLocal(chunks, metadata, request.userId);
    } else {
      return await this.processQuizProduction(chunks, metadata, request.userId);
    }
  }

  /**
   * Get quiz status
   */
  async getQuizStatus(quizId: string): Promise<any> {
    const quiz = await getQuizRecord(quizId);
    
    if (!quiz) {
      throw new Error('Quiz not found');
    }

    // Calculate progress
    let progress = 0;
    if (quiz.status === 'ready') {
      progress = 100;
    } else if (quiz.status === 'processing') {
      const currentQuestions = quiz.questions?.length || 0;
      const expectedQuestions = quiz.metadata.questionCount;
      progress = expectedQuestions > 0 ? Math.round((currentQuestions / expectedQuestions) * 100) : 0;
    }
    
    const response: any = {
      quizId: quiz.id,
      status: quiz.status,
      progress: progress,
      metadata: quiz.metadata,
      createdAt: quiz.createdAt
    };
    
    if (quiz.updatedAt) response.updatedAt = quiz.updatedAt;
    if (quiz.status === 'ready') {
      response.questions = quiz.questions;
      response.completedAt = quiz.completedAt;
    }
    if (quiz.status === 'error') response.error = quiz.error;

    return response;
  }

  /**
   * Get user quizzes
   */
  async getUserQuizzes(userId: string, limit = 100): Promise<any> {
    const { getUserQuizzes: dbGetUserQuizzes } = await import('../../utils/quiz/database');
    const quizzes = await dbGetUserQuizzes(userId, limit);
    
    const summaries = quizzes.map(quiz => ({
      quizId: quiz.id,
      quizName: quiz.metadata.quizName,
      status: quiz.status,
      progress: quiz.status === 'ready' ? 100 : 0,
      questionCount: quiz.metadata.questionCount,
      createdAt: quiz.createdAt,
      completedAt: quiz.completedAt,
      metadata: quiz.metadata,
      questions: quiz.questions || []
    }));

    return { userId, quizzes: summaries };
  }

  /**
   * Delete quiz
   */
  async deleteQuiz(quizId: string): Promise<{ message: string; quizId: string }> {
    // Simple delete from database
    const { DeleteCommand } = await import('@aws-sdk/lib-dynamodb');
    const { db } = await import('../../db');
    const { QUIZ_TABLE } = await import('../../utils/constants');
    
    await db.send(new DeleteCommand({
      TableName: QUIZ_TABLE,
      Key: { id: quizId }
    }));
    
    return {
      message: 'Quiz deleted successfully',
      quizId
    };
  }

  /**
   * Process worker task (for SQS handler)
   */
  async processWorkerTask(task: WorkerTask): Promise<void> {
    const { quizId, chunks, difficulty, topic, questionCount, workerIndex } = task;

    // Generate questions
    const questions = await this.generateQuestions({
      chunks,
      metadata: { 
        difficulty, 
        topic, 
        questionCount, 
        quizName: '',
        minutes: 0
      }
    });

    // Add questions to quiz
    await addQuestionsToQuiz(quizId, questions);
    
    // Update usage
    const quiz = await getQuizRecord(quizId);
    if (quiz?.userId) {
      await incrementQuestionsGenerated(quiz.userId, questions.length);
    }
    
    // Check if quiz is complete
    const isComplete = await this.checkQuizCompletion(quizId);
    
    if (isComplete) {
      await this.finalizeQuiz(quizId);
    }
  }

  // Private methods

  private validateGenerateRequest(request: GenerateQuizRequest): void {
    if (!request.userId || typeof request.userId !== 'string') {
      throw new Error('userId is required');
    }
    
    if (!request.quizName || typeof request.quizName !== 'string' || request.quizName.trim().length === 0) {
      throw new Error('quizName is required');
    }
    
    if (typeof request.questionCount !== 'number' || ![10, 20, 30].includes(request.questionCount)) {
      throw new Error('questionCount must be 10, 20, or 30');
    }
    
    if (typeof request.minutes !== 'number' || request.minutes < 1 || request.minutes > 180) {
      throw new Error('minutes must be between 1 and 180');
    }
    
    if (!['easy', 'medium', 'hard'].includes(request.difficulty)) {
      throw new Error('difficulty must be easy, medium, or hard');
    }

    if (request.topic && (typeof request.topic !== 'string' || request.topic.trim().length === 0)) {
      throw new Error('topic must be a non-empty string if provided');
    }
  }

  private async processQuizLocal(chunks: ChunkContent[], metadata: QuizMetadata, userId: string): Promise<QuizGenerationResult> {

    
    // Create quiz record
    const quiz = await createQuizRecord({ userId, metadata });

    // Generate questions directly
    const questions = await this.generateQuestions({ chunks, metadata });

    // Complete quiz
    await completeQuiz(quiz.id, questions);
    
    // Update usage
    await incrementQuestionsGenerated(userId, questions.length);

    return {
      quizId: quiz.id,
      status: 'ready',
      questionCount: questions.length,
      message: 'Quiz generated successfully!'
    };
  }

  private async processQuizProduction(chunks: ChunkContent[], metadata: QuizMetadata, userId: string): Promise<QuizGenerationResult> {


    // Create quiz record
    const quiz = await createQuizRecord({ userId, metadata });
    
    // Distribute work to workers
    await this.spawnWorkers(chunks, metadata, quiz.id);

    return {
      quizId: quiz.id,
      status: 'processing',
      message: 'Quiz generation started! Use the quiz ID to check progress.'
    };
  }

  private async spawnWorkers(chunks: ChunkContent[], metadata: QuizMetadata, quizId: string): Promise<void> {
    const distribution = this.calculateWorkerDistribution(chunks.length, metadata.questionCount);
    const workerTasks = this.createWorkerTasks(chunks, metadata, distribution, quizId);
    
    if (!QUIZ_QUEUE_URL) {
      throw new Error('QUIZ_QUEUE_URL not configured');
    }

    const promises = workerTasks.map(async (task) => {
      const command = new SendMessageCommand({
        QueueUrl: QUIZ_QUEUE_URL,
        MessageBody: JSON.stringify(task)
      });

      await sqs.send(command);
    });

    await Promise.all(promises);
    console.log(`✅ Spawned ${workerTasks.length} workers for quiz ${quizId}`);
  }

  private calculateWorkerDistribution(chunkCount: number, questionCount: number) {
    let workerCount: number;
    
    switch (questionCount) {
      case 10: workerCount = 2; break;
      case 20: workerCount = 4; break;
      case 30: workerCount = 6; break;
      default: workerCount = Math.min(Math.ceil(questionCount / 5), 6);
    }
    
    return {
      workerCount,
      chunksPerWorker: Math.ceil(chunkCount / workerCount),
      questionsPerWorker: Math.ceil(questionCount / workerCount)
    };
  }

  private createWorkerTasks(chunks: ChunkContent[], metadata: QuizMetadata, distribution: any, quizId: string): WorkerTask[] {
    const tasks: WorkerTask[] = [];
    
    for (let i = 0; i < distribution.workerCount; i++) {
      const startIndex = i * distribution.chunksPerWorker;
      const endIndex = Math.min(startIndex + distribution.chunksPerWorker, chunks.length);
      const workerChunks = chunks.slice(startIndex, endIndex);
      
      let questionsForThisWorker = distribution.questionsPerWorker;
      if (i === distribution.workerCount - 1) {
        const questionsAllocated = distribution.questionsPerWorker * (distribution.workerCount - 1);
        questionsForThisWorker = metadata.questionCount - questionsAllocated;
      }

      tasks.push({
        quizId,
        chunks: workerChunks,
        difficulty: metadata.difficulty,
        topic: metadata.topic,
        questionCount: questionsForThisWorker,
        workerIndex: i
      });
    }

    return tasks;
  }

  private async checkQuizCompletion(quizId: string): Promise<boolean> {
    const quiz = await getQuizRecord(quizId);
    if (!quiz) return false;
    
    const currentQuestions = quiz.questions?.length || 0;
    const expectedQuestions = quiz.metadata.questionCount;
    const isComplete = currentQuestions >= expectedQuestions;
    
    return isComplete;
  }

  private async finalizeQuiz(quizId: string): Promise<void> {
    const quiz = await getQuizRecord(quizId);
    if (!quiz || !quiz.questions.length) {
      throw new Error('No questions found for finalization');
    }

    // Shuffle questions for variety
    const shuffledQuestions = [...quiz.questions].sort(() => Math.random() - 0.5);
    
    // Complete quiz
    await completeQuiz(quizId, shuffledQuestions);
    
    console.log(`✅ Quiz ${quizId} completed with ${shuffledQuestions.length} questions`);
  }

  private async retrieveChunksForQuiz(options: {
    focusArea?: string;
    questionCount: number;
    userId: string;
  }): Promise<ChunkContent[]> {
    const { focusArea, questionCount, userId } = options;
    
    // Initialize services
    await pineconeService.initialize();
    
    // Get enabled files
    const enabledFileIds = await getEnabledFileIds(userId);
    if (enabledFileIds.length === 0) {
      throw new Error('Cannot generate quiz because no files are currently enabled. Please enable at least one file from your uploaded documents.');
    }
    
    let searchResults: any[];
    
    if (focusArea) {
      // Focused search
      const [focusEmbedding] = await this.embeddingService.generateEmbeddings([focusArea]);
      const searchCount = Math.min(questionCount * 4, 100);
      
      searchResults = await pineconeService.searchChunks(focusEmbedding, {
        topK: searchCount,
        filter: { fileId: { $in: enabledFileIds } }
      }, userId);
      
      if (searchResults.length === 0) {
        throw new Error(`No content found for "${focusArea}". Try a broader search term.`);
      }
    } else {
      // Random content
      searchResults = await pineconeService.getRandomChunks(enabledFileIds, questionCount, userId);
      
      if (searchResults.length === 0) {
        throw new Error('No content available. Please check your files are processed.');
      }
    }
    
    // Transform to ChunkContent format
    return searchResults.map(result => ({
      id: result.id,
      text: result.metadata.text || 'Text not available',
      fileId: result.metadata.fileId,
      fileName: `file_${result.metadata.fileId}`
    }));
  }

  private async generateQuestions(context: {
    chunks: ChunkContent[];
    metadata: QuizMetadata;
  }): Promise<QuizQuestion[]> {
    const { chunks, metadata } = context;
    
    // Validate that we have chunks to work with
    if (!chunks || chunks.length === 0) {
      throw new Error('Cannot generate quiz because no files are currently enabled. Please enable at least one file from your uploaded documents to create a quiz.');
    }
    
    // Additional validation to ensure chunks have actual text content
    const validChunks = chunks.filter(chunk => chunk.text && chunk.text.trim().length > 0);
    if (validChunks.length === 0) {
      throw new Error('Cannot generate quiz because the selected files do not contain readable text content. Please check that your files have been processed successfully.');
    }
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const prompt = this.createQuizPrompt(validChunks, metadata);
    


    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert educational content creator. Always return valid JSON arrays as requested.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content received from OpenAI');
    }
    
    return this.parseQuizResponse(content, metadata.difficulty);
  }

  private createQuizPrompt(chunks: ChunkContent[], metadata: QuizMetadata): string {
    const difficultySpec = this.getDifficultySpec(metadata.difficulty);
    
    // Double-check that we have valid chunks before creating the prompt
    if (!chunks || chunks.length === 0) {
      throw new Error('Cannot create quiz because no document content is available. Please enable files for quiz generation.');
    }
    
    const sources = chunks.map((chunk, i) => 
      `=== Source ${i + 1}: ${chunk.fileName} ===\n${chunk.text}`
    ).join('\n\n');

    return `Create ${metadata.questionCount} ${metadata.difficulty} quiz questions testing ${difficultySpec.cognitive} from the provided content.

${difficultySpec.focus}

${metadata.topic ? `Focus: ${metadata.topic}\n` : ''}${metadata.additionalInstructions ? `Instructions: ${metadata.additionalInstructions}\n` : ''}
IMPORTANT: Generate questions in the SAME LANGUAGE as source content.

Format: JSON array with question, 4 options, correctIndex (0-3 index of correct option).

Content:
${sources}

Return only valid JSON:`;
  }

  private getDifficultySpec(difficulty: 'easy' | 'medium' | 'hard') {
    const specs = {
      easy: {
        cognitive: 'comprehension and recall',
        focus: 'Test definitions, key facts, and basic understanding. Questions should be answerable after one reading.'
      },
      medium: {
        cognitive: 'application and analysis', 
        focus: 'Test concept relationships, cause-and-effect, and application to new situations.'
      },
      hard: {
        cognitive: 'synthesis and evaluation',
        focus: 'Test critical thinking, complex problem-solving, and integration of multiple concepts.'
      }
    };
    
    return specs[difficulty];
  }

  private parseQuizResponse(gptResponse: string, difficulty: 'easy' | 'medium' | 'hard'): QuizQuestion[] {
    try {
      // Try direct JSON parse first, fallback to regex extraction
      let questions: any[];
      try {
        questions = JSON.parse(gptResponse);
      } catch {
        const jsonMatch = gptResponse.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error('No valid JSON found in GPT response');
        questions = JSON.parse(jsonMatch[0]);
      }
      
      if (!Array.isArray(questions)) {
        throw new Error('Response is not an array');
      }

      // Validate and format each question
      return questions.map((q: any, index: number) => {
        if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || 
            typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex > 3) {
          throw new Error(`Question ${index + 1} has invalid format`);
        }

        return {
          id: `q_${Date.now()}_${index}`,
          question: q.question.trim(),
          options: q.options.map((opt: string) => opt.trim()),
          correctIndex: q.correctIndex,
          difficulty: difficulty,
          topic: q.topic
        };
      });

    } catch (error) {
      console.error('Failed to parse quiz response:', error);
      throw new Error(`Failed to parse quiz questions: ${error}`);
    }
  }
}
