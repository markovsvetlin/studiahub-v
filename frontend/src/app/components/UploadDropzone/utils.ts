// Progress tracking constants
const PROGRESS_UPLOAD_STARTED = 5
const PROGRESS_PRESIGNED_OBTAINED = 10
const PROGRESS_S3_UPLOAD_COMPLETE = 20
const PROGRESS_PROCESSING_TRIGGERED = 30
const PROGRESS_COMPLETED = 100

// Status types
type FileStatus = 'processing' | 'done' | 'error'

// Helper function to parse error messages from JSON responses
function parseErrorMessage(errorMessage: string): string {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(errorMessage)
    if (parsed && typeof parsed.message === 'string') {
      return parsed.message
    }
  } catch {
    // If not JSON or no message field, check if it starts with common prefixes
    if (errorMessage.startsWith('Failed to confirm upload: ')) {
      const remaining = errorMessage.replace('Failed to confirm upload: ', '')
      try {
        const parsed = JSON.parse(remaining)
        if (parsed && typeof parsed.message === 'string') {
          return parsed.message
        }
      } catch {
        // If still can't parse, return the remaining part
        return remaining
      }
    }
  }
  
  // Return original message if no parsing was successful
  return errorMessage
}

// Interface definitions
interface PresignedUrlResponse {
  uploadUrl: string
  key: string
  fileId: string
}

interface FileStatusResponse {
  file?: {
    progress?: number
    status?: 'queued' | 'processing' | 'ready' | 'error'
    errorMessage?: string
  }
}

export function formatBytes(bytes: number): string {
  const megabytes = bytes / (1024 * 1024)
  const decimalPlaces = megabytes >= 1 ? 1 : 2
  return `${megabytes.toFixed(decimalPlaces)} MB`
}

