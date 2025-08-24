/**
 * Quiz Worker - processes individual worker tasks from SQS
 */

import { SQSEvent, SQSRecord } from 'aws-lambda';
import { generateQuizQuestions } from '../../services/quiz/gpt';
import { ChunkContent } from '../../services/quiz/prompts';
import { 
  getQuizRecord, 
  addQuestionsToQuiz,
  completeQuiz,
  markQuizError,
  QuizMetadata 
} from '../../utils/quiz/database';
import { markWorkerCompleted } from '../../utils/quiz/completionTracker';

interface WorkerTask {
  quizId: string
  chunks: ChunkContent[]
  difficulty: 'easy' | 'medium' | 'hard'
  topic?: string
  questionCount: number
  workerIndex: number
}

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
  const workerStartTime = Date.now();
  let task: WorkerTask;
  try {
    task = JSON.parse(record.body);
    console.log(`🚀 Processing worker task for quiz ${task.quizId}, worker ${task.workerIndex}`);
  } catch {
    console.error('Invalid task JSON in SQS message');
    return; // Don't retry invalid JSON
  }
  
  const { quizId, chunks, difficulty, topic, questionCount, workerIndex } = task;

  try {
    // Generate questions using GPT
    const gptStartTime = Date.now();
    const metadata = { 
      difficulty, 
      topic, 
      questionCount, 
      quizName: '', // Not needed for question generation
      minutes: 0 // Not needed for question generation
    };
    const questions = await generateQuizQuestions({ chunks, metadata, questionCount });
    const gptDuration = Date.now() - gptStartTime;

    // Add questions to quiz
    const dbStartTime = Date.now();
    await addQuestionsToQuiz(quizId, questions);
    const dbDuration = Date.now() - dbStartTime;
    
    // Check if all workers are complete
    const isAllComplete = await markWorkerCompleted(quizId);
    
    const workerDurationMs = Date.now() - workerStartTime;
    console.log(`✅ Worker ${workerIndex}: ${questions.length} questions | GPT: ${gptDuration}ms | DB: ${dbDuration}ms | Total: ${workerDurationMs}ms`);

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
  const finalizeStartTime = Date.now();
  console.log(`🏁 Starting finalization for quiz ${quizId}`);
  
  try {
    const quiz = await getQuizRecord(quizId);
    if (!quiz || !quiz.questions.length) {
      throw new Error('No questions found for finalization');
    }

    // Shuffle questions for variety
    const shuffledQuestions = [...quiz.questions].sort(() => Math.random() - 0.5);
    
    // Complete quiz
    await completeQuiz(quizId, shuffledQuestions);
    
    const finalizeDuration = Date.now() - finalizeStartTime;
    console.log(`✅ Quiz ${quizId} finalization completed in ${finalizeDuration}ms`);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Finalization failed';
    console.error(`❌ Finalization failed:`, message);
    await markQuizError(quizId, message);
    throw error;
  }
}

