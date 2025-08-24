const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://oyehv715ef.execute-api.us-east-1.amazonaws.com'

export interface GenerateQuizRequest {
  focusArea?: string
  questionCount: number
  userId?: string
}

export interface RetrievedChunk {
  id: string
  text: string
  fileId: string
  score?: number
}

export interface GenerateQuizResponse {
  chunks: RetrievedChunk[]
  focusArea?: string
  questionCount: number
  totalChunks: number
}

class QuizService {
  async generateQuiz(request: GenerateQuizRequest): Promise<GenerateQuizResponse> {
    try {
      const response = await fetch(`${API_BASE}/quiz/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        throw new Error(`Failed to generate quiz: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.ok) {
        throw new Error(data.error || 'Failed to generate quiz')
      }

      if (!data) {
        throw new Error('No quiz data received')
      }

      return data
    } catch (error) {
      console.error('Quiz generation error:', error)
      throw error instanceof Error ? error : new Error('Unknown error occurred')
    }
  }
}

export const quizService = new QuizService()
export default quizService