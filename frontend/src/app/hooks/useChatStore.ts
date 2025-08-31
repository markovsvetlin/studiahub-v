'use client'
import { useState, useCallback, useRef, useMemo } from 'react'
import { useAuth } from '@clerk/nextjs'
import { toast } from 'sonner'
import { 
  sendMessage, 
  getMessages, 
  getConversations, 
  deleteConversation,
  generateConversationTitle,
  type Message, 
  type Conversation,
  type SendMessageRequest,
  ChatApiError
} from '../services/chatApi'
import { useUsageContext } from '@/contexts/UsageContext'

// Normalized state structure
interface ChatState {
  // Entities
  messages: Record<string, Message>
  conversations: Record<string, Conversation>
  
  // UI State
  currentConversationId: string | null
  isLoading: boolean
  isSending: boolean
  error: string | null
  
  // Pagination state
  conversationsPagination: {
    hasMore: boolean
    nextCursor: string | null
    isLoading: boolean
  }
  
  messagesPagination: Record<string, {
    hasMore: boolean
    nextCursor: string | null
    isLoading: boolean
  }>
  
  // Rate limit info
  rateLimitInfo: {
    remainingRequests: number
    resetTime: number
  } | null
  
  // Optimistic updates
  optimisticMessages: Record<string, Message>
}

const initialState: ChatState = {
  messages: {},
  conversations: {},
  currentConversationId: null,
  isLoading: false,
  isSending: false,
  error: null,
  conversationsPagination: {
    hasMore: true,
    nextCursor: null,
    isLoading: false
  },
  messagesPagination: {},
  rateLimitInfo: null,
  optimisticMessages: {}
}

