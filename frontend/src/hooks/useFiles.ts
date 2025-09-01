'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { getAuthHeaders } from '@/utils/auth'
import { FileListItem } from '@/types/file'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://oyehv715ef.execute-api.us-east-1.amazonaws.com'

export function useFiles(userId?: string, refreshUsage?: () => void) {
  const { data: session } = useSession()
  const [files, setFiles] = useState<FileListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFiles = useCallback(async () => {
    if (!session) return
    
    try {
      setIsLoading(true)
      setError(null)
      
      const headers = await getAuthHeaders()
      
      const response = await fetch(`${API_BASE}/files`, {
        headers
      })
      
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
  }, [session])

  const toggleFileEnabled = useCallback(async (fileId: string, enabled: boolean) => {
    try {
      // Optimistic update
      setFiles(prev => prev.map(file => 
        file.id === fileId ? { ...file, isEnabled: enabled } : file
      ))

      const headers = await getAuthHeaders()

      const response = await fetch(`${API_BASE}/files/${fileId}/toggle`, {
        method: 'PATCH',
        headers: {
          ...headers
        },
        body: JSON.stringify({ isEnabled: enabled })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to toggle file: ${response.status}`)
      }
      
      const data = await response.json()
      if (!data.ok) {
        throw new Error(data.error || 'Failed to toggle file')
      }


      
    } catch (err) {
      // Revert optimistic update on error
      setFiles(prev => prev.map(file => 
        file.id === fileId ? { ...file, isEnabled: !enabled } : file
      ))
      setError(err instanceof Error ? err.message : 'Failed to toggle file')
    }
  }, [session])

  const deleteFile = useCallback(async (fileId: string) => {
    try {
      const headers = await getAuthHeaders()

      const response = await fetch(`${API_BASE}/files/${fileId}`, { 
        method: 'DELETE',
        headers
      })
      
      if (!response.ok) {
        throw new Error(`Failed to delete file: ${response.status}`)
      }
      
      const data = await response.json()
      if (!data.ok) {
        throw new Error(data.error || 'Failed to delete file')
      }
      
      setFiles(prev => prev.filter(file => file.id !== fileId))
      
      // Refresh usage immediately after file deletion to update word storage
      if (refreshUsage) {
        refreshUsage()
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file')
    }
  }, [refreshUsage, session])

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
