'use client'
import { useState, useEffect, useCallback } from 'react'
import { FileListItem } from '@/types/file'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://oyehv715ef.execute-api.us-east-1.amazonaws.com'

export function useFiles(userId?: string) {
  const [files, setFiles] = useState<FileListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFiles = useCallback(async () => {
    if (!userId) return
    
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch(`${API_BASE}/files?userId=${encodeURIComponent(userId)}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.status}`)
      }
      
      const data = await response.json()
      if (!data.ok) {
        throw new Error(data.error || 'Failed to fetch files')
      }
      
      setFiles(data.files || [])
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch files')
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  const toggleFileEnabled = useCallback(async (fileId: string, enabled: boolean) => {
    try {
      // Optimistic update
      setFiles(prev => prev.map(file => 
        file.id === fileId ? { ...file, isEnabled: enabled } : file
      ))

      const response = await fetch(`${API_BASE}/files/${fileId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: enabled })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to toggle file: ${response.status}`)
      }
      
      const data = await response.json()
      if (!data.ok) {
        throw new Error(data.error || 'Failed to toggle file')
      }

      console.log(`File ${fileId} ${enabled ? 'enabled' : 'disabled'} in context pool`)
      
    } catch (err) {
      // Revert optimistic update on error
      setFiles(prev => prev.map(file => 
        file.id === fileId ? { ...file, isEnabled: !enabled } : file
      ))
      setError(err instanceof Error ? err.message : 'Failed to toggle file')
    }
  }, [])

  const deleteFile = useCallback(async (fileId: string) => {
    try {
      const response = await fetch(`${API_BASE}/files/${fileId}`, { 
        method: 'DELETE' 
      })
      
      if (!response.ok) {
        throw new Error(`Failed to delete file: ${response.status}`)
      }
      
      const data = await response.json()
      if (!data.ok) {
        throw new Error(data.error || 'Failed to delete file')
      }
      
      setFiles(prev => prev.filter(file => file.id !== fileId))
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file')
    }
  }, [])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  const refreshFiles = useCallback(() => {
    // Use setTimeout to avoid setState during render
    setTimeout(() => {
      fetchFiles()
    }, 0)
  }, [fetchFiles])

  return {
    files,
    isLoading,
    error,
    toggleFileEnabled,
    deleteFile,
    refreshFiles
  }
}
