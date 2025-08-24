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

// Worker progress tracking removed - not needed

export interface QuizRecord {
  id: string
  userId: string
  status: 'processing' | 'ready' | 'error'
  metadata: QuizMetadata
  questions: QuizQuestion[]
  error?: string
  createdAt: string
  updatedAt?: string
  completedAt?: string
}

export interface CreateQuizRequest {
  userId: string
  metadata: QuizMetadata
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
    createdAt: now
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


// Worker progress tracking removed - using simple completion check

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

  console.log(`🎉 Quiz ${quizId} completed with ${questions.length} questions`);
}

/**
 * Mark quiz as failed
 */
export async function markQuizError(quizId: string, error: string): Promise<void> {
  const failedAt = new Date().toISOString();
  
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

  console.error(`❌ Quiz ${quizId} failed: ${error}`);
}

/**
 * Get user's quizzes (for history/listing) - simple and effective
 */
export async function getUserQuizzes(userId: string, limit = 100): Promise<QuizRecord[]> {
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