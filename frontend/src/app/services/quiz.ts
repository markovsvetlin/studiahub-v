type QuizData = {
  userId: string
  questionCount: number
  quizName: string
  minutes: number
  difficulty: 'easy' | 'medium' | 'hard'
  topic?: string
  additionalInstructions?: string
}

type Question = {
  id: string
  question: string
  options: string[]
  correctIndex: number
  difficulty: 'easy' | 'medium' | 'hard'
  topic?: string
  confidence?: number
  timeEstimate?: number
  fileReference?: {
    fileId: string
    fileName: string
    chunkId: string
  }
}

type QuizStatus = {
  quizId: string
  status: 'processing' | 'ready' | 'error'
  progress: number
  metadata: {
    quizName: string
    questionCount: number
    minutes: number
    difficulty: 'easy' | 'medium' | 'hard'
    topic?: string
  }
  questions?: Question[]
  workers?: {
    total: number
    completed: number
  }
  createdAt: string
  updatedAt?: string
  completedAt?: string
  error?: string
}

const apiUrl = process.env.NEXT_PUBLIC_API_BASE

const generateQuiz = async (quizData: QuizData & { getToken: () => Promise<string | null> }) => {

  
  const { getToken, ...actualQuizData } = quizData
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  // Add Authorization header with Clerk JWT token
  const token = await getToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${apiUrl}/quiz/generate`, {
    method: 'POST',
    body: JSON.stringify(actualQuizData),
    headers
  })
  
  const data = await response.json()
  
  // Check for API errors (including usage limit exceeded)
  if (!response.ok || !data.ok) {
    const errorMessage = data.message || `Quiz generation failed: ${response.status}`
    console.error('❌ Quiz generation API error:', errorMessage)
    throw new Error(errorMessage)
  }
  

  return data
}

const getQuizStatus = async (quizId: string): Promise<QuizStatus> => {
  const response = await fetch(`${apiUrl}/quiz/${quizId}/status`, {
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

const waitForQuizCompletion = async (
  quizId: string, 
  maxWaitTime: number = 120000,
  onProgress?: (status: QuizStatus) => void
): Promise<QuizStatus> => {
  const startTime = Date.now()
  const pollInterval = 3000 // Check every 3 seconds
  

  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const status = await getQuizStatus(quizId)
      // const progressInfo = status.workers 
      //   ? `${status.progress}% (${status.workers.completed}/${status.workers.total} workers completed)`
      //   : `${status.progress}%`
      

      
      // Call progress callback if provided
      if (onProgress) {
        onProgress(status)
      }
      
      if (status.status === 'ready') {
        console.log(`✅ Quiz completed successfully! Generated ${status.questions?.length || 0} questions`)
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

const generateAndWaitForQuiz = async (
  quizData: QuizData & { getToken: () => Promise<string | null> },
  onProgress?: (status: QuizStatus) => void
): Promise<QuizStatus> => {

  const generateResponse = await generateQuiz(quizData)
  
  if (!generateResponse.quizId) {
    throw new Error('No quiz ID returned from generation')
  }
  
  // Step 2: Wait for completion and get questions
  const completedQuiz = await waitForQuizCompletion(generateResponse.quizId, 120000, onProgress)
  
  return completedQuiz
}

interface UserQuizzesResponse {
  userId: string;
  quizzes: Array<{
    quizId: string;
    quizName: string;
    status: 'processing' | 'ready' | 'error';
    progress: number;
    questionCount: number;
    createdAt: string;
    completedAt?: string;
    metadata?: {
      quizName: string;
      questionCount: number;
      minutes: number;
      difficulty: 'easy' | 'medium' | 'hard';
      topic?: string;
    };
    questions?: Question[];
  }>;
}

const getUserQuizzes = async (getToken: () => Promise<string | null>, limit: number = 100): Promise<UserQuizzesResponse> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  // Add Authorization header with Clerk JWT token
  const token = await getToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${apiUrl}/quiz/user?limit=${limit}`, {
    method: 'GET',
    headers
  })
  
  if (!response.ok) {
    throw new Error(`Failed to get user quizzes: ${response.status}`)
  }
  
  const data = await response.json()
  return data
}

export { 
  generateQuiz, 
  getQuizStatus, 
  waitForQuizCompletion, 
  generateAndWaitForQuiz,
  getUserQuizzes,
  type QuizData,
  type Question,
  type QuizStatus
}