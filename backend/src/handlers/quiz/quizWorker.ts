/**
 * Quiz Worker - processes individual worker tasks from SQS
 */

import { SQSEvent, SQSRecord } from 'aws-lambda';
import { QuizService } from '../../services/quiz/QuizService';

const quizService = new QuizService();

/**
 * Quiz Worker Handler - processes SQS messages
 */
export async function handler(event: SQSEvent): Promise<void> {
  console.log(`👷 Processing ${event.Records.length} worker tasks`);

  // Process all messages in parallel
  const promises = event.Records.map(processWorkerTask);
  await Promise.all(promises);
}

/**
 * Process a single worker task
 */
async function processWorkerTask(record: SQSRecord): Promise<void> {
  try {
    const task = JSON.parse(record.body);
    console.log(`🚀 Processing worker task for quiz ${task.quizId}, worker ${task.workerIndex}`);
    
    await quizService.processWorkerTask(task);
    
  } catch (error) {
    console.error('Failed to process worker task:', error);
    throw error; // Let SQS handle retries
  }
}

