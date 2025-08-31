'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { 
  sendChatMessage, 
  getChatHistory, 
  getConversation, 
  generateChatTitle,
  type ChatMessage, 
  type Conversation,
  type SendMessageRequest,
  type SendMessageResponse 
} from '../services/chat'

interface UseChatReturn {
  // Current conversation state
  messages: ChatMessage[]
  currentConversation: Conversation | null
  isLoading: boolean
  error: string | null
  
  // Chat history
  conversations: Conversation[]
  isLoadingHistory: boolean
  
  // Actions
  sendMessage: (message: string, conversationId?: string) => Promise<void>
  loadConversation: (conversationId: string) => Promise<void>
  startNewConversation: () => void
  loadChatHistory: () => Promise<void>
  clearError: () => void
}

export function useChat(userId?: string): UseChatReturn {
  const { getToken } = useAuth()
  // Current conversation state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Chat history state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // Load chat history
  const loadChatHistory = useCallback(async () => {
    if (!userId) return

    setIsLoadingHistory(true)
    try {
      const response = await getChatHistory(userId)
      setConversations(response.conversations)
    } catch (err) {
      console.error('Failed to load chat history:', err)
      setError(err instanceof Error ? err.message : 'Failed to load chat history')
    } finally {
      setIsLoadingHistory(false)
    }
  }, [userId])

  // Load specific conversation
  const loadConversation = useCallback(async (conversationId: string) => {
    if (!userId) return

    setIsLoading(true)
    try {
      const response = await getConversation(conversationId, userId)
      setCurrentConversation(response.conversation)
      setMessages(response.messages)
      setError(null)
    } catch (err) {
      console.error('Failed to load conversation:', err)
      setError(err instanceof Error ? err.message : 'Failed to load conversation')
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  // Send message
  const sendMessage = useCallback(async (message: string, conversationId?: string) => {
    if (!userId || !message.trim()) return

    const optimisticMessage: ChatMessage = {
      id: `temp_${Date.now()}`,
      type: 'user',
      content: message.trim(),
      timestamp: Date.now(),
      createdAt: new Date().toISOString()
    }

    // Add user message optimistically
    setMessages(prev => [...prev, optimisticMessage])
    setIsLoading(true)
    setError(null)

    try {
      const request: SendMessageRequest = {
        message: message.trim(),
        userId,
        ...(conversationId && { conversationId })
      }

      const response: SendMessageResponse = await sendChatMessage({
        ...request,
        getToken
      })

      // Update the conversation ID if it's a new conversation
      if (!conversationId) {
        setCurrentConversation(prev => prev ? prev : {
          id: response.conversationId,
          title: 'New Conversation',
          lastMessageAt: response.timestamp,
          messageCount: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      }

      // Replace optimistic message and add AI response
      const userMessage: ChatMessage = {
        id: `user_${response.timestamp}`,
        type: 'user',
        content: message.trim(),
        timestamp: response.timestamp - 1, // Slightly before AI response
        createdAt: new Date().toISOString()
      }

      const aiMessage: ChatMessage = {
        id: `ai_${response.timestamp}`,
        type: 'assistant',
        content: response.message,
        timestamp: response.timestamp,
        tokenUsage: response.tokenUsage,
        sourceFiles: response.sourceFiles,
        createdAt: new Date().toISOString()
      }

      setMessages(prev => {
        // Remove optimistic message and add real messages
        const withoutOptimistic = prev.filter(msg => msg.id !== optimisticMessage.id)
        return [...withoutOptimistic, userMessage, aiMessage]
      })

      // Generate title for new conversations after first exchange
      if (!conversationId && !currentConversation?.title?.startsWith('New')) {
        try {
          const titleResponse = await generateChatTitle(response.conversationId, userId)
          setCurrentConversation(prev => prev ? { ...prev, title: titleResponse.title } : null)
        } catch (titleError) {
          console.warn('Failed to generate conversation title:', titleError)
        }
      }

      // Refresh chat history to show updated conversation
      await loadChatHistory()

    } catch (err) {
      console.error('Failed to send message:', err)
      setError(err instanceof Error ? err.message : 'Failed to send message')
      
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id))
    } finally {
      setIsLoading(false)
    }
  }, [userId, currentConversation, loadChatHistory, getToken])

  // Start new conversation
  const startNewConversation = useCallback(() => {
    setMessages([])
    setCurrentConversation(null)
    setError(null)
  }, [])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Load chat history on mount
  useEffect(() => {
    if (userId) {
      loadChatHistory()
    }
  }, [userId, loadChatHistory])

  return {
    // Current conversation state
    messages,
    currentConversation,
    isLoading,
    error,
    
    // Chat history
    conversations,
    isLoadingHistory,
    
    // Actions
    sendMessage,
    loadConversation,
    startNewConversation,
    loadChatHistory,
    clearError
  }
}