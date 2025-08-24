'use client'
import { useState } from 'react'
import { 
  Calendar,
  Trash2,
  Loader2,
  Brain,
  PlayCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface QuizListItem {
  quizId: string
  quizName: string
  status: 'processing' | 'ready' | 'error'
  progress: number
  questionCount: number
  createdAt: string
  completedAt?: string
}

interface QuizListProps {
  quizzes: QuizListItem[]
  isLoading: boolean
  onDeleteQuiz: (quizId: string) => Promise<void>
  onRetakeQuiz: (quizId: string) => void
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
  
  if (diffInHours < 1) {
    const minutes = Math.floor(diffInHours * 60)
    return `${minutes}m ago`
  } else if (diffInHours < 24) {
    return `${Math.floor(diffInHours)}h ago`
  } else if (diffInHours < 168) { // 7 days
    return `${Math.floor(diffInHours / 24)}d ago`
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }
}

interface QuizCardProps {
  quiz: QuizListItem
  onDelete: (quizId: string) => Promise<void>
  onRetake: (quizId: string) => void
}

function QuizCard({ quiz, onDelete, onRetake }: QuizCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  
  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onDelete(quiz.quizId)
    } finally {
      setIsDeleting(false)
    }
  }

  
  return (
    <div className={cn(
      "flex items-center gap-4 p-4 rounded-lg border transition-all",
      "bg-neutral-900/30 border-neutral-800 hover:bg-neutral-800/50"
    )}>
      {/* Quiz Icon & Name */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex-shrink-0">
          <Brain className="w-5 h-5 text-indigo-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-neutral-200 truncate">
            {quiz.quizName}
          </div>
          <div className="text-xs text-neutral-400 flex items-center gap-2 mt-1">
            <span>{quiz.questionCount} questions</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(quiz.createdAt)}
            </span>
          </div>
        </div>
      </div>


      {/* Retake Button */}
      <div >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRetake(quiz.quizId)}
              className="text-neutral-400 hover:text-indigo-400 hover:bg-indigo-500/10 p-2"
            >
              <PlayCircle  style={{ width: '20px', height: '20px' }} className="w-20 h-20" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Retake quiz
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Delete Button */}
      <div className="flex-shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-neutral-400 hover:text-red-400 hover:bg-red-500/10 p-2"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 style={{ width: '20px', height: '20px' }}  className="w-4 h-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Delete quiz permanently
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

export default function QuizList({ 
  quizzes, 
  isLoading, 
  onDeleteQuiz, 
  onRetakeQuiz 
}: QuizListProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  if (quizzes.length === 0 && !isLoading) {
    return (
      <Card className="max-w-4xl w-full">
        <CardContent className="py-12 text-center">
          <Brain className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-neutral-300 mb-2">No quizzes yet</h3>
          <p className="text-neutral-500">Generate your first quiz to get started with AI-powered learning.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="max-w-4xl w-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6 text-indigo-400" />
              Quiz History
              {isLoading && <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />}
            </CardTitle>
            <div className="text-sm text-neutral-400 mt-1">
              Review and retake your generated quizzes
            </div>
          </div>
          
          {/* Expand/Collapse Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-neutral-400 hover:text-neutral-200 p-2"
          >
            {isExpanded ? (
              <ChevronUp style={{ width: '20px', height: '20px' }} />
            ) : (
              <ChevronDown style={{ width: '20px', height: '20px' }} />
            )}
          </Button>
        </div>

        {/* Stats Row - Always visible */}
        {isExpanded && (
          <div className="flex flex-wrap gap-4 text-xs text-neutral-400 pt-2 border-t border-neutral-800">
            <div className="flex items-center gap-1">
              <Brain className="w-3 h-3" />
              {quizzes.length} {quizzes.length === 1 ? 'quiz' : 'quizzes'}
            </div>
          </div>
        )}
      </CardHeader>

      {/* Collapsible Content */}
      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Quizzes List */}
          <div className="space-y-2 max-h-[24rem] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
            {quizzes.map((quiz) => (
              <QuizCard
                key={quiz.quizId}
                quiz={quiz}
                onDelete={onDeleteQuiz}
                onRetake={onRetakeQuiz}
              />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}