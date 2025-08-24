'use client'
import { useState, useEffect } from 'react'
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle 
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Trophy,
  X
} from 'lucide-react'
import { type Question, type QuizStatus } from '../services/quiz'

interface QuizQuestionsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  quizData: QuizStatus | null
}

type UserAnswers = Record<string, number>

export default function QuizQuestions({ 
  open, 
  onOpenChange, 
  quizData 
}: QuizQuestionsProps) {
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize quiz state when drawer opens
  useEffect(() => {
    if (open && quizData && !isInitialized) {
      setTimeLeft(quizData.metadata.minutes * 60)
      setUserAnswers({})
      setShowResults(false)
      setIsSubmitted(false)
      setIsInitialized(true)
    } else if (!open) {
      setIsInitialized(false)
      setIsSubmitted(false)
      setShowResults(false)
      setTimeLeft(0)
      setUserAnswers({})
    }
  }, [open, quizData])

  // Timer countdown - separate effect
  useEffect(() => {
    if (!open || !isInitialized || isSubmitted || timeLeft <= 0) {
      return
    }

    const timer = setTimeout(() => {
      setTimeLeft(prev => {
        const newTime = prev - 1
        if (newTime === 0) {
          // Auto-submit when timer reaches zero
          setTimeout(() => {
            setIsSubmitted(true)
            setShowResults(true)
          }, 100)
        }
        return newTime
      })
    }, 1000)

    return () => clearTimeout(timer)
  }, [timeLeft, open, isInitialized, isSubmitted])

  const questions = quizData?.questions || []
  
  const handleAnswerSelect = (questionId: string, answerIndex: number) => {
    if (isSubmitted) return
    setUserAnswers(prev => ({ ...prev, [questionId]: answerIndex }))
  }

  const handleSubmit = () => {
    setIsSubmitted(true)
    setShowResults(true)
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  const isAllAnswered = questions.length > 0 && questions.every(q => userAnswers[q.id] !== undefined)
  const correctAnswers = questions.filter(q => userAnswers[q.id] === q.correctIndex).length
  const score = questions.length > 0 ? Math.round((correctAnswers / questions.length) * 100) : 0

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-green-500/20 text-green-300 border-green-500/30'
    if (score >= 60) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
    return 'bg-red-500/20 text-red-300 border-red-500/30'
  }

  if (!quizData || !questions.length) {
    return null
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl p-0 overflow-hidden" side="right">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="p-6 border-b border-neutral-800 bg-neutral-900/50">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-xl font-semibold text-white">
                  {quizData.metadata.quizName}
                </SheetTitle>
                <SheetDescription className="text-neutral-400">
                  {questions.length} questions • {quizData.metadata.difficulty} difficulty
                </SheetDescription>
              </div>
              
              {!showResults && !isInitialized && open && (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-neutral-400">Initializing quiz...</span>
                </div>
              )}

              {!showResults && isInitialized && (
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Clock className={`w-5 h-5 ${timeLeft < 60 ? 'text-red-400' : timeLeft < 300 ? 'text-yellow-400' : 'text-green-400'}`} />
                    <span className={`font-mono text-lg font-semibold ${
                      timeLeft < 60 ? 'text-red-400' : 
                      timeLeft < 300 ? 'text-yellow-400' : 
                      'text-green-400'
                    }`}>
                      {formatTime(timeLeft)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-neutral-400">Progress:</span>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={(Object.keys(userAnswers).length / questions.length) * 100} 
                        className="w-32 h-3"
                      />
                      <span className="text-sm font-medium text-neutral-300 min-w-[3rem]">
                        {Object.keys(userAnswers).length}/{questions.length}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {showResults && (
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={getScoreBadgeColor(score)}>
                    <Trophy className="w-3 h-3 mr-1" />
                    {score}% ({correctAnswers}/{questions.length})
                  </Badge>
                </div>
              )}
            </div>
          </SheetHeader>

          {/* Questions */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {isInitialized && questions.map((question, index) => (
              <Card key={question.id} className="border-neutral-800 bg-neutral-900/30">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Question Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <Badge variant="outline" className="text-xs">
                            Q{index + 1}
                          </Badge>
                          <Badge variant="secondary" className="text-xs capitalize">
                            {question.difficulty}
                          </Badge>
                        </div>
                        <p className="text-white font-medium leading-relaxed">
                          {question.question}
                        </p>
                      </div>
                      
                      {/* Result indicator */}
                      {showResults && (
                        <div className="flex-shrink-0">
                          {userAnswers[question.id] === question.correctIndex ? (
                            <CheckCircle2 className="w-6 h-6 text-green-400" />
                          ) : (
                            <XCircle className="w-6 h-6 text-red-400" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Options */}
                    <div className="grid gap-3">
                      {question.options.map((option, optionIndex) => {
                        const isSelected = userAnswers[question.id] === optionIndex
                        const isCorrect = optionIndex === question.correctIndex
                        
                        let optionStyles = "p-4 rounded-lg border text-left transition-all duration-200 cursor-pointer hover:border-neutral-600"
                        
                        if (showResults) {
                          if (isCorrect) {
                            optionStyles += " bg-green-500/10 border-green-500/30 text-green-300"
                          } else if (isSelected && !isCorrect) {
                            optionStyles += " bg-red-500/10 border-red-500/30 text-red-300"
                          } else {
                            optionStyles += " bg-neutral-800/30 border-neutral-700 text-neutral-300"
                          }
                        } else if (isSelected) {
                          optionStyles += " bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                        } else {
                          optionStyles += " bg-neutral-800/50 border-neutral-700 text-neutral-300 hover:bg-neutral-800/70"
                        }

                        return (
                          <button
                            key={optionIndex}
                            className={optionStyles}
                            onClick={() => handleAnswerSelect(question.id, optionIndex)}
                            disabled={isSubmitted}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-semibold ${
                                showResults && isCorrect ? 'border-green-400 bg-green-400/20 text-green-300' :
                                showResults && isSelected && !isCorrect ? 'border-red-400 bg-red-400/20 text-red-300' :
                                isSelected ? 'border-indigo-400 bg-indigo-400/20 text-indigo-300' :
                                'border-neutral-500 text-neutral-400'
                              }`}>
                                {String.fromCharCode(65 + optionIndex)}
                              </div>
                              <span className="flex-1">{option}</span>
                              {showResults && isCorrect && (
                                <CheckCircle2 className="w-4 h-4 text-green-400" />
                              )}
                              {showResults && isSelected && !isCorrect && (
                                <XCircle className="w-4 h-4 text-red-400" />
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {/* Question metadata */}
                    {question.fileReference && (
                      <div className="pt-2 border-t border-neutral-800">
                        <p className="text-xs text-neutral-500">
                          Source: {question.fileReference.fileName}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-neutral-800 bg-neutral-900/50">
            {!isInitialized && open && (
              <div className="flex items-center justify-center">
                <span className="text-neutral-400">Loading quiz...</span>
              </div>
            )}
            {isInitialized && showResults ? (
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-neutral-400">Final Score:</span>
                    <span className={`text-lg font-semibold ${getScoreColor(score)}`}>
                      {score}%
                    </span>
                    <span className="text-sm text-neutral-500">
                      ({correctAnswers} out of {questions.length} correct)
                    </span>
                  </div>
                  {score >= 80 && (
                    <p className="text-sm text-green-400">Excellent work! 🎉</p>
                  )}
                  {score >= 60 && score < 80 && (
                    <p className="text-sm text-yellow-400">Good job! Keep studying! 📚</p>
                  )}
                  {score < 60 && (
                    <p className="text-sm text-red-400">Keep practicing! You'll get there! 💪</p>
                  )}
                </div>
                <Button 
                  onClick={handleClose}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <X className="w-4 h-4 mr-2" />
                  Close Quiz
                </Button>
              </div>
            ) : isInitialized && !showResults ? (
              <div className="flex items-center justify-between">
                <div className="text-sm text-neutral-400">
                  {Object.keys(userAnswers).length} of {questions.length} questions answered
                </div>
                <Button 
                  onClick={handleSubmit}
                  disabled={!isAllAnswered}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Quiz
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}