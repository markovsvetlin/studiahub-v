import { findRelevantChunks } from '../files/ChatSearchService'
import { getUserEnabledFiles } from '../../utils/files/database'
import { getConversationContext } from '../../utils/chat/messages'

// Cache for chunks to avoid repeated expensive operations
const chunkCache = new Map<string, {
  chunks: any[]
  timestamp: number
  userId: string
}>()

const CHUNK_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Cache for enabled files
const enabledFilesCache = new Map<string, {
  files: any[]
  timestamp: number
}>()

const FILES_CACHE_TTL = 2 * 60 * 1000 // 2 minutes

interface ChatContext {
  chunks: Array<{
    id: string
    text: string
    fileName: string
    fileId: string
  }>
  conversationHistory: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
  userMessage: string
}

/**
 * Get enabled files with caching
 */
async function getCachedEnabledFiles(userId: string) {
  const cacheKey = `enabled_files_${userId}`
  const cached = enabledFilesCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < FILES_CACHE_TTL) {
    return cached.files
  }
  
  const files = await getUserEnabledFiles(userId)
  enabledFilesCache.set(cacheKey, {
    files,
    timestamp: Date.now()
  })
  
  return files
}

/**
 * Get relevant chunks with intelligent caching
 */
async function getCachedRelevantChunks(
  message: string,
  userId: string,
  topK: number = 5
) {
  // Create cache key based on message content (hash for privacy)
  const messageHash = Buffer.from(message.toLowerCase().trim()).toString('base64')
  const cacheKey = `chunks_${userId}_${messageHash}_${topK}`
  
  const cached = chunkCache.get(cacheKey)
  
  if (cached && 
      Date.now() - cached.timestamp < CHUNK_CACHE_TTL &&
      cached.userId === userId) {
    return cached.chunks
  }
  
  // Check if user has enabled files
  const enabledFiles = await getCachedEnabledFiles(userId)
  if (enabledFiles.length === 0) {
    throw new Error('No enabled files found in knowledge base')
  }
  
  const chunks = await findRelevantChunks(message, userId, topK)
  
  // Cache the results
  chunkCache.set(cacheKey, {
    chunks,
    timestamp: Date.now(),
    userId
  })
  
  // Clean up old cache entries (keep cache size reasonable)
  if (chunkCache.size > 1000) {
    const cutoff = Date.now() - CHUNK_CACHE_TTL
    for (const [key, entry] of chunkCache.entries()) {
      if (entry.timestamp < cutoff) {
        chunkCache.delete(key)
      }
    }
  }
  
  return chunks
}

/**
 * Prepare chat context with conversation history
 */
export async function prepareChatContext(
  userMessage: string,
  userId: string,
  conversationId?: string
): Promise<ChatContext> {
  // Get relevant chunks (with caching)
  const relevantChunks = await getCachedRelevantChunks(userMessage, userId, 5)
  
  // Get conversation history (if exists)
  let conversationHistory: Array<{ role: 'user' | 'assistant', content: string }> = []
  
  if (conversationId) {
    const context = await getConversationContext(conversationId, 3000, 15)
    conversationHistory = context.messages
  }
  
  return {
    chunks: relevantChunks.map(chunk => ({
      id: chunk.id,
      text: chunk.text,
      fileName: chunk.metadata?.fileName || 'Unknown',
      fileId: chunk.metadata?.fileId || ''
    })),
    conversationHistory,
    userMessage
  }
}

/**
 * Clean up caches (can be called periodically)
 */
export function cleanupCaches(): void {
  const now = Date.now()
  
  // Clean chunk cache
  for (const [key, entry] of chunkCache.entries()) {
    if (now - entry.timestamp > CHUNK_CACHE_TTL) {
      chunkCache.delete(key)
    }
  }
  
  // Clean files cache
  for (const [key, entry] of enabledFilesCache.entries()) {
    if (now - entry.timestamp > FILES_CACHE_TTL) {
      enabledFilesCache.delete(key)
    }
  }
}

// Periodic cleanup every 10 minutes
setInterval(cleanupCaches, 10 * 60 * 1000)