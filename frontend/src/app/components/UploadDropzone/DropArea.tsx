'use client'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  isDragging: boolean
  setIsDragging: (v: boolean) => void
  onFiles: (files: FileList | File[]) => void
  onOpenPicker: () => void
  caption: string
  selectedCount: number
  totalBytes: number
  limitMB: string
}

export function DropArea({ isDragging, setIsDragging, onFiles, onOpenPicker, caption, selectedCount, totalBytes, limitMB }: Props) {
  const formatBytes = (bytes: number) => {
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(mb >= 1 ? 1 : 2)} MB`
  }

  return (
    <div
      onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); onFiles(e.dataTransfer.files) }}
      onClick={() => onOpenPicker()}
      className={cn(
        'cursor-pointer rounded-2xl border-2 border-dashed transition-colors',
        'min-h-56 flex items-center justify-center text-center',
        'bg-neutral-950/40 border-neutral-800 hover:bg-neutral-900/60',
        isDragging && 'bg-neutral-900 border-neutral-500'
      )}
      tabIndex={0}
      role="button"
      aria-label="Upload files"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenPicker() } }}
    >
      <div className="flex flex-col items-center gap-2 px-6 py-10">
        <Upload className="h-10 w-10 text-indigo-400" />
        {selectedCount === 0 ? (
          <>
            <div className="text-sm font-medium text-neutral-200">Drop files here or click to upload</div>
            <div className="text-xs text-neutral-400">{caption}</div>
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-full bg-neutral-800 text-neutral-200 text-xs px-3 py-1 border border-neutral-700">Documents</span>
              <span className="rounded-full bg-neutral-800 text-neutral-200 text-xs px-3 py-1 border border-neutral-700">Images</span>
            </div>
          </>
        ) : (
          <>
            <div className="text-sm font-medium text-neutral-200">{selectedCount} file{selectedCount > 1 ? 's' : ''} selected</div>
            <div className="text-xs text-neutral-400">Total: {formatBytes(totalBytes)} of {limitMB}MB</div>
            <div className="text-xs text-neutral-500">Click or drag to add more files</div>
          </>
        )}
      </div>
    </div>
  )
}


