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
  Brain
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { FileListItem, FileListProps, SortField, SortDirection } from '@/types/file'
import QuizDrawer from './QuizDrawer'

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
      "flex items-center gap-4 p-4 rounded-lg border transition-all",
      "bg-neutral-900/30 border-neutral-800 hover:bg-neutral-800/50",
      !file.isEnabled && "opacity-60"
    )}>
      {/* File Icon & Name */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex-shrink-0">
          {getFileIcon(file.contentType, "w-5 h-5")}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-neutral-200 truncate">
            {file.fileName}
          </div>
          <div className="text-xs text-neutral-400 flex items-center gap-2 mt-1">
            <span>{formatBytes(file.fileSize)}</span>
            <span>•</span>
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
            <div className="flex items-center gap-2">
              <Switch
                checked={file.isEnabled}
                onCheckedChange={(enabled) => onToggleEnabled(file.id, enabled)}
                className="data-[state=checked]:bg-indigo-500"
              />
              <span className="text-xs text-neutral-400 hidden sm:inline">
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
              className="text-neutral-400 hover:text-red-400 hover:bg-red-500/10 p-2"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
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
  const [internalSortField, setInternalSortField] = useState<SortField>(sortField)
  const [internalSortDirection, setInternalSortDirection] = useState<SortDirection>(sortDirection)

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
      <Card className="max-w-4xl w-full">
        <CardContent className="py-12 text-center">
          <HardDrive className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-neutral-300 mb-2">No files uploaded</h3>
          <p className="text-neutral-500">Upload some documents to get started with your knowledge base.</p>
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
              <Database className="h-6 w-6 text-indigo-400" />
              Knowledge Base
              {isLoading && <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />}
            </CardTitle>
            <div className="text-sm text-neutral-400 mt-1">
              Manage your uploaded documents and context pool
            </div>
          </div>
          
          <QuizDrawer
            trigger={
              <Button 
                size="lg" 
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700"
              >
                <Brain className="h-5 w-5" />
                Generate Quiz
              </Button>
            }
            existingQuizNames={[]} // TODO: Pass actual existing quiz names if needed
            onGenerateQuiz={(settings) => {
              console.log('Generating quiz with settings:', settings)
              // TODO: Implement quiz generation logic
            }}
          />
        </div>

        {/* Stats Row */}
        <div className="flex flex-wrap gap-4 text-xs text-neutral-400 pt-2 border-t border-neutral-800">
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

      <CardContent className="space-y-4">
        {/* Sort Controls */}
        <div className="flex items-center gap-1 text-xs">
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
  )
}