export function useChatStore(userId?: string) {
  const { getToken } = useAuth()
  const { refreshUsage } = useUsageContext()

  const [state, setState] = useState<ChatState>(initialState)
  const optimisticIdCounter = useRef(0)

  // Selectors (memoized)
  const currentConversation = useMemo(() => {
    return state.currentConversationId ? state.conversations[state.currentConversationId] : null
  }, [state.conversations, state.currentConversationId])

  const currentMessages = useMemo(() => {
    // Get regular messages for the current conversation
    const messages = state.currentConversationId 
      ? Object.values(state.messages).filter(msg => msg.conversationId === state.currentConversationId)
      : []
    
    // Get optimistic messages for the current conversation or new conversation
    const optimisticMessages = Object.values(state.optimisticMessages)
      .filter(msg => 
        msg.conversationId === state.currentConversationId ||
        (state.currentConversationId === null && msg.conversationId === 'temp')
      )
    
    return [...messages, ...optimisticMessages]
      .sort((a, b) => {
        // Always put optimistic messages at the end
        const aIsOptimistic = a.messageId.startsWith('optimistic_')
        const bIsOptimistic = b.messageId.startsWith('optimistic_')
        
        if (aIsOptimistic && !bIsOptimistic) return 1
        if (!aIsOptimistic && bIsOptimistic) return -1
        if (aIsOptimistic && bIsOptimistic) return a.timestamp - b.timestamp
        
        return a.timestamp - b.timestamp
      })
  }, [state.messages, state.optimisticMessages, state.currentConversationId])

  const conversationsList = useMemo(() => {
    return Object.values(state.conversations)
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
  }, [state.conversations])

  // Actions
  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }))
  }, [])

  const clearError = useCallback(() => setError(null), [setError])

  const loadConversations = useCallback(async (loadMore: boolean = false) => {
    if (!userId) return

    // Use setState callback to access current state instead of closure
    setState(prev => {
      if (loadMore && (!prev.conversationsPagination.hasMore || prev.conversationsPagination.isLoading)) {
        return prev // No change, exit early
      }
      
      return {
        ...prev,
        conversationsPagination: {
          ...prev.conversationsPagination,
          isLoading: true
        },
        error: null
      }
    })

    try {
      // Get current pagination state
      let currentCursor: string | null = null
      setState(prev => {
        currentCursor = prev.conversationsPagination.nextCursor
        return prev // No state change
      })

      const response = await getConversations(userId, {
        cursor: loadMore ? currentCursor || undefined : undefined,
        limit: 20
      })

      setState(prev => {
        const newConversations = { ...prev.conversations }
        
        // Add new conversations to normalized state
        for (const conversation of response.conversations) {
          newConversations[conversation.conversationId] = conversation
        }

        const mostRecentConversation = response.conversations[0] // First conversation is most recent

        return {
          ...prev,
          conversations: newConversations,
          conversationsPagination: {
            hasMore: response.pagination.hasMore,
            nextCursor: response.pagination.nextCursor || null,
            isLoading: false
          },
          rateLimitInfo: response.rateLimitInfo,
          // Set current conversation to most recent if not loading more and no current conversation
          currentConversationId: (!loadMore && !prev.currentConversationId && mostRecentConversation) 
            ? mostRecentConversation.conversationId 
            : prev.currentConversationId
        }
      })

      // Auto-load messages for the most recent conversation on initial load
      if (!loadMore && response.conversations.length > 0) {
        const mostRecentConversation = response.conversations[0]
        await loadMessages(mostRecentConversation.conversationId)
      }
    } catch (error) {
      console.error('Failed to load conversations:', error)
      const errorMessage = error instanceof ChatApiError ? error.message : 'Failed to load conversations'
      setState(prev => ({
        ...prev,
        error: errorMessage,
        conversationsPagination: {
          ...prev.conversationsPagination,
          isLoading: false
        }
      }))
    }
  }, [userId]) // Only depend on userId to prevent infinite loops

  const loadMessages = useCallback(async (conversationId: string, loadMore: boolean = false) => {
    if (!userId) return

    // Use setState callback to check pagination state
    let shouldReturn = false
    setState(prev => {
      const paginationState = prev.messagesPagination[conversationId]
      if (loadMore && (!paginationState?.hasMore || paginationState?.isLoading)) {
        shouldReturn = true
      }
      return prev // No state change yet
    })
    
    if (shouldReturn) return

    setState(prev => ({
      ...prev,
      messagesPagination: {
        ...prev.messagesPagination,
        [conversationId]: {
          ...prev.messagesPagination[conversationId],
          isLoading: true
        }
      },
      error: null
    }))

    try {
      const response = await getMessages(conversationId, userId, {
        cursor: loadMore ? paginationState?.nextCursor || undefined : undefined,
        limit: 50,
        direction: loadMore ? 'backward' : 'forward'
      })

      setState(prev => {
        const newMessages = { ...prev.messages }
        
        // Add messages to normalized state
        for (const message of response.messages) {
          // Ensure conversationId is set on message for filtering
          newMessages[message.messageId] = {
            ...message,
            conversationId
          }
        }

        return {
          ...prev,
          messages: newMessages,
          messagesPagination: {
            ...prev.messagesPagination,
            [conversationId]: {
              hasMore: response.pagination.hasMore,
              nextCursor: response.pagination.nextCursor || null,
              isLoading: false
            }
          },
          rateLimitInfo: response.rateLimitInfo
        }
      })
    } catch (error) {
      console.error('Failed to load messages:', error)
      const errorMessage = error instanceof ChatApiError ? error.message : 'Failed to load messages'
      setState(prev => ({
        ...prev,
        error: errorMessage,
        messagesPagination: {
          ...prev.messagesPagination,
          [conversationId]: {
            ...prev.messagesPagination[conversationId],
            isLoading: false
          }
        }
      }))
    }
  }, [userId]) // Only depend on userId to prevent infinite loops

  const selectConversation = useCallback(async (conversationId: string | null) => {
    setState(prev => ({
      ...prev,
      currentConversationId: conversationId,
      error: null
    }))

    // Always load messages when selecting a conversation
    if (conversationId) {
      await loadMessages(conversationId)
    }
  }, [loadMessages])

  const sendChatMessage = useCallback(async (message: string, conversationId?: string) => {
    if (!userId || !message.trim()) return

    // Generate optimistic message
    const optimisticId = `optimistic_${++optimisticIdCounter.current}`
    const optimisticMessage: Message = {
      messageId: optimisticId,
      type: 'user',
      content: message.trim(),
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
      conversationId: conversationId || 'temp'
    }

    // Add optimistic message
    setState(prev => ({
      ...prev,
      optimisticMessages: {
        ...prev.optimisticMessages,
        [optimisticId]: {
          ...optimisticMessage,
          conversationId: conversationId || prev.currentConversationId || 'temp'
        }
      },
      isSending: true,
      error: null
    }))

    try {
      const request: SendMessageRequest = {
        message: message.trim(),
        userId,
        ...(conversationId && { conversationId })
      }

      const response = await sendMessage({
        ...request,
        getToken
      })

      // Handle successful response
      setState(prev => {
        const newMessages = { ...prev.messages }
        const newConversations = { ...prev.conversations }
        const newOptimisticMessages = { ...prev.optimisticMessages }

        // Remove optimistic message
        delete newOptimisticMessages[optimisticId]

        // Add real messages
        const userMessage: Message = {
          messageId: `user_${response.timestamp}`,
          type: 'user',
          content: message.trim(),
          timestamp: response.timestamp - 1,
          createdAt: new Date(response.timestamp - 1).toISOString(),
          conversationId: response.conversationId
        }

        const aiMessage: Message = {
          messageId: response.messageId,
          type: 'assistant',
          content: response.message,
          timestamp: response.timestamp,
          tokenUsage: response.tokenUsage,
          sourceFiles: response.sourceFiles,
          createdAt: new Date(response.timestamp).toISOString(),
          conversationId: response.conversationId
        }

        newMessages[userMessage.messageId] = userMessage
        newMessages[aiMessage.messageId] = aiMessage

        // Update conversation if new
        if (response.isNewConversation) {
          newConversations[response.conversationId] = {
            conversationId: response.conversationId,
            title: 'New Conversation',
            messageCount: 2,
            lastMessageAt: response.timestamp,
            tokenUsage: {
              totalPrompt: response.tokenUsage.prompt,
              totalCompletion: response.tokenUsage.completion,
              totalTokens: response.tokenUsage.total
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        }

        return {
          ...prev,
          messages: newMessages,
          conversations: newConversations,
          optimisticMessages: newOptimisticMessages,
          currentConversationId: response.conversationId,
          isSending: false,
          rateLimitInfo: response.rateLimitInfo
        }
      })

      // Refresh usage after successful message
      refreshUsage()

      // Generate title for new conversation asynchronously (don't await)
      if (response.isNewConversation) {
        generateConversationTitle(response.conversationId, userId)
          .then((titleResponse) => {
            setState(prev => ({
              ...prev,
              conversations: {
                ...prev.conversations,
                [response.conversationId]: {
                  ...prev.conversations[response.conversationId],
                  title: titleResponse.title
                }
              }
            }))
          })
          .catch((error) => {
            console.warn('Failed to generate conversation title:', error)
            // Don't show error to user - title generation is not critical
          })
      }

    } catch (error) {
      console.error('Failed to send message:', error)
      
      // Check for usage limit errors
      if (error instanceof Error && error.message.includes('Usage limit exceeded')) {
        toast.error('Message Failed - Usage Limit Exceeded', {
          description: error.message,
          duration: 8000
        })
      }
      
      // Remove optimistic message and show error
      setState(prev => {
        const newOptimisticMessages = { ...prev.optimisticMessages }
        delete newOptimisticMessages[optimisticId]

        const errorMessage = error instanceof ChatApiError ? error.message : 'Failed to send message'

        return {
          ...prev,
          optimisticMessages: newOptimisticMessages,
          isSending: false,
          error: errorMessage
        }
      })
    }
  }, [userId])

  const removeConversation = useCallback(async (conversationId: string) => {
    if (!userId) return

    try {
      await deleteConversation(conversationId, userId)

      setState(prev => {
        const newConversations = { ...prev.conversations }
        const newMessages = { ...prev.messages }

        // Remove conversation
        delete newConversations[conversationId]

        // Remove all messages from this conversation
        for (const messageId in newMessages) {
          if (newMessages[messageId].conversationId === conversationId) {
            delete newMessages[messageId]
          }
        }

        return {
          ...prev,
          conversations: newConversations,
          messages: newMessages,
          currentConversationId: prev.currentConversationId === conversationId ? null : prev.currentConversationId
        }
      })
    } catch (error) {
      console.error('Failed to delete conversation:', error)
      const errorMessage = error instanceof ChatApiError ? error.message : 'Failed to delete conversation'
      setError(errorMessage)
    }
  }, [userId, setError])

  const startNewConversation = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentConversationId: null,
      error: null
    }))
  }, [])

  return {
    // State
    currentConversation,
    currentMessages,
    conversationsList,
    isLoading: state.isLoading,
    isSending: state.isSending,
    error: state.error,
    rateLimitInfo: state.rateLimitInfo,
    conversationsPagination: state.conversationsPagination,
    
    // Actions
    loadConversations,
    loadMessages,
    selectConversation,
    sendChatMessage,
    removeConversation,
    startNewConversation,
    clearError
  }
}