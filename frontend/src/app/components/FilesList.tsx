'use client'
import { useState, useMemo } from 'react'
import { 
  FileText, 
  Image as ImageIcon, 
  Trash2, 
  ChevronDown,
  ChevronUp,
  Loader2,
  Database,
  Calendar,
  HardDrive,
  Brain,
  MessageCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { FileListItem, FileListProps, SortField, SortDirection } from '@/types/file'
import { useUser } from "@clerk/nextjs";
import QuizDrawer from './QuizDrawer'
import QuizQuestions from './QuizQuestions'
import QuizPreviewModal from './QuizPreviewModal'
import QuizList from './QuizList'
import QuizGenerationLoader from './QuizGenerationLoader'
import { useQuiz } from '../hooks/useQuiz'
import ChatInterface from './ChatInterface'

function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 B'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
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

function getFileIcon(contentType: string, className?: string) {
  const isImage = contentType.startsWith('image/')
  return isImage 
    ? <ImageIcon className={cn("text-blue-400", className)} />
    : <FileText className={cn("text-emerald-400", className)} />
}



function SortButton({ 
  field, 
  currentField, 
  direction, 
  onSort, 
  children 
}: { 
  field: SortField
  currentField?: SortField
  direction?: SortDirection
  onSort?: (field: SortField) => void
  children: React.ReactNode 
}) {
  const isActive = currentField === field
  
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onSort?.(field)}
      className={cn(
        "h-auto p-1 text-xs font-medium text-neutral-400 hover:text-neutral-200",
        isActive && "text-neutral-200"
      )}
    >
      {children}
      {isActive && (
        direction === 'asc' ? (
          <ChevronUp className="w-3 h-3 ml-1" />
        ) : (
          <ChevronDown className="w-3 h-3 ml-1" />
        )
      )}
    </Button>
  )
}

interface FileRowProps {
  file: FileListItem
  onToggleEnabled: (fileId: string, enabled: boolean) => void
  onDelete: (fileId: string) => void
}

