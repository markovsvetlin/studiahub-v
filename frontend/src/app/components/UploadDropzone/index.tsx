'use client'
import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { GraduationCap, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DropArea } from './DropArea'
import { FileList } from './FileList'
import { formatBytes, makeFileKey, uploadToBackend } from './utils'

export type UploadDropzoneProps = {
  userId: string
  onFilesAdded?: (files: File[]) => void
  onChange?: (files: File[]) => void
  onUploadComplete?: () => void
  accept?: string[]
  maxTotalBytes?: number
  caption?: string
}

export default function UploadDropzone({
  userId,
  onFilesAdded,
  onChange,
  onUploadComplete,
  accept = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/*',
  ],
  maxTotalBytes = 200 * 1024 * 1024,
  caption = 'Multiple files · Max 200MB total · PDF, DOCX, Images (including HEIC)'
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fileProgressByKey, setFileProgressByKey] = useState<Record<string, { progress: number, status: 'idle' | 'processing' | 'done' | 'error' }>>({})
  const [successfulUploads, setSuccessfulUploads] = useState<Set<string>>(new Set()) // eslint-disable-line @typescript-eslint/no-unused-vars
  const [shouldCallOnComplete, setShouldCallOnComplete] = useState(false)

  const inputRef = useRef<HTMLInputElement | null>(null)

  const acceptAttr = useMemo(() => accept.join(','), [accept])
  const limitMB = useMemo(() => (maxTotalBytes / (1024 * 1024)).toFixed(0), [maxTotalBytes])

  const makeKey = useCallback((f: File) => makeFileKey(f), [])

  const setProgress = useCallback((key: string, progress: number, status: 'processing' | 'done' | 'error' = 'processing') => {
    setFileProgressByKey(prev => {
      const current = prev[key]
      
      // Always update if status is changing to done/error, or if no current progress
      if (!current || status === 'done' || status === 'error') {
        // Track successful uploads
        if (status === 'done') {
          setSuccessfulUploads(prevSuccess => new Set([...prevSuccess, key]))
        }
        
        return {
          ...prev,
          [key]: { progress, status }
        }
      }
      
      // Only update progress if it's moving forward
      const newProgress = Math.max(current.progress, progress)
      return {
        ...prev,
        [key]: { progress: newProgress, status }
      }
    })
  }, [])

  const handleFiles = useCallback((incoming: FileList | File[]) => {
    const newFiles: File[] = Array.isArray(incoming) ? incoming : Array.from(incoming as FileList)
    const dedupedMap = new Map<string, File>()
    ;[...selectedFiles, ...newFiles].forEach((f) => dedupedMap.set(makeKey(f), f))
    const combined = Array.from(dedupedMap.values())
    const total = combined.reduce((sum, f) => sum + f.size, 0)
    if (total > maxTotalBytes) {
      setError(`Total ${formatBytes(total)} exceeds limit ${limitMB}MB`)
      return
    }
    setError(null)
    setSelectedFiles(combined)
    onFilesAdded?.(newFiles)
    onChange?.(combined)
  }, [limitMB, maxTotalBytes, onChange, onFilesAdded, selectedFiles, makeKey])

  const removeFile = useCallback((key: string) => {
    setSelectedFiles((prev) => {
      const next = prev.filter((f) => makeKey(f) !== key)
      onChange?.(next)
      return next
    })
  }, [onChange, makeKey])

  const totalBytes = useMemo(() => selectedFiles.reduce((s, f) => s + f.size, 0), [selectedFiles])

  const handleSubmit = useCallback(async () => {
    if (selectedFiles.length === 0) return
    setIsSubmitting(true)
    setSuccessfulUploads(new Set()) // Reset successful uploads tracker
    
    let cleanupInterval: NodeJS.Timeout | null = null
    
    try {
      const initial: Record<string, { progress: number, status: 'idle' | 'processing' | 'done' | 'error' }> = {}
      selectedFiles.forEach(f => { initial[makeKey(f)] = { progress: 0, status: 'idle' } })
      setFileProgressByKey(initial)

      await uploadToBackend(selectedFiles, userId, (k: string, p: number, s?: 'processing' | 'done' | 'error') => setProgress(k, p, s))
    } finally {
      // keep submitting state until all visible rows are done
      cleanupInterval = setInterval(() => {
        setFileProgressByKey(currentProgress => {
          const anyProcessing = Object.values(currentProgress).some(v => v.status !== 'done' && v.status !== 'error')
          if (!anyProcessing && Object.keys(currentProgress).length > 0) {
            setIsSubmitting(false)
            if (inputRef.current) inputRef.current.value = ''
            setSelectedFiles([])
            if (cleanupInterval) clearInterval(cleanupInterval)
            
            // Check if we need to call onUploadComplete
            setSuccessfulUploads(currentSuccessfulUploads => {
              if (currentSuccessfulUploads.size > 0) {
                setShouldCallOnComplete(true) // Trigger callback in useEffect
              }
              return new Set() // Reset for next upload
            })
            
            return {}
          }
          return currentProgress
        })
      }, 500)
    }
    
    // Cleanup function for safety
    return () => {
      if (cleanupInterval) {
        clearInterval(cleanupInterval)
      }
    }
  }, [makeKey, selectedFiles, setProgress, userId])

  // Call onUploadComplete outside of render phase to avoid React state update warnings
  useEffect(() => {
    if (shouldCallOnComplete) {
      setShouldCallOnComplete(false)
      onUploadComplete?.()
    }
  }, [shouldCallOnComplete, onUploadComplete])

  const openPicker = () => { if (inputRef.current) inputRef.current.value = ''; inputRef.current?.click() }

  return (
    <Card className="space-y-4 max-w-4xl w-full">
      <CardHeader>
        <CardTitle className='text-xl font-bold flex items-center gap-2'>
          <GraduationCap className="h-7 w-7 text-indigo-400" />
          Upload Course Material
        </CardTitle>
        <div className="text-sm text-neutral-400">Upload your lecture notes, documents, or images to start generating interactive quizzes and study material</div>
      </CardHeader>
      <CardContent className="space-y-4">
        <DropArea
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          onFiles={(files: FileList | File[]) => handleFiles(files)}
          onOpenPicker={openPicker}
          caption={caption}
          selectedCount={selectedFiles.length}
          totalBytes={totalBytes}
          limitMB={limitMB}
        />
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptAttr}
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />

        {error && (
          <div className="text-xs text-red-400" aria-live="polite">{error}</div>
        )}

        {selectedFiles.length > 0 && (
          <FileList
            files={selectedFiles}
            makeKey={makeKey}
            formatBytes={formatBytes}
            progressMap={fileProgressByKey}
            onRemove={removeFile}
          />
        )}

        <div className="flex justify-end">
          <Button className='cursor-pointer' disabled={selectedFiles.length === 0 || isSubmitting} size="lg" onClick={handleSubmit}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {isSubmitting ? 'Uploading…' : 'Add to Knowledge Base'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}


