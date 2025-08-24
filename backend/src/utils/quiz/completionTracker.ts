/**
 * Simple completion tracking using question count check
 * Since workers run in isolated environments, we check completion 
 * by counting questions in the database
 */
import { getQuizRecord } from './database';

/**
 * Initialize completion tracking - no-op since we use database
 */
export function initializeCompletion(quizId: string, totalWorkers: number): void {
  console.log(`👥 Initialized tracking for quiz ${quizId} with ${totalWorkers} workers`);
}

/**
 * Check if quiz is complete by comparing question count to expected count
 */
export async function markWorkerCompleted(quizId: string): Promise<boolean> {
  try {
    const quiz = await getQuizRecord(quizId);
    if (!quiz) {
      console.error(`Quiz ${quizId} not found`);
      return false;
    }
    
    const currentQuestions = quiz.questions?.length || 0;
    const expectedQuestions = quiz.metadata.questionCount;
    const isComplete = currentQuestions >= expectedQuestions;
    
    if (isComplete) {
      const totalTimeMs = Date.now() - new Date(quiz.createdAt).getTime();
      console.log(`🏁 Quiz ${quizId} COMPLETED: ${currentQuestions} questions in ${totalTimeMs}ms (${(totalTimeMs/1000).toFixed(2)}s)`);
    } else {
      console.log(`👥 Quiz ${quizId}: ${currentQuestions}/${expectedQuestions} questions`);
    }
    
    return isComplete;
  } catch (error) {
    console.error(`Error checking completion for quiz ${quizId}:`, error);
    return false;
  }
}