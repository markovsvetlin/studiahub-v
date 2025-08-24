import { useState } from 'react'
import { generateAndWaitForQuiz, type QuizStatus } from '../services/quiz'
import { type QuizSettings } from '../components/QuizDrawer'
import { toast } from 'sonner'

export function useQuiz(userId: string | undefined) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [quizData, setQuizData] = useState<QuizStatus | null>(null)
  const [showQuizQuestions, setShowQuizQuestions] = useState(false)
  const [showQuizSettings, setShowQuizSettings] = useState(false)

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

  return {
    isGenerating,
    quizData,
    showQuizQuestions,
    setShowQuizQuestions,
    showQuizSettings,
    setShowQuizSettings,
    handleGenerateQuiz
  }
}