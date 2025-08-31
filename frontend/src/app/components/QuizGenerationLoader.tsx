'use client'

import { useEffect, useState } from 'react'
import { Progress } from '@/components/ui/progress'
import { 
  Brain, 
  FileText, 
  Sparkles, 
  Zap, 
  CheckCircle2, 
  Users, 
  Clock,
  Target
} from 'lucide-react'

interface QuizGenerationLoaderProps {
  isGenerating: boolean
  progress?: number
  workers?: {
    total: number
    completed: number
  }
  quizName?: string
  questionCount?: number
}

interface LoadingPhase {
  id: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bgColor: string
  minProgress: number
}

const LOADING_PHASES: LoadingPhase[] = [
  {
    id: 'analyzing',
    label: 'Analyzing Documents',
    description: 'AI is reading and understanding your content...',
    icon: FileText,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    minProgress: 0
  },
  {
    id: 'generating',
    label: 'Generating Questions',
    description: 'Creating personalized quiz questions...',
    icon: Brain,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/20',
    minProgress: 30
  },
  {
    id: 'optimizing',
    label: 'Optimizing Content',
    description: 'Fine-tuning questions for the best learning experience...',
    icon: Zap,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    minProgress: 70
  },
  {
    id: 'finalizing',
    label: 'Finalizing Quiz',
    description: 'Almost ready! Putting finishing touches...',
    icon: CheckCircle2,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    minProgress: 90
  }
]

export default function QuizGenerationLoader({
  isGenerating,
  progress = 0,
  workers,
  quizName = "Your Quiz",
  questionCount
}: QuizGenerationLoaderProps) {
  const [currentPhase, setCurrentPhase] = useState<LoadingPhase>(LOADING_PHASES[0])
  const [animatedProgress, setAnimatedProgress] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)

  // Update current phase based on progress
  useEffect(() => {
    const phase = LOADING_PHASES
      .slice()
      .reverse()
      .find(p => progress >= p.minProgress) || LOADING_PHASES[0]
    
    setCurrentPhase(phase)
  }, [progress])

  // Animate progress smoothly
  useEffect(() => {
    if (progress > animatedProgress) {
      const timer = setTimeout(() => {
        setAnimatedProgress(prev => Math.min(prev + 1, progress))
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [progress, animatedProgress])

  // Track elapsed time
  useEffect(() => {
    if (!isGenerating) {
      setElapsedTime(0)
      return
    }

    const startTime = Date.now()
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [isGenerating])

  if (!isGenerating) return null

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const CurrentIcon = currentPhase.icon

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-8 text-center space-y-6 shadow-2xl max-w-md w-full mx-4">
        
        {/* Header */}
        <div className="relative">
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center ${currentPhase.bgColor} border-2 border-opacity-30 ${currentPhase.color.replace('text-', 'border-')}`}>
                <CurrentIcon className={`w-8 h-8 ${currentPhase.color}`} />
              </div>
              <div className="absolute -top-2 -right-2">
                <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
              </div>
              
              {/* Rotating ring animation */}
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-400 animate-spin opacity-60"></div>
            </div>
          </div>
        </div>

        {/* Current Phase */}
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-white">{currentPhase.label}</h3>
          <p className="text-neutral-400 text-sm">
            {currentPhase.description}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-300">Progress</span>
            <span className={`font-medium ${currentPhase.color}`}>
              {animatedProgress}%
            </span>
          </div>
          <Progress 
            value={animatedProgress} 
            className="h-3 bg-neutral-800"
          />
        </div>

        {/* Quiz Info */}
        <div className="bg-gradient-to-br from-indigo-950/50 to-purple-950/50 border border-indigo-800/30 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Target className="w-4 h-4 text-indigo-400" />
            <span className="text-indigo-200 font-medium">{quizName}</span>
          </div>
          
          <div className="flex items-center justify-center gap-6 text-xs text-neutral-400">
            {questionCount && (
              <div className="flex items-center gap-1">
                <Brain className="w-3 h-3" />
                <span>{questionCount} questions</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{formatTime(elapsedTime)}</span>
            </div>
          </div>
        </div>

        {/* Workers Progress (if available) */}
        {workers && workers.total > 0 && (
          <div className="bg-neutral-800/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Users className="w-3 h-3 text-blue-400" />
                <span className="text-neutral-300">Processing Workers</span>
              </div>
              <span className="text-blue-400 font-medium">
                {workers.completed}/{workers.total}
              </span>
            </div>
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: workers.total }, (_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-sm transition-colors duration-300 ${
                    i < workers.completed 
                      ? 'bg-blue-500' 
                      : 'bg-neutral-700'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Estimated Time */}
        <div className="flex items-center justify-center gap-2 text-xs text-neutral-500">
          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
          <span>
            {progress < 50 
              ? 'This usually takes 10-20 seconds' 
              : progress < 80 
                ? 'Almost there! Just a few more moments...'
                : 'Finalizing your quiz...'}
          </span>
        </div>

      </div>
    </div>
  )
}
