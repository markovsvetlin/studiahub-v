import { getAuthHeaders } from '@/utils/auth'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000'

export interface Message {
  messageId: string
  type: 'user' | 'assistant'
  content: string
  timestamp: number
  tokenUsage?: {
    prompt: number
    completion: number
    total: number
  }
  sourceFiles?: string[]
  createdAt: string
  conversationId?: string // Added when storing messages in local state
}

export interface Conversation {
  conversationId: string
  title: string
  messageCount: number
  lastMessageAt: number
  tokenUsage: {
    totalPrompt: number
    totalCompletion: number
    totalTokens: number
  }
  createdAt: string
  updatedAt: string
}

export interface SendMessageRequest {
  message: string
  conversationId?: string
  userId: string
}

export interface SendMessageResponse {
  conversationId: string
  messageId: string
  message: string
  tokenUsage: {
    prompt: number
    completion: number
    total: number
  }
  sourceFiles: string[]
  timestamp: number
  isNewConversation: boolean
  rateLimitInfo: RateLimitInfo
}

export interface GetMessagesResponse {
  conversationId: string
  messages: Message[]
  pagination: {
    hasMore: boolean
    nextCursor?: string
    direction: string
    limit: number
  }
  metadata: {
    conversationTitle: string
    messageCount: number
    totalTokens: number
  }
  rateLimitInfo: RateLimitInfo
}

export interface GetConversationsResponse {
  conversations: Conversation[]
  pagination: {
    hasMore: boolean
    nextCursor?: string
    limit: number
  }
  summary: {
    totalConversations: number
    totalTokensUsed: number
  }
  rateLimitInfo: RateLimitInfo
}

export interface RateLimitInfo {
  remainingRequests: number
  resetTime: number
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

// Custom error class for API errors
export class ChatApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ChatApiError'
  }
}

async function makeApiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    const authHeaders = await getAuthHeaders()
    const headers: Record<string, string> = {
      ...authHeaders,
      ...options.headers as Record<string, string>,
    }

    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers,
    })

    const data = await response.json()

    if (!response.ok) {
      const error = data as ApiError
      throw new ChatApiError(error.code, error.message, error.details)
    }

    return data
  } catch (error) {
    if (error instanceof ChatApiError) {
      throw error
    }
    
    // Network or parsing errors
    if (error instanceof Error) {
      throw new ChatApiError('NETWORK_ERROR', error.message)
    }
    
    throw new ChatApiError('UNKNOWN_ERROR', 'An unknown error occurred')
  }
}

export async function sendMessage(data: SendMessageRequest): Promise<SendMessageResponse> {
  return makeApiRequest<SendMessageResponse>('/chat/messages', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getMessages(
  conversationId: string,
  userId: string,
  options: {
    limit?: number
    cursor?: string
    direction?: 'forward' | 'backward'
  } = {}
): Promise<GetMessagesResponse> {
  const params = new URLSearchParams({
    userId,
    ...options.limit && { limit: options.limit.toString() },
    ...options.cursor && { cursor: options.cursor },
    ...options.direction && { direction: options.direction }
  })

  return makeApiRequest<GetMessagesResponse>(
    `/chat/${encodeURIComponent(conversationId)}/messages?${params}`
  )
}

export async function getConversations(
  userId: string,
  options: {
    limit?: number
    cursor?: string
  } = {}
): Promise<GetConversationsResponse> {
  const params = new URLSearchParams({
    userId,
    ...options.limit && { limit: options.limit.toString() },
    ...options.cursor && { cursor: options.cursor }
  })

  return makeApiRequest<GetConversationsResponse>(`/chat/conversations?${params}`)
}

export async function deleteConversation(
  conversationId: string,
  userId: string
): Promise<{ conversationId: string; archived: boolean; archivedAt: string }> {
  return makeApiRequest(`/chat/conversations/${encodeURIComponent(conversationId)}?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  })
}

export async function generateConversationTitle(
  conversationId: string,
  userId: string
): Promise<{ title: string; conversationId: string; rateLimitInfo: RateLimitInfo }> {
  return makeApiRequest(`/chat/conversations/${encodeURIComponent(conversationId)}/title`, {
    method: 'POST',
    body: JSON.stringify({ userId })
  })
}