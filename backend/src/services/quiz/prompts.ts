/**
 * High-quality GPT prompts for quiz generation
 */

import { QuizQuestion, QuizMetadata } from '../../utils/quiz/database';

export interface ChunkContent {
  id: string
  text: string
  fileId: string
  fileName: string
}

export interface PromptContext {
  chunks: ChunkContent[]
  metadata: QuizMetadata
  questionCount: number
}

/**
 * Generate concise, focused prompts for educational quiz creation
 */
export function createQuizPrompt(context: PromptContext): string {
  const { chunks, metadata, questionCount } = context;
  const { difficulty, topic, additionalInstructions } = metadata;

  const difficultySpec = DIFFICULTY_SPECS[difficulty];
  const sources = chunks.map((chunk, i) => 
    `=== Source ${i + 1}: ${chunk.fileName} ===\n${chunk.text}`
  ).join('\n\n');

  return `Create ${questionCount} ${difficulty} quiz questions testing ${difficultySpec.cognitive} from the provided content.

${difficultySpec.focus}

${topic ? `Focus: ${topic}\n` : ''}${additionalInstructions ? `Instructions: ${additionalInstructions}\n` : ''}
IMPORTANT: Generate questions in the SAME LANGUAGE as source content. Match the language exactly.

Format: JSON array with question, 4 options, correctIndex (0-3 index of correct option).

Content:
${sources}

Return only valid JSON:`;
}


/**
 * Difficulty specifications - concise and focused
 */
const DIFFICULTY_SPECS = {
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
} as const;

/**
 * Parse GPT response and validate question format
 */
export function parseQuizResponse(
  gptResponse: string, 
  chunks: ChunkContent[], 
  expectedCount: number
): QuizQuestion[] {
  try {
    // Clean the response - remove any markdown or extra text
    const jsonMatch = gptResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No valid JSON array found in GPT response');
    }

    const questions = JSON.parse(jsonMatch[0]);
    
    if (!Array.isArray(questions)) {
      throw new Error('Response is not an array');
    }

    if (questions.length !== expectedCount) {
      console.warn(`Expected ${expectedCount} questions, got ${questions.length}`);
    }

    // Validate and enhance each question
    return questions.map((q: any, index: number) => {
      if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) {
        throw new Error(`Question ${index + 1} has invalid format`);
      }

      if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex > 3) {
        throw new Error(`Question ${index + 1} has invalid correctIndex: ${q.correctIndex}`);
      }

      return {
        id: `q_${Date.now()}_${index}`,
        question: q.question.trim(),
        options: q.options.map((opt: string) => opt.trim()),
        correctIndex: q.correctIndex,
        difficulty: q.difficulty || 'medium',
        topic: q.topic
      } as QuizQuestion;
    });

  } catch (error) {
    console.error('Failed to parse quiz response:', error);
    console.error('GPT Response:', gptResponse);
    throw new Error(`Failed to parse quiz questions: ${error}`);
  }
}