'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { 
  MessageCircle, 
  X, 
  Send, 
  FileText,
  History,
  Plus,
  ChevronDown,
  Loader2,
  AlertCircle,
  Trash2,
  MoreVertical
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useChatStore } from '../hooks/useChatStore'
import type { Message, Conversation } from '../services/chatApi'

interface ChatInterfaceProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  userId?: string
  hasEnabledFiles: boolean
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

interface MessageItemProps {
  message: Message
  isOptimistic?: boolean
}

function MessageItem({ message, isOptimistic = false }: MessageItemProps) {
  const isUser = message.type === 'user'
  
  return (
    <div className={cn(
      "flex flex-col gap-2 py-3 px-4",
      isOptimistic && "opacity-60"
    )}>
      <div className={cn(
        "flex items-start gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}>
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0",
          isUser ? "bg-indigo-600 text-white" : "bg-neutral-700 text-neutral-300"
        )}>
          {isUser ? "You" : "AI"}
        </div>
        
        <div className={cn(
          "flex-1 min-w-0",
          isUser ? "text-right" : "text-left"
        )}>
          <div className={cn(
            "inline-block text-sm whitespace-pre-wrap break-words px-3 py-2 rounded-lg max-w-[80%]",
            isUser 
              ? "bg-indigo-600 text-white" 
              : "bg-neutral-800 text-neutral-200"
          )}>
            {message.content}
          </div>
          
          <div className={cn(
            "flex items-center gap-2 mt-2 text-xs text-neutral-500",
            isUser ? "justify-end" : "justify-start"
          )}>
            <span>{formatTime(message.timestamp)}</span>
            {message.tokenUsage && (
              <span>• {message.tokenUsage.total} tokens</span>
            )}
            {isOptimistic && (
              <span>• Sending...</span>
            )}
          </div>
        </div>
      </div>

      {/* Source Files */}
      {message.sourceFiles && message.sourceFiles.length > 0 && (
        <div className={cn(
          "flex flex-wrap gap-1",
          isUser ? "ml-4 mr-11 justify-end" : "ml-11 justify-start"
        )}>
          {message.sourceFiles.map((fileName, index) => (
            <div
              key={index}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-neutral-800 border border-neutral-700 rounded text-neutral-400"
            >
              <FileText className="w-3 h-3" />
              {fileName}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface ConversationItemProps {
  conversation: Conversation
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}

function ConversationItem({ conversation, isActive, onSelect, onDelete }: ConversationItemProps) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className={cn(
      "relative group p-3 rounded-lg cursor-pointer transition-colors",
      isActive ? "bg-indigo-600" : "hover:bg-neutral-800"
    )}>
      <div onClick={onSelect} className="min-w-0">
        <div className="font-medium text-sm text-neutral-200 truncate">
          {conversation.title}
        </div>
        <div className="text-xs text-neutral-500 flex items-center justify-between mt-1">
          <span>{conversation.messageCount} messages</span>
          <span>{formatRelativeTime(conversation.lastMessageAt)}</span>
        </div>
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation()
          setShowMenu(!showMenu)
        }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto"
      >
        <MoreVertical className="w-3 h-3" />
      </Button>
      
      {showMenu && (
        <div className="absolute top-8 right-2 bg-neutral-900 border border-neutral-700 rounded-lg shadow-lg z-10 min-w-[120px]">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
              setShowMenu(false)
            }}
            className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-neutral-800 flex items-center gap-2"
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

function ConversationHistory({ 
  conversations, 
  currentConversation,
  onSelectConversation,
  onDeleteConversation,
  onLoadMore,
  hasMore,
  isLoading 
}: { 
  conversations: Conversation[]
  currentConversation: Conversation | null
  onSelectConversation: (conversationId: string) => void
  onDeleteConversation: (conversationId: string) => void
  onLoadMore: () => void
  hasMore: boolean
  isLoading: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const historyRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div ref={historyRef} className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="text-neutral-400 hover:text-neutral-200"
      >
        <History className="w-4 h-4" />
        History
        <ChevronDown className={cn("w-3 h-3 transition-transform", isOpen && "rotate-180")} />
      </Button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-80 bg-neutral-950 border border-neutral-700 rounded-lg shadow-xl z-20 max-h-96 overflow-hidden">
          <div className="p-3 border-b border-neutral-700">
            <h3 className="font-semibold text-neutral-200">Chat History</h3>
          </div>
          
          <div className="overflow-y-auto max-h-80">
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-neutral-500">
                No conversations yet
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {conversations.map((conversation) => (
                  <ConversationItem
                    key={conversation.conversationId}
                    conversation={conversation}
                    isActive={currentConversation?.conversationId === conversation.conversationId}
                    onSelect={() => {
                      onSelectConversation(conversation.conversationId)
                      setIsOpen(false)
                    }}
                    onDelete={() => onDeleteConversation(conversation.conversationId)}
                  />
                ))}
                
                {hasMore && (
                  <div className="p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onLoadMore}
                      disabled={isLoading}
                      className="w-full text-neutral-400"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin mr-2" />
                          Loading...
                        </>
                      ) : (
                        'Load More'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ChatInterface({ isOpen, onOpenChange, userId, hasEnabledFiles }: ChatInterfaceProps) {
  const [inputMessage, setInputMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const chatDrawerRef = useRef<HTMLDivElement>(null)

  const {
    currentConversation,
    currentMessages,
    conversationsList,
    isSending,
    error,
    rateLimitInfo,
    conversationsPagination,
    loadConversations,
    selectConversation,
    sendChatMessage,
    removeConversation,
    startNewConversation,
    clearError
  } = useChatStore(userId)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentMessages])

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Load conversations when chat opens for the first time
  const hasLoadedRef = useRef(false)
  
  useEffect(() => {
    if (isOpen && userId && !hasLoadedRef.current && !conversationsPagination.isLoading) {
      hasLoadedRef.current = true
      loadConversations()
    }
    if (!isOpen) {
      hasLoadedRef.current = false // Reset when chat closes
    }
  }, [isOpen, userId, conversationsPagination.isLoading, loadConversations])

  // Close drawer on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (chatDrawerRef.current && !chatDrawerRef.current.contains(event.target as Node)) {
        onOpenChange(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onOpenChange])

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isSending || !userId || !hasEnabledFiles) return

    const message = inputMessage.trim()
    setInputMessage('')
    
    await sendChatMessage(message, currentConversation?.conversationId)
  }, [inputMessage, isSending, userId, hasEnabledFiles, sendChatMessage, currentConversation?.conversationId])

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }, [handleSendMessage])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50">
      <div ref={chatDrawerRef} className="absolute right-0 top-0 h-full w-full max-w-2xl bg-neutral-950 border-l border-neutral-800 shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-indigo-400" />
            <h2 className="font-semibold text-neutral-200">
              {currentConversation?.title || 'AI Assistant'}
            </h2>
            {rateLimitInfo && (
              <span className="text-xs text-neutral-500">
                ({rateLimitInfo.remainingRequests} requests left)
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <ConversationHistory
              conversations={conversationsList}
              currentConversation={currentConversation}
              onSelectConversation={selectConversation}
              onDeleteConversation={removeConversation}
              onLoadMore={() => loadConversations(true)}
              hasMore={conversationsPagination.hasMore}
              isLoading={conversationsPagination.isLoading}
            />
            
            <Button
              variant="ghost"
              size="sm"
              onClick={startNewConversation}
              className="text-neutral-400 hover:text-neutral-200"
              title="New Conversation"
            >
              <Plus className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-neutral-400 hover:text-neutral-200"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-red-300">
              {error}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearError}
              className="text-red-400 hover:text-red-300 p-1"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {currentMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center text-neutral-500">
              <div>
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <h3 className="font-medium mb-2">Start a conversation</h3>
                <p className="text-sm">Ask questions about your documents</p>
              </div>
            </div>
          ) : (
            <div>
              {currentMessages.map((message) => (
                <MessageItem
                  key={message.messageId}
                  message={message}
                  isOptimistic={message.messageId.startsWith('optimistic_')}
                />
              ))}
              
              {isSending && (
                <div className="flex items-center gap-3 py-3 px-4">
                  <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-xs font-semibold text-neutral-300">
                    AI
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Thinking...
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/80 backdrop-blur">
          {!hasEnabledFiles ? (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-amber-400">
                  <AlertCircle className="w-4 h-4" />
                  <span>No enabled files in your knowledge base</span>
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  Enable some files in your knowledge base to start chatting
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about your documents..."
                  disabled={isSending || !userId}
                  className="bg-neutral-900 border-neutral-700 text-neutral-200 placeholder-neutral-500 focus:border-indigo-500"
                  maxLength={4000}
                />
              </div>
              
              <Button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isSending || !userId}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}