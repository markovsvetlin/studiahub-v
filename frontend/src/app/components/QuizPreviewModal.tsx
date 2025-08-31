'use client'
import { 
  Dialog,
  DialogContent, 
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Brain, 
  Clock, 
  Target, 
  BookOpen, 
  Trophy,
  Play
} from 'lucide-react'
import { type QuizStatus } from '../services/quiz'

interface QuizPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  quizData: QuizStatus | null
  onTakeQuiz: () => void
}

export default function QuizPreviewModal({ 
  open, 
  onOpenChange, 
  quizData,
  onTakeQuiz
}: QuizPreviewModalProps) {
  if (!quizData) return null

  const { metadata, questions } = quizData
  
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-500/20 text-green-300 border-green-500/30'
      case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
      case 'hard': return 'bg-red-500/20 text-red-300 border-red-500/30'
      default: return 'bg-neutral-500/20 text-neutral-300 border-neutral-500/30'
    }
  }

  const handleTakeQuiz = () => {
    onOpenChange(false) // Close preview modal
    onTakeQuiz() // Open quiz drawer
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto bg-neutral-950 border-neutral-800 text-neutral-200 p-6 [&>button]:hidden">
        <div className="flex flex-col items-center space-y-4">
          {/* Centered Icon */}
          <div className="w-12 h-12 bg-indigo-600/20 rounded-full flex items-center justify-center">
            <Brain className="w-6 h-6 text-indigo-400" />
          </div>
          
          {/* Centered Title */}
          <div className="text-center space-y-1">
            <DialogTitle className="text-lg font-semibold text-white">
              Quiz Ready!
            </DialogTitle>
            <DialogDescription className="text-sm text-neutral-400">
              Ready to take your quiz?
            </DialogDescription>
          </div>

          {/* Quiz Name - Centered */}
          <div className="text-center py-2">
            <h3 className="font-semibold text-white text-base">{metadata.quizName}</h3>
          </div>

          {/* Symmetrical Info Grid */}
          <div className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex flex-col items-center text-center space-y-1">
                <Target className="w-4 h-4 text-neutral-400" />
                <Badge variant="outline" className={`text-xs ${getDifficultyColor(metadata.difficulty)} capitalize`}>
                  {metadata.difficulty}
                </Badge>
              </div>
              <div className="flex flex-col items-center text-center space-y-1">
                <Clock className="w-4 h-4 text-neutral-400" />
                <span className="text-white font-medium">{metadata.minutes} min</span>
              </div>
              <div className="flex flex-col items-center text-center space-y-1">
                <BookOpen className="w-4 h-4 text-neutral-400" />
                <span className="text-white font-medium">{questions?.length || metadata.questionCount}</span>
              </div>
              <div className="flex flex-col items-center text-center space-y-1">
                <Brain className="w-4 h-4 text-neutral-400" />
                <span className="text-white font-medium">{metadata.topic || 'General'}</span>
              </div>
            </div>
          </div>

          {/* Additional Instructions - Centered */}
          {metadata.additionalInstructions && (
            <div className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg p-3">
              <p className="text-xs text-neutral-300 italic text-center">"{metadata.additionalInstructions}"</p>
            </div>
          )}

          {/* Symmetrical Action Buttons */}
          <div className="w-full flex gap-3 pt-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onOpenChange(false)}
              className="flex-1 border-neutral-700 hover:bg-neutral-800 text-xs"
            >
              Later
            </Button>
            <Button 
              size="sm"
              onClick={handleTakeQuiz}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
            >
              <Play className="w-3 h-3 mr-1" />
              Take Quiz
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
