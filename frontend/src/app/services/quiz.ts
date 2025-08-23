type QuizData = {
  mode: 'specific' | 'general'
  query?: string
  questionCount: number
  userId?: string
  quizName: string
  topic: string
  minutes: number
  difficulty: 'easy' | 'medium' | 'hard';
}

type Question = {
  questionText: string
  options: string[]
  correctAnswer: number
  explanation: string
  difficulty: 'easy' | 'medium' | 'hard'
}

type QuizStatus = {
  id: string
  mode: 'specific' | 'general'
  query?: string
  status: 'generating' | 'ready' | 'error'
  progress: number
  questionCount: number
  questions?: Question[]
  createdAt: string
  updatedAt: string
  error?: string
  estimatedTimeRemaining?: string
}

const apiUrl = process.env.NEXT_PUBLIC_API_BASE

const generateQuiz = async (quizData: QuizData) => {
  const response = await fetch(`${apiUrl}/quiz/generate`, {
    method: 'POST',
    body: JSON.stringify(quizData),
    headers: {
      'Content-Type': 'application/json'
    }
  })
  const data = await response.json()
  console.log('🚀 Quiz generation started:', data)
  return data
}

const getQuizStatus = async (quizId: string): Promise<QuizStatus> => {
  const response = await fetch(`${apiUrl}/quiz/${quizId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  
  if (!response.ok) {
    throw new Error(`Failed to get quiz status: ${response.status}`)
  }
  
  const data = await response.json()
  return data
}

const waitForQuizCompletion = async (quizId: string, maxWaitTime: number = 60000): Promise<QuizStatus> => {
  const startTime = Date.now()
  const pollInterval = 2000 // Check every 2 seconds
  
  console.log(`⏳ Waiting for quiz ${quizId} to complete...`)
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const status = await getQuizStatus(quizId)
      console.log(`📊 Quiz progress: ${status.progress}% (${status.status})`)
      
      if (status.status === 'ready') {
        console.log('✅ Quiz completed successfully!')
        console.log('📝 Questions:', status.questions)
        return status
      }
      
      if (status.status === 'error') {
        console.error('❌ Quiz generation failed:', status.error)
        throw new Error(`Quiz generation failed: ${status.error}`)
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    } catch (error) {
      console.error('Error checking quiz status:', error)
      throw error
    }
  }
  
  throw new Error('Quiz generation timed out')
}

const generateAndWaitForQuiz = async (quizData: QuizData): Promise<QuizStatus> => {
  // Step 1: Start quiz generation
  const generateResponse = await generateQuiz(quizData)
  
  if (!generateResponse.quizId) {
    throw new Error('No quiz ID returned from generation')
  }
  
  // Step 2: Wait for completion and get questions
  const completedQuiz = await waitForQuizCompletion(generateResponse.quizId)
  
  return completedQuiz
}

export { 
  generateQuiz, 
  getQuizStatus, 
  waitForQuizCompletion, 
  generateAndWaitForQuiz,
  type QuizData,
  type Question,
  type QuizStatus
}