const API_BASE = process.env.NEXT_PUBLIC_API_BASE
export interface ChatMessage {
  id: string
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
}

export interface Conversation {
  id: string
  title: string
  lastMessageAt: number
  messageCount: number
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
  message: string
  tokenUsage: {
    prompt: number
    completion: number
    total: number
  }
  sourceFiles: string[]
  timestamp: number
}

export interface ChatHistoryResponse {
  conversations: Conversation[]
}

export interface ConversationResponse {
  conversation: Conversation
  messages: ChatMessage[]
}

export async function sendChatMessage(data: SendMessageRequest): Promise<SendMessageResponse> {
  const response = await fetch(`${API_BASE}/chat/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.message || 'Failed to send message')
  }

  return response.json()
}

export async function getChatHistory(userId: string): Promise<ChatHistoryResponse> {
  const response = await fetch(`${API_BASE}/chat/history?userId=${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.message || 'Failed to fetch chat history')
  }

  return response.json()
}

export async function getConversation(conversationId: string, userId: string): Promise<ConversationResponse> {
  const response = await fetch(`${API_BASE}/chat/${encodeURIComponent(conversationId)}?userId=${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.message || 'Failed to fetch conversation')
  }

  return response.json()
}

export async function generateChatTitle(conversationId: string, userId: string): Promise<{ title: string; conversationId: string }> {
  const response = await fetch(`${API_BASE}/chat/${encodeURIComponent(conversationId)}/title`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.message || 'Failed to generate title')
  }

  return response.json()
}