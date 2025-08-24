/**
 * Quiz Worker - processes individual worker tasks from SQS
 */

import { SQSEvent, SQSRecord } from 'aws-lambda';
import { generateQuizQuestions } from '../../services/quiz/gpt';
import { ChunkContent } from '../../services/quiz/prompts';
import { 
  getQuizRecord, 
  addQuestionsToQuiz, 
  updateWorkerProgress,
  completeQuiz,
  markQuizError,
  QuizMetadata 
} from '../../utils/quiz/database';

interface WorkerTask {
  quizId: string
  chunks: ChunkContent[]
  metadata: QuizMetadata
  questionCount: number
  workerIndex: number
}

/**
 * Quiz Worker Handler - processes SQS messages
 */
export async function handler(event: SQSEvent): Promise<void> {
  console.log(`👷 Quiz worker processing ${event.Records.length} tasks`);

  // Process all messages in parallel
  const promises = event.Records.map(async (record, index) => {
    try {
      console.log(`🚀 Starting worker task ${index + 1}/${event.Records.length}`);
      await processWorkerTask(record);
      console.log(`✅ Completed worker task ${index + 1}/${event.Records.length}`);
    } catch (error) {
      console.error(`❌ Failed to process worker task ${index + 1}/${event.Records.length}:`, error);
      // Let SQS handle retry via DLQ configuration
      throw error;
    }
  });

  await Promise.all(promises);
  console.log(`✅ Quiz worker handler completed processing ${event.Records.length} tasks`);
}

/**
 * Process a single worker task
 */
async function processWorkerTask(record: SQSRecord): Promise<void> {
  const workerStartTime = Date.now();
  let task: WorkerTask;
  try {
    task = JSON.parse(record.body);
  } catch {
    console.error('Invalid task JSON in SQS message');
    return; // Don't retry invalid JSON
  }
  
  const { quizId, chunks, metadata, questionCount, workerIndex } = task;
  console.log(`🔨 Worker ${workerIndex}: ${chunks.length} chunks, ${questionCount} questions (${metadata.difficulty}) - ${new Date().toISOString()}`);

  try {
    // Generate questions
    console.log(`🔄 Worker ${workerIndex} starting question generation...`);
    const gptStart = Date.now();
    const questions = await generateQuizQuestions({ chunks, metadata, questionCount });
    const gptDuration = Date.now() - gptStart;
    console.log(`📝 Worker ${workerIndex} generated ${questions.length} questions in ${gptDuration}ms`);

    // Add questions and update worker progress
    const dbStart = Date.now();
    await addQuestionsToQuiz(quizId, questions);
    const { completed, total, isAllComplete } = await updateWorkerProgress(quizId);
    const dbDuration = Date.now() - dbStart;
    console.log(`💾 Worker ${workerIndex} database operations: ${dbDuration}ms`);
    
    const workerDurationMs = Date.now() - workerStartTime;
    console.log(`👥 Worker ${workerIndex} completed (${completed}/${total}) in ${workerDurationMs}ms`);

    if (isAllComplete) {
      await finalizeQuiz(quizId);
    }

  } catch (error) {
    const workerDurationMs = Date.now() - workerStartTime;
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Worker ${workerIndex} failed after ${workerDurationMs}ms:`, message);
    
    // Only mark quiz as failed for non-retryable errors
    if (error instanceof Error && !error.message.includes('timeout')) {
      await markQuizError(quizId, `Worker ${workerIndex}: ${message}`);
    }
    throw error;
  }
}


/**
 * Finalize quiz when all workers are complete
 */
async function finalizeQuiz(quizId: string): Promise<void> {
  console.log(`🏁 Finalizing quiz ${quizId}...`);

  try {
    const quiz = await getQuizRecord(quizId);
    if (!quiz || !quiz.questions.length) {
      throw new Error('No questions found for finalization');
    }

    // Shuffle questions for variety
    const shuffledQuestions = [...quiz.questions].sort(() => Math.random() - 0.5);
    
    // Complete quiz (this will log the total duration)
    await completeQuiz(quizId, shuffledQuestions);
    
    console.log(`🎯 Final quiz stats - Questions: ${shuffledQuestions.length}`);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Finalization failed';
    console.error(`❌ Finalization failed:`, message);
    await markQuizError(quizId, message);
    throw error;
  }
}

