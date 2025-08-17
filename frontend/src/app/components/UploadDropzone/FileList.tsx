'use client'
import { FileText, Image as ImageIcon, Trash2 } from 'lucide-react'

type ProgressMap = Record<string, { progress: number, status: 'idle' | 'processing' | 'done' | 'error' }>

type Props = {
  files: File[]
  makeKey: (f: File) => string
  formatBytes: (n: number) => string
  progressMap: ProgressMap
  onRemove: (key: string) => void
}

export function FileList({ files, makeKey, formatBytes, progressMap, onRemove }: Props) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 divide-y divide-neutral-800 max-h-[17rem] overflow-y-auto">
      {files.map((file) => {
        const key = makeKey(file)
        const isImage = file.type.startsWith('image/')
        const progress = progressMap[key]?.progress ?? 0
        const status = progressMap[key]?.status ?? 'idle'
        return (
          <div key={key} className="px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-6 w-6 flex items-center justify-center">
                  {isImage ? <ImageIcon className="h-5 w-5 text-neutral-300" /> : <FileText className="h-5 w-5 text-neutral-300" />}
                </div>
                <div className="truncate text-neutral-200">{file.name}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-neutral-400 text-xs">{formatBytes(file.size)}</div>
                <button type="button" aria-label="Remove file" onClick={(e) => { e.stopPropagation(); onRemove(key) }} className="rounded-md p-2 hover:bg-neutral-800 text-neutral-400 hover:text-red-300 transition-colors">
                  <Trash2 className="h-5 w-5 cursor-pointer" />
                </button>
              </div>
            </div>
            {(status === 'processing' || status === 'done') && (
              <div className="mt-2 h-1.5 w-full rounded-full bg-neutral-800 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}


