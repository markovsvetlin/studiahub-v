/**
 * OpenAI GPT service for quiz generation
 */

import fetch from 'node-fetch';
import { QuizQuestion } from '../../utils/quiz/database';
import { ChunkContent, PromptContext, createQuizPrompt, parseQuizResponse } from './prompts';

interface GPTResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Generate quiz questions using GPT-4o-mini
 */
export async function generateQuizQuestions(context: PromptContext): Promise<QuizQuestion[]> {
  const startTime = Date.now();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const prompt = createQuizPrompt(context);
  
  console.log(`🤖 Generating ${context.questionCount} ${context.metadata.difficulty} questions using GPT-4o-mini`);
  console.log(`📚 Processing ${context.chunks.length} chunks from ${new Set(context.chunks.map(c => c.fileName)).size} files`);

  try {
    const gptStartTime = Date.now();
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
            content: 'You are an expert educational content creator specializing in creating high-quality assessment questions. Always return valid JSON arrays as requested.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7, // Balanced creativity and consistency
        max_tokens: 4000 // Sufficient for multiple questions
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as GPTResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    const gptDuration = Date.now() - gptStartTime;
    console.log(`📝 Received GPT response in ${gptDuration}ms, parsing questions...`);
    
    const parseStartTime = Date.now();
    const questions = parseQuizResponse(content, context.chunks, context.questionCount, context.metadata.difficulty);
    const parseDuration = Date.now() - parseStartTime;
    
    const totalDuration = Date.now() - startTime;
    console.log(`✅ Generated ${questions.length} questions in ${totalDuration}ms (GPT: ${gptDuration}ms, Parse: ${parseDuration}ms)`);

    return questions;

  } catch (error) {
    console.error('❌ Failed to generate quiz questions:', error);
    throw error instanceof Error ? error : new Error('Unknown error in quiz generation');
  }
}

/**
 * Test the quiz generation with sample content
 */
export async function testQuizGeneration(): Promise<void> {
  const sampleChunks: ChunkContent[] = [
    {
      id: 'test_chunk_1',
      text: 'Machine learning is a subset of artificial intelligence that focuses on algorithms that can learn and make decisions from data without being explicitly programmed for every scenario.',
      fileId: 'test_file_1',
      fileName: 'ml_basics.pdf'
    }
  ];

  const testContext: PromptContext = {
    chunks: sampleChunks,
    metadata: {
      quizName: 'Test Quiz',
      minutes: 10,
      difficulty: 'medium',
      topic: 'Machine Learning',
      questionCount: 2
    },
    questionCount: 2
  };

  try {
    const questions = await generateQuizQuestions(testContext);
    console.log('🎯 Test quiz generation successful!');
    console.log(JSON.stringify(questions, null, 2));
  } catch (error) {
    console.error('🚨 Test quiz generation failed:', error);
    throw error;
  }
}