export function makeFileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`
}

function determineContentType(file: File): string {
  if (file.type) return file.type
  
  // Fallback content type detection based on file extension
  const fileName = file.name.toLowerCase()
  if (fileName.endsWith('.pdf')) return 'application/pdf'
  if (fileName.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  return 'application/octet-stream'
}

async function requestPresignedUrl(baseUrl: string, file: File, userId: string): Promise<PresignedUrlResponse> {
  const response = await fetch(`${baseUrl}/upload/presigned`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType: determineContentType(file),
      fileSize: file.size,
      userId
    })
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    
    try {
      const errorData = JSON.parse(errorText)
      throw new Error(errorData.message || errorText)
    } catch {
      throw new Error(errorText)
    }
  }
  
  return await response.json() as PresignedUrlResponse
}

async function uploadToS3(uploadUrl: string, file: File, contentType: string): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file
  })
  
  if (!response.ok) {
    throw new Error(`S3 upload failed with status: ${response.status}`)
  }
}

async function confirmUploadComplete(baseUrl: string, backendKey: string, userId: string): Promise<void> {
  const response = await fetch(`${baseUrl}/upload/confirm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: backendKey, userId })
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to confirm upload: ${errorText}`)
  }
}

export async function uploadToBackend(
  files: File[],
  userId: string,
  updateProgress: (key: string, progress: number, status?: FileStatus) => void,
  onFileDone?: (localKey: string) => void
) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE || 'https://oyehv715ef.execute-api.us-east-1.amazonaws.com'
  
  for (const file of files) {
    const localFileKey = makeFileKey(file)
    
    try {
      updateProgress(localFileKey, PROGRESS_UPLOAD_STARTED, 'processing')
      
      // Step 1: Request presigned URL
      const presignedData = await requestPresignedUrl(baseUrl, file, userId)
      updateProgress(localFileKey, PROGRESS_PRESIGNED_OBTAINED, 'processing')
      
      // Step 2: Upload file directly to S3
      const contentType = determineContentType(file)
      await uploadToS3(presignedData.uploadUrl, file, contentType)
      updateProgress(localFileKey, PROGRESS_S3_UPLOAD_COMPLETE, 'processing')
      
      // Step 3: Confirm upload and trigger processing
      await confirmUploadComplete(baseUrl, presignedData.key, userId)
      updateProgress(localFileKey, PROGRESS_PROCESSING_TRIGGERED, 'processing')
      
      // Start polling file status asynchronously
      pollFileStatus(baseUrl, presignedData.key, localFileKey, updateProgress, onFileDone)
        .catch(error => {
          console.error(`Status polling failed for ${localFileKey}:`, error)
        })
    } catch (error) {
      console.error(`Upload failed for ${file.name}:`, error)
      updateProgress(localFileKey, PROGRESS_COMPLETED, 'error')
      
      // Show user-friendly error toast with specific backend message
      const { toast } = await import('sonner')
      
      // Extract specific error message from backend response
      let errorMessage = `Failed to upload ${file.name}. Please try again.`
      if (error instanceof Error) {
        errorMessage = error.message
      }
      
      // Parse JSON error responses to extract user-friendly messages
      const parsedError = parseErrorMessage(errorMessage)
      
      // Check for specific error types
      if (parsedError.includes('File too large')) {
        toast.error('File Too Large', {
          description: parsedError,
          duration: 8000
        })
      } else if (parsedError.includes('FILE_TOO_SMALL')) {
        // Extract the user-friendly message after the prefix
        const userMessage = parsedError.replace('FILE_TOO_SMALL: ', '')
        toast.error('Content Too Small', {
          description: userMessage,
          duration: 6000
        })
      } else {
        toast.error('Upload Failed', {
          description: parsedError,
          duration: 5000
        })
      }
    }
  }
}

// Polling configuration constants
const MAX_POLLING_ATTEMPTS = 600 // ~10 minutes with 1s intervals
const POLLING_INTERVAL_MS = 800
const MIN_PROGRESS_DISPLAY = 5
const MAX_PROGRESS_BEFORE_COMPLETE = 99

async function pollFileStatus(
  baseUrl: string,
  backendKey: string,
  localKey: string,
  updateProgress: (key: string, progress: number, status?: FileStatus) => void,
  onFileDone?: (localKey: string) => void
): Promise<void> {
  let attemptCount = 0
  
  while (attemptCount < MAX_POLLING_ATTEMPTS) {
    try {
      const statusResponse = await fetch(
        `${baseUrl}/files/${encodeURIComponent(backendKey)}?status=1`,
        { cache: 'no-store' }
      )
      
      if (statusResponse.ok) {
        const responseData = await statusResponse.json().catch(() => null) as FileStatusResponse
        const fileInfo = responseData?.file
        
        if (fileInfo) {
          const currentProgress = typeof fileInfo.progress === 'number' ? fileInfo.progress : 0
          const fileStatus = fileInfo.status
          
          // Handle error status
          if (fileStatus === 'error') {
            updateProgress(localKey, 0, 'error')
            
            // Show error notification with specific message
            const errorMessage = fileInfo.errorMessage || 'File processing failed'
            const parsedError = parseErrorMessage(errorMessage)
            const { toast } = await import('sonner')
            
            if (parsedError.includes('Usage limit exceeded')) {
              toast.error('Upload Failed - Usage Limit Exceeded', {
                description: parsedError,
                duration: 8000
              })
            } else if (parsedError.includes('FILE_TOO_SMALL')) {
              // Extract the user-friendly message after the prefix
              const userMessage = parsedError.replace('FILE_TOO_SMALL: ', '')
              toast.error('Content Too Small', {
                description: userMessage,
                duration: 6000
              })
            } else {
              toast.error('File Processing Failed', {
                description: parsedError,
                duration: 5000
              })
            }
            
            onFileDone?.(localKey)
            return // Polling complete
          }
          
          const isProcessingComplete = fileStatus === 'ready' || currentProgress >= PROGRESS_COMPLETED
          
          const displayProgress = isProcessingComplete 
            ? PROGRESS_COMPLETED 
            : Math.min(MAX_PROGRESS_BEFORE_COMPLETE, Math.max(MIN_PROGRESS_DISPLAY, currentProgress))
          
          const displayStatus: FileStatus = isProcessingComplete ? 'done' : 'processing'
          
          updateProgress(localKey, displayProgress, displayStatus)
          
          if (isProcessingComplete) {
            onFileDone?.(localKey)
            return // Polling complete
          }
        } else {
          // File not found (likely cleaned up due to validation failure)
          updateProgress(localKey, 0, 'error')
          
          const { toast } = await import('sonner')
          toast.error('Upload Failed', {
            description: 'File was removed due to validation failure. Please check file content and try again.',
            duration: 5000
          })
          
          onFileDone?.(localKey)
          return // Polling complete
        }
      }
    } catch (error) {
      // Ignore transient network errors and continue polling
      console.debug(`Polling attempt ${attemptCount + 1} failed:`, error)
    }
    
    attemptCount++
    await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS))
  }
  
  console.warn(`Polling timeout reached for file: ${localKey}`)
}


