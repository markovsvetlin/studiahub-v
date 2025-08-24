import { useState, useEffect, useRef } from 'react'
import { generateAndWaitForQuiz, getUserQuizzes, getQuizStatus, type QuizStatus } from '../services/quiz'
import { type QuizSettings } from '../components/QuizDrawer'
import { toast } from 'sonner'

interface QuizListItem {
  quizId: string
  quizName: string
  status: 'processing' | 'ready' | 'error'
  progress: number
  questionCount: number
  createdAt: string
  completedAt?: string
  metadata?: {
    quizName: string
    questionCount: number
    minutes: number
    difficulty: 'easy' | 'medium' | 'hard'
    topic?: string
  }
  questions?: Array<{
    id: string
    question: string
    options: string[]
    correctIndex: number
    difficulty: 'easy' | 'medium' | 'hard'
    topic?: string
  }>
}

export function useQuiz(userId: string | undefined) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [quizData, setQuizData] = useState<QuizStatus | null>(null)
  const [showQuizQuestions, setShowQuizQuestions] = useState(false)
  const [showQuizSettings, setShowQuizSettings] = useState(false)
  const [userQuizzes, setUserQuizzes] = useState<QuizListItem[]>([])
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(false)
  const hasFetched = useRef(false)

  const fetchUserQuizzes = async () => {
    if (!userId || hasFetched.current) return
    
    hasFetched.current = true
    setIsLoadingQuizzes(true)
    try {
      const response = await getUserQuizzes(userId)
      setUserQuizzes(response.quizzes)
    } catch (error) {
      toast.error('Failed to load quizzes', {
        description: error instanceof Error ? error.message : 'Unable to load quiz history'
      })
      hasFetched.current = false // Reset on error
    } finally {
      setIsLoadingQuizzes(false)
    }
  }

  const deleteQuiz = async (quizId: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE
      const response = await fetch(`${apiUrl}/quiz/${quizId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to delete quiz: ${response.status}`)
      }
      
      setUserQuizzes(prev => prev.filter(quiz => quiz.quizId !== quizId))
      toast.success('Quiz deleted successfully')
    } catch (error) {
      toast.error('Failed to delete quiz', {
        description: error instanceof Error ? error.message : 'Unable to delete quiz'
      })
      throw error
    }
  }

  const retakeQuiz = (quizId: string) => {
    const quiz = userQuizzes.find(q => q.quizId === quizId)
    if (!quiz) {
      toast.error('Quiz not found')
      return
    }

    // Create QuizStatus object from existing data - no API call needed!
    const quizStatus: QuizStatus = {
      quizId: quiz.quizId,
      status: 'ready',
      progress: 100,
      metadata: quiz.metadata || {
        quizName: quiz.quizName,
        questionCount: quiz.questionCount,
        minutes: 30,
        difficulty: 'medium'
      },
      questions: quiz.questions || [],
      createdAt: quiz.createdAt,
      completedAt: quiz.completedAt
    }

    setQuizData(quizStatus)
    setShowQuizQuestions(true)
  }

  const handleGenerateQuiz = async (settings: QuizSettings) => {
    if (!userId) return
    
    setIsGenerating(true)
    
    try {
      const response = await generateAndWaitForQuiz({
        userId,
        questionCount: settings.questionCount,
        quizName: settings.quizName,
        minutes: settings.minutes,
        difficulty: settings.difficulty,
        topic: settings.topic || undefined,
        additionalInstructions: settings.additionalInstructions || undefined
      })
      
      setQuizData(response)
      setShowQuizSettings(false)
      setShowQuizQuestions(true)
      
      // Reset fetch flag and refresh quiz list
      hasFetched.current = false
      fetchUserQuizzes()
      
      toast.success('Quiz generated successfully!', {
        description: `Created ${response.questions?.length || settings.questionCount} questions`
      })
      
    } catch (error) {
      toast.error('Failed to generate quiz', {
        description: error instanceof Error ? error.message : 'Please try again or check your documents'
      })
    } finally {
      setIsGenerating(false)
    }
  }

  useEffect(() => {
    if (userId) {
      fetchUserQuizzes()
    }
  }, [userId])

  return {
    isGenerating,
    quizData,
    showQuizQuestions,
    setShowQuizQuestions,
    showQuizSettings,
    setShowQuizSettings,
    handleGenerateQuiz,
    userQuizzes,
    isLoadingQuizzes,
    deleteQuiz,
    retakeQuiz,
    fetchUserQuizzes
  }
}