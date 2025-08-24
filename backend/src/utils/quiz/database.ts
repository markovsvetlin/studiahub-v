/**
 * Quiz database utilities
 */

import { PutCommand, UpdateCommand, GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db';
import { QUIZ_TABLE } from '../constants';

// Types and Interfaces
export interface QuizQuestion {
  id: string
  question: string
  options: string[] // 4 options
  correctIndex: number // 0-3, index of correct option
  difficulty: 'easy' | 'medium' | 'hard'
  topic?: string
}

export interface QuizMetadata {
  quizName: string
  minutes: number
  difficulty: 'easy' | 'medium' | 'hard'
  topic?: string
  additionalInstructions?: string
  questionCount: number
}

export interface WorkerProgress {
  completed: number
  total: number
  failed?: number
}

export interface QuizRecord {
  id: string
  userId: string
  status: 'processing' | 'ready' | 'error'
  metadata: QuizMetadata
  questions: QuizQuestion[]
  workers?: WorkerProgress
  error?: string
  createdAt: string
  updatedAt?: string
  completedAt?: string
  startedAt?: string // When processing actually started
}

export interface CreateQuizRequest {
  userId: string
  metadata: QuizMetadata
  estimatedWorkers?: number
}

/**
 * Create a new quiz record
 */
export async function createQuizRecord(request: CreateQuizRequest): Promise<QuizRecord> {
  const now = new Date().toISOString();
  const record: QuizRecord = {
    id: uuidv4(),
    userId: request.userId,
    status: 'processing',
    metadata: request.metadata,
    questions: [],
    workers: request.estimatedWorkers ? {
      completed: 0,
      total: request.estimatedWorkers,
      failed: 0
    } : undefined,
    createdAt: now,
    startedAt: now
  };
  
  await db.send(new PutCommand({
    TableName: QUIZ_TABLE,
    Item: record
  }));
  
  console.log(`✅ Created quiz record: ${record.id}`);
  return record;
}

/**
 * Get quiz record by ID
 */
export async function getQuizRecord(quizId: string): Promise<QuizRecord | null> {
  const result = await db.send(new GetCommand({
    TableName: QUIZ_TABLE,
    Key: { id: quizId }
  }));
  
  return (result.Item as QuizRecord) || null;
}


/**
 * Update worker progress atomically and return current state
 */
export async function updateWorkerProgress(quizId: string): Promise<{ completed: number; total: number; isAllComplete: boolean }> {
  try {
    const result = await db.send(new UpdateCommand({
      TableName: QUIZ_TABLE,
      Key: { id: quizId },
      UpdateExpression: 'SET workers.completed = workers.completed + :inc, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':inc': 1,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    }));

    const quiz = result.Attributes as QuizRecord;
    const { completed, total } = quiz.workers!;
    
    console.log(`👥 Worker progress updated for quiz ${quizId}: ${completed}/${total} (${Math.round((completed/total)*100)}%)`);
    
    return {
      completed,
      total,
      isAllComplete: completed >= total
    };
  } catch (error) {
    console.error(`❌ Failed to update worker progress for quiz ${quizId}:`, error);
    throw error;
  }
}

/**
 * Add questions to quiz atomically (prevents race conditions between workers)
 */
export async function addQuestionsToQuiz(quizId: string, newQuestions: QuizQuestion[]): Promise<void> {
  if (!newQuestions.length) return;
  
  await db.send(new UpdateCommand({
    TableName: QUIZ_TABLE,
    Key: { id: quizId },
    UpdateExpression: 'SET questions = list_append(if_not_exists(questions, :empty_list), :newQuestions), updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':newQuestions': newQuestions,
      ':empty_list': [],
      ':updatedAt': new Date().toISOString()
    }
  }));

  console.log(`📝 Added ${newQuestions.length} questions to quiz ${quizId}`);
}

/**
 * Complete quiz (set all questions and mark as ready)
 */
export async function completeQuiz(quizId: string, questions: QuizQuestion[]): Promise<void> {
  const completedAt = new Date().toISOString();
  
  // Get the quiz record to calculate duration
  const quiz = await getQuizRecord(quizId);
  let durationLog = '';
  if (quiz?.startedAt) {
    const startTime = new Date(quiz.startedAt).getTime();
    const endTime = new Date(completedAt).getTime();
    const durationMs = endTime - startTime;
    const durationSeconds = (durationMs / 1000).toFixed(2);
    durationLog = ` in ${durationMs}ms (${durationSeconds}s)`;
  }
  
  await db.send(new UpdateCommand({
    TableName: QUIZ_TABLE,
    Key: { id: quizId },
    UpdateExpression: 'SET questions = :questions, #status = :status, completedAt = :completedAt, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':questions': questions,
      ':status': 'ready',
      ':completedAt': completedAt,
      ':updatedAt': new Date().toISOString()
    }
  }));

  console.log(`🎉 Quiz ${quizId} completed with ${questions.length} questions${durationLog}`);
}

/**
 * Mark quiz as failed
 */
export async function markQuizError(quizId: string, error: string): Promise<void> {
  const failedAt = new Date().toISOString();
  
  // Get the quiz record to calculate duration
  const quiz = await getQuizRecord(quizId);
  let durationLog = '';
  if (quiz?.startedAt) {
    const startTime = new Date(quiz.startedAt).getTime();
    const endTime = new Date(failedAt).getTime();
    const durationMs = endTime - startTime;
    const durationSeconds = (durationMs / 1000).toFixed(2);
    durationLog = ` after ${durationMs}ms (${durationSeconds}s)`;
  }
  
  await db.send(new UpdateCommand({
    TableName: QUIZ_TABLE,
    Key: { id: quizId },
    UpdateExpression: 'SET #status = :status, error = :error, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': 'error',
      ':error': error,
      ':updatedAt': failedAt
    }
  }));

  console.error(`❌ Quiz ${quizId} failed${durationLog}: ${error}`);
}

/**
 * Get user's quizzes (for history/listing)
 */
export async function getUserQuizzes(userId: string, limit = 20): Promise<QuizRecord[]> {
  const result = await db.send(new QueryCommand({
    TableName: QUIZ_TABLE,
    IndexName: 'user-index',
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    },
    ScanIndexForward: false,
    Limit: limit
  }));

  return (result.Items as QuizRecord[]) || [];
}