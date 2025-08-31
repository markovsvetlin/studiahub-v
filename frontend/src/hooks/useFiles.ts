'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { FileListItem } from '@/types/file'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://oyehv715ef.execute-api.us-east-1.amazonaws.com'

export function useFiles(userId?: string, refreshUsage?: () => void) {
  const { getToken } = useAuth()
  const [files, setFiles] = useState<FileListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFiles = useCallback(async () => {
    if (!getToken) return
    
    try {
      setIsLoading(true)
      setError(null)
      
      // Get JWT token from Clerk
      const token = await getToken()
      if (!token) {
        throw new Error('Not authenticated')
      }
      
      const response = await fetch(`${API_BASE}/files`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
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
  }, [getToken])

  const toggleFileEnabled = useCallback(async (fileId: string, enabled: boolean) => {
    try {
      // Optimistic update
      setFiles(prev => prev.map(file => 
        file.id === fileId ? { ...file, isEnabled: enabled } : file
      ))

      // Get JWT token from Clerk
      const token = await getToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`${API_BASE}/files/${fileId}/toggle`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
  }, [getToken])

  const deleteFile = useCallback(async (fileId: string) => {
    try {
      // Get JWT token from Clerk
      const token = await getToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`${API_BASE}/files/${fileId}`, { 
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
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
  }, [refreshUsage, getToken])

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
