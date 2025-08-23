import { Question } from '../../utils/quiz/database'

export interface GPTResponse {
  questions: Question[]
}

export class PromptBuilder {
  /**
   * Build a prompt for GPT-4o to generate quiz questions from chunks
   */
  buildQuestionPrompt(chunks: string[], count: number): string {
    const chunksText = chunks.map((chunk, index) => `CHUNK ${index + 1}:\n${chunk}`).join('\n\n---\n\n')
    
    return `You are an expert educator creating study questions. Generate exactly ${count} high-quality multiple-choice questions based on the following content.

CONTENT:
${chunksText}

REQUIREMENTS:
1. Each question must have exactly 4 options (labeled A, B, C, D)
2. Only one option should be correct
3. Questions should test understanding, not memorization
4. Vary difficulty levels (easy, medium, hard)
5. Include clear explanations for why the correct answer is right
6. Make incorrect options plausible but clearly wrong
7. Questions should be based on the provided content, not general knowledge
8. Each question should be self-contained and clear
9. Generate ALL questions, options, and explanations in the same language as the provided content

Return your response in the following JSON format:
{
  "questions": [
    {
      "questionText": "What is the main concept discussed in the content?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Option A is correct because...",
      "difficulty": "medium"
    }
  ]
}

Generate exactly ${count} questions. Do not include any text before or after the JSON.`
  }

  /**
   * Parse GPT-4o response and validate the question format
   */
  parseGPTResponse(response: string): Question[] {
    try {
      // Clean the response - remove any markdown code blocks or extra text
      const cleanedResponse = this.cleanJSONResponse(response)
      
      const parsed: GPTResponse = JSON.parse(cleanedResponse)
      
      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error('Invalid response format: missing questions array')
      }

      // Validate each question
      const validatedQuestions = parsed.questions.map((question, index) => {
        this.validateQuestion(question, index)
        return question
      })

      return validatedQuestions
    } catch (error) {
      console.error('Failed to parse GPT response:', error)
      console.error('Raw response:', response)
      throw new Error(`Failed to parse GPT response: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Clean JSON response by removing markdown code blocks and extra text
   */
  private cleanJSONResponse(response: string): string {
    // Remove markdown code blocks
    let cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    
    // Find the JSON object (starts with { and ends with })
    const startIndex = cleaned.indexOf('{')
    const lastIndex = cleaned.lastIndexOf('}')
    
    if (startIndex === -1 || lastIndex === -1) {
      throw new Error('No valid JSON found in response')
    }
    
    cleaned = cleaned.substring(startIndex, lastIndex + 1)
    
    return cleaned.trim()
  }

  /**
   * Validate a single question structure
   */
  private validateQuestion(question: any, index: number): void {
    const errors: string[] = []

    // Check required fields
    if (typeof question.questionText !== 'string' || question.questionText.trim() === '') {
      errors.push('questionText must be a non-empty string')
    }

    if (!Array.isArray(question.options)) {
      errors.push('options must be an array')
    } else {
      if (question.options.length !== 4) {
        errors.push('options must contain exactly 4 items')
      }
      
      if (question.options.some((option: any) => typeof option !== 'string' || option.trim() === '')) {
        errors.push('all options must be non-empty strings')
      }

      // Check for duplicate options
      const uniqueOptions = new Set(question.options.map((opt: string) => opt.trim().toLowerCase()))
      if (uniqueOptions.size !== 4) {
        errors.push('all options must be unique')
      }
    }

    if (typeof question.correctAnswer !== 'number' || 
        question.correctAnswer < 0 || 
        question.correctAnswer > 3 || 
        !Number.isInteger(question.correctAnswer)) {
      errors.push('correctAnswer must be an integer between 0 and 3')
    }

    if (typeof question.explanation !== 'string' || question.explanation.trim() === '') {
      errors.push('explanation must be a non-empty string')
    }

    if (!['easy', 'medium', 'hard'].includes(question.difficulty)) {
      errors.push('difficulty must be "easy", "medium", or "hard"')
    }

    if (errors.length > 0) {
      throw new Error(`Question ${index + 1} validation failed: ${errors.join(', ')}`)
    }
  }

  /**
   * Create a retry prompt when the first attempt fails
   */
  buildRetryPrompt(chunks: string[], count: number, previousError: string): string {
    return `Previous attempt failed with error: ${previousError}

Please try again with more careful attention to the JSON format.

${this.buildQuestionPrompt(chunks, count)}

CRITICAL: Ensure your response is valid JSON with no extra text before or after the JSON object.`
  }
}

export const promptBuilder = new PromptBuilder()
