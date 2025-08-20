/**
 * File-related type definitions
 */

export interface FileRecord {
  id: string
  key: string
  createdAt: string
  updatedAt?: string
  fileName?: string
  fileSize?: number
  contentType?: string
  isEnabled?: boolean // For context pool toggle
}

export interface FileListItem extends FileRecord {
  fileName: string
  fileSize: number
  contentType: string
  isEnabled: boolean
}
export type SortField = 'fileName' | 'createdAt' | 'fileSize'
export type SortDirection = 'asc' | 'desc'

export interface FileListProps {
  files: FileListItem[]
  onToggleEnabled: (fileId: string, enabled: boolean) => void
  onDeleteFile: (fileId: string) => void
  isLoading?: boolean
  sortField?: SortField
  sortDirection?: SortDirection
  onSort?: (field: SortField) => void
}
