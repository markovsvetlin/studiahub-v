import { promptBuilder } from './prompt'
import { Question } from '../../utils/quiz/database'
import { Chunk } from './chunksRetrieval'
import fetch from 'node-fetch'

/**
 * Shared GPT-4o-mini service for quiz question generation
 */
export class GPTService {
  /**
   * Call GPT-4o-mini to generate questions from chunks
   */
  static async generateQuestions(chunks: Chunk[], count: number): Promise<Question[]> {
    try {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required')
      }
      
      // Prepare chunk content
      const chunkTexts = chunks.map(chunk => chunk.content).filter(content => content.trim().length > 0)
      if (chunkTexts.length === 0) {
        throw new Error('No valid chunk content found')
      }
      
      // Build prompt
      const prompt = promptBuilder.buildQuestionPrompt(chunkTexts, count)
      
      console.log(`🤖 Calling GPT-4o-mini to generate ${count} questions from ${chunkTexts.length} chunks`)
      
      // Call OpenAI API with retry logic
      let questions: Question[] = []
      let attempts = 0
      const maxAttempts = 3
      
      while (attempts < maxAttempts && questions.length === 0) {
        attempts++
        
        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'user',
                  content: prompt
                }
              ],
              temperature: 0.7,
              max_tokens: 4000
            })
          })
          
          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`OpenAI API error (${response.status}): ${errorText}`)
          }
          
          const data = await response.json() as any
          const gptResponse = data.choices?.[0]?.message?.content
          
          if (!gptResponse) {
            throw new Error('No content in GPT response')
          }
          
          // Parse and validate response
          questions = promptBuilder.parseGPTResponse(gptResponse)
          
          console.log(`✅ GPT-4o-mini generated ${questions.length} questions (attempt ${attempts})`)
          
        } catch (error) {
          console.error(`⚠️ GPT attempt ${attempts} failed:`, error)
          
          if (attempts < maxAttempts) {
            console.log(`🔄 Retrying with modified prompt...`)
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempts - 1)))
          } else {
            throw error
          }
        }
      }
      
      if (questions.length === 0) {
        throw new Error(`Failed to generate questions after ${maxAttempts} attempts`)
      }
      
      return questions
      
    } catch (error) {
      console.error('❌ GPT question generation failed:', error)
      throw error
    }
  }
}

export const gptService = GPTService