function FileRow({ file, onToggleEnabled, onDelete }: FileRowProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  
  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onDelete(file.id)
    } finally {
      setIsDeleting(false)
    }
  }
  
  return (
    <div className={cn(
      "flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border transition-all",
      "bg-neutral-900/30 border-neutral-800 hover:bg-neutral-800/50",
      !file.isEnabled && "opacity-60"
    )}>
      {/* File Icon & Name */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <div className="flex-shrink-0">
          {getFileIcon(file.contentType, "w-5 h-5")}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-neutral-200 truncate text-sm sm:text-base">
            {file.fileName}
          </div>
          <div className="text-xs text-neutral-400 flex items-center gap-2 mt-1">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(file.createdAt)}
            </span>
          </div>
        </div>
      </div>



      {/* Context Pool Toggle */}
      <div className="flex-shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 sm:gap-2">
              <Switch
                checked={file.isEnabled}
                onCheckedChange={(enabled) => onToggleEnabled(file.id, enabled)}
                className="data-[state=checked]:bg-indigo-500 scale-90 sm:scale-100"
              />
              <span className="text-xs text-neutral-400 hidden md:inline">
                {file.isEnabled ? 'Active' : 'Inactive'}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {file.isEnabled 
              ? 'Remove from context pool' 
              : 'Add to context pool'
            }
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
              className="text-neutral-400 hover:text-red-400 hover:bg-red-500/10 p-1.5 sm:p-2"
            >
              {isDeleting ? (
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
              ) : (
                <Trash2 className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Delete file permanently
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

export default function FilesList({
  files,
  onToggleEnabled,
  onDeleteFile,
  isLoading = false,
  sortField = 'createdAt',
  sortDirection = 'desc',
  onSort
}: FileListProps) {
  const { user } = useUser();
  const [internalSortField, setInternalSortField] = useState<SortField>(sortField)
  const [internalSortDirection, setInternalSortDirection] = useState<SortDirection>(sortDirection)
  
  // Chat state
  const [showChat, setShowChat] = useState(false)
  
  // Quiz management
  const {
    isGenerating,
    quizData,
    quizProgress,
    showQuizQuestions,
    setShowQuizQuestions,
    showQuizSettings,
    setShowQuizSettings,
    showQuizPreview,
    setShowQuizPreview,
    handleGenerateQuiz,
    userQuizzes,
    isLoadingQuizzes,
    deleteQuiz,
    retakeQuiz
  } = useQuiz(user?.id)
  const currentSortField = onSort ? sortField : internalSortField
  const currentSortDirection = onSort ? sortDirection : internalSortDirection

  const handleSort = (field: SortField) => {
    if (onSort) {
      onSort(field)
    } else {
      if (field === internalSortField) {
        setInternalSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
      } else {
        setInternalSortField(field)
        setInternalSortDirection('desc')
      }
    }
  }

  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (currentSortField) {
        case 'fileName':
          aValue = a.fileName.toLowerCase()
          bValue = b.fileName.toLowerCase()
          break
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime()
          bValue = new Date(b.createdAt).getTime()
          break
        case 'fileSize':
          aValue = a.fileSize || 0
          bValue = b.fileSize || 0
          break
        default:
          return 0
      }

      if (aValue < bValue) return currentSortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return currentSortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [files, currentSortField, currentSortDirection])

  const stats = useMemo(() => {
    const total = files.length
    const active = files.filter(f => f.isEnabled).length
    const totalSize = files.reduce((sum, f) => sum + (f.fileSize || 0), 0)
    
    return { total, active, totalSize }
  }, [files])

  if (files.length === 0 && !isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="py-12 text-center">
          <HardDrive className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-neutral-300 mb-2">No files uploaded</h3>
          <p className="text-neutral-500">Upload some documents to get started with your knowledge base.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="w-full relative">
      {/* Enhanced Quiz Generation Loader */}
      <QuizGenerationLoader
        isGenerating={isGenerating}
        progress={quizProgress?.progress}
        workers={quizProgress?.workers}
        quizName={quizProgress?.metadata?.quizName}
        questionCount={quizProgress?.metadata?.questionCount}
      />
      
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl lg:text-2xl font-bold flex items-center gap-2">
              <Database className="h-6 w-6 lg:h-7 lg:w-7 text-indigo-400" />
              Knowledge Base
              {isLoading && <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />}
            </CardTitle>
            <div className="text-sm lg:text-base text-neutral-400 mt-1">
              Manage your uploaded documents and context pool
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <Button 
              size="lg" 
              onClick={() => setShowChat(true)}
              disabled={stats.active === 0}
              className={`flex items-center gap-2 transition-all duration-200 flex-1 sm:flex-none ${
                stats.active === 0
                  ? 'bg-neutral-600 hover:bg-neutral-600 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-sm sm:text-base">Chat</span>
            </Button>
            
            <QuizDrawer
              trigger={
                <Button 
                  size="lg" 
                  className={`flex items-center gap-2 transition-all duration-200 flex-1 sm:flex-none ${
                    isGenerating 
                      ? 'bg-indigo-500 hover:bg-indigo-500 animate-pulse' 
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Brain className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                  <span className="text-sm sm:text-base">{isGenerating ? 'Generating...' : 'Generate Quiz'}</span>
                </Button>
              }
              existingQuizNames={[]}
              onGenerateQuiz={handleGenerateQuiz}
              isGenerating={isGenerating}
              open={showQuizSettings}
              onOpenChange={setShowQuizSettings}
            />
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex flex-wrap gap-3 sm:gap-4 text-xs text-neutral-400 pt-3 border-t border-neutral-800">
          <div className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            {stats.total} files
          </div>
          <div className="flex items-center gap-1">
            <Database className="w-3 h-3 text-indigo-400" />
            {stats.active} active
          </div>
          <div className="flex items-center gap-1">
            <HardDrive className="w-3 h-3" />
            {formatBytes(stats.totalSize)}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 lg:space-y-6">
        {/* Sort Controls */}
        <div className="flex items-center gap-1 text-xs overflow-x-auto">
          <span className="text-neutral-500 mr-2">Sort by:</span>
          <SortButton 
            field="fileName" 
            currentField={currentSortField}
            direction={currentSortDirection}
            onSort={handleSort}
          >
            Name
          </SortButton>
          <SortButton 
            field="createdAt"
            currentField={currentSortField}
            direction={currentSortDirection}
            onSort={handleSort}
          >
            Date
          </SortButton>
          <SortButton 
            field="fileSize"
            currentField={currentSortField}
            direction={currentSortDirection}
            onSort={handleSort}
          >
            Size
          </SortButton>

        </div>

        {/* Files List */}
        <div className="space-y-2 max-h-[24rem] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
          {sortedFiles.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              onToggleEnabled={onToggleEnabled}
              onDelete={onDeleteFile}
            />
          ))}
        </div>
      </CardContent>
      </Card>
    
      {/* Quiz List Section */}
      <QuizList 
        quizzes={userQuizzes}
        isLoading={isLoadingQuizzes}
        onDeleteQuiz={deleteQuiz}
        onRetakeQuiz={retakeQuiz}
      />
    
      {/* Quiz Preview Modal */}
      <QuizPreviewModal 
        open={showQuizPreview}
        onOpenChange={setShowQuizPreview}
        quizData={quizData}
        onTakeQuiz={() => setShowQuizQuestions(true)}
      />

      {/* Quiz Questions Drawer */}
      <QuizQuestions 
        open={showQuizQuestions}
        onOpenChange={setShowQuizQuestions}
        quizData={quizData}
      />

      {/* Chat Interface */}
      <ChatInterface
        isOpen={showChat}
        onOpenChange={setShowChat}
        userId={user?.id}
        hasEnabledFiles={stats.active > 0}
      />
    </>
  )
}
