'use client'
import { useState } from 'react'
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Brain, Loader2 } from 'lucide-react'

export interface QuizSettings {
  quizName: string
  minutes: number
  questionCount: number
  difficulty: 'easy' | 'medium' | 'hard'
  topic: string
  additionalInstructions: string
}

interface QuizDrawerProps {
  trigger: React.ReactNode
  existingQuizNames?: string[]
  onGenerateQuiz: (settings: QuizSettings) => void
  isGenerating?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function QuizDrawer({ 
  trigger, 
  existingQuizNames = [], 
  onGenerateQuiz,
  isGenerating = false,
  open,
  onOpenChange
}: QuizDrawerProps) {
  const [formData, setFormData] = useState<QuizSettings>({
    quizName: generateDefaultQuizName(existingQuizNames),
    minutes: 5,
    questionCount: 10,
    difficulty: 'medium',
    topic: '',
    additionalInstructions: ''
  })
  const [errors, setErrors] = useState<Partial<Record<keyof QuizSettings, string>>>({})

  function generateDefaultQuizName(existingNames: string[]): string {
    const baseName = 'My Quiz'
    if (!existingNames.includes(baseName)) {
      return baseName
    }
    
    let counter = 1
    while (existingNames.includes(`${baseName}-${counter}`)) {
      counter++
    }
    return `${baseName}-${counter}`
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof QuizSettings, string>> = {}

    // Quiz name validation
    if (!formData.quizName.trim()) {
      newErrors.quizName = 'Quiz name is required'
    } else if (formData.quizName.length > 100) {
      newErrors.quizName = 'Quiz name must be less than 100 characters'
    }

    // Minutes validation
    if (formData.minutes < 1 || formData.minutes > 60) {
      newErrors.minutes = 'Minutes must be between 1 and 60'
    }

    // Questions validation - now only accepts 10, 20, 30
    if (![10, 20, 30].includes(formData.questionCount)) {
      newErrors.questionCount = 'Questions must be 10, 20, or 30'
    }

    // Topic validation (optional but with char limit)
    if (formData.topic.length > 200) {
      newErrors.topic = 'Topic must be less than 200 characters'
    }

    // Additional instructions validation
    if (formData.additionalInstructions.length > 500) {
      newErrors.additionalInstructions = 'Additional instructions must be less than 500 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (validateForm()) {
      onGenerateQuiz(formData)
      onOpenChange(false)
      // Reset form for next use
      setFormData({
        quizName: generateDefaultQuizName(existingQuizNames),
        minutes: 5,
        questionCount: 10,
        difficulty: 'medium',
        topic: '',
        additionalInstructions: ''
      })
      setErrors({})
    }
  }

  const updateFormData = (field: keyof QuizSettings, value: string | number) => {
    setFormData(prev => ({ 
      ...prev, 
      [field]: field === 'questionCount' && typeof value === 'string' ? parseInt(value) : value 
    }))
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        {trigger}
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[500px] flex flex-col justify-center items-center">
        <div className="w-full max-w-md space-y-6 px-4">
          <SheetHeader className="text-center">
            <SheetTitle className="flex items-center justify-center gap-2">
              <Brain className="h-5 w-5 text-indigo-400" />
              Quiz Settings
            </SheetTitle>
            <SheetDescription>
              Configure your quiz settings and generate a personalized quiz from your knowledge base.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6">
          {/* Quiz Name */}
          <div className="space-y-2">
            <Label htmlFor="quizName">Quiz Name *</Label>
            <Input
              id="quizName"
              value={formData.quizName}
              onChange={(e) => updateFormData('quizName', e.target.value)}
              placeholder="Enter quiz name"
              className={errors.quizName ? "border-red-500" : ""}
            />
            {errors.quizName && (
              <p className="text-sm text-red-500">{errors.quizName}</p>
            )}
          </div>

          {/* Minutes and Questions Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minutes">Minutes to Take *</Label>
              <Input
                id="minutes"
                type="number"
                min="1"
                max="60"
                value={formData.minutes}
                onChange={(e) => updateFormData('minutes', parseInt(e.target.value) || 1)}
                className={errors.minutes ? "border-red-500" : ""}
              />
              {errors.minutes && (
                <p className="text-sm text-red-500">{errors.minutes}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="questions">Questions Amount *</Label>
              <Select
                value={formData.questionCount.toString()}
                onValueChange={(value) => updateFormData('questionCount', parseInt(value))}
              >
                <SelectTrigger className={errors.questionCount ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select question count" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 questions</SelectItem>
                  <SelectItem value="20">20 questions</SelectItem>
                  <SelectItem value="30">30 questions</SelectItem>
                </SelectContent>
              </Select>
              {errors.questionCount && (
                <p className="text-sm text-red-500">{errors.questionCount}</p>
              )}
            </div>
          </div>

          {/* Difficulty */}
          <div className="space-y-3">
            <Label>Difficulty *</Label>
            <div className="flex gap-2">
              {(['easy', 'medium', 'hard'] as const).map((difficulty) => (
                <Button
                  key={difficulty}
                  type="button"
                  variant={formData.difficulty === difficulty ? "default" : "outline"}
                  className={`flex-1 capitalize ${formData.difficulty === difficulty ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
                  onClick={() => updateFormData('difficulty', difficulty)}
                >
                  {difficulty}
                </Button>
              ))}
            </div>
          </div>

          {/* Topic */}
          <div className="space-y-2">
            <Label htmlFor="topic">Topic</Label>
            <Input
              id="topic"
              value={formData.topic}
              onChange={(e) => updateFormData('topic', e.target.value)}
              placeholder="e.g., Mathematics, History, Science"
              className={errors.topic ? "border-red-500" : ""}
            />
            {errors.topic && (
              <p className="text-sm text-red-500">{errors.topic}</p>
            )}
            <p className="text-xs text-neutral-500">
              Specify focus areas or topics for your quiz (optional)
            </p>
          </div>

          {/* Additional Instructions */}
          <div className="space-y-2">
            <Label htmlFor="instructions">Additional Instructions</Label>
            <Textarea
              id="instructions"
              value={formData.additionalInstructions}
              onChange={(e) => updateFormData('additionalInstructions', e.target.value)}
              placeholder="Any specific instructions for the quiz generation..."
              rows={5}
              className={errors.additionalInstructions ? "border-red-500" : ""}
            />
            {errors.additionalInstructions && (
              <p className="text-sm text-red-500">{errors.additionalInstructions}</p>
            )}
            <p className="text-xs text-neutral-500">
              {formData.additionalInstructions.length}/500 characters
                        </p>
          </div>
        </div>

          {/* Generate Button */}
          <div className="flex justify-center pt-4 border-t">
            <Button 
              onClick={handleSubmit}
              size="lg"
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Brain className="w-5 h-5 mr-2" />
              )}
              {isGenerating ? 'Generating...' : 'Generate Quiz'}
            </Button>
          </div>
        </div>

      </SheetContent>
    </Sheet>
  )
}
