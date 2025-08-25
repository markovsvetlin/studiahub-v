'use client'
import { useState, useRef, useEffect } from 'react'
import { 
  MessageCircle, 
  X, 
  Send, 
  FileText,
  History,
  Plus,
  ChevronDown,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useChat } from '../hooks/useChat'
import type { ChatMessage, Conversation } from '../services/chat'

interface ChatDrawerProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  userId?: string
  hasEnabledFiles: boolean
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.type === 'user'
  
  return (
    <div className={cn(
      "flex flex-col gap-1",
      isUser ? "items-end" : "items-start"
    )}>
      <div className={cn(
        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
        isUser 
          ? "bg-indigo-600 text-white" 
          : "bg-neutral-800 text-neutral-200 border border-neutral-700"
      )}>
        <div className="whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
      
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs text-neutral-500">
          {formatTime(message.timestamp)}
        </span>
        
        {message.tokenUsage && (
          <span className="text-xs text-neutral-500">
            {message.tokenUsage.total} tokens
          </span>
        )}
      </div>

      {/* Source Files */}
      {message.sourceFiles && message.sourceFiles.length > 0 && (
        <div className="flex flex-wrap gap-1 px-1 max-w-[85%]">
          {message.sourceFiles.map((fileName, index) => (
            <div
              key={index}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-neutral-800/50 border border-neutral-700 rounded text-neutral-400"
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

function ChatHistory({ 
  conversations, 
  onSelectConversation, 
  isLoading 
}: { 
  conversations: Conversation[]
  onSelectConversation: (conversationId: string) => void
  isLoading: boolean 
}) {
  const [isOpen, setIsOpen] = useState(false)

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading...
      </Button>
    )
  }

  return (
    <div className="relative">
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
        <div className="absolute top-full right-0 mt-1 w-64 bg-neutral-900 border border-neutral-700 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-3 text-sm text-neutral-500 text-center">
              No conversations yet
            </div>
          ) : (
            <div className="p-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => {
                    onSelectConversation(conv.id)
                    setIsOpen(false)
                  }}
                  className="w-full text-left p-2 rounded hover:bg-neutral-800 text-sm group"
                >
                  <div className="font-medium text-neutral-200 truncate">
                    {conv.title}
                  </div>
                  <div className="text-xs text-neutral-500 flex items-center justify-between mt-1">
                    <span>{conv.messageCount} messages</span>
                    <span>{new Date(conv.lastMessageAt).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ChatDrawer({ isOpen, onOpenChange, userId, hasEnabledFiles }: ChatDrawerProps) {
  const [inputMessage, setInputMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    messages,
    currentConversation,
    isLoading,
    error,
    conversations,
    isLoadingHistory,
    sendMessage,
    loadConversation,
    startNewConversation,
    clearError
  } = useChat(userId)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !userId) return

    const message = inputMessage.trim()
    setInputMessage('')
    
    await sendMessage(message, currentConversation?.id)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50">
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-neutral-950 border-l border-neutral-800 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-indigo-400" />
            <h2 className="font-semibold text-neutral-200">
              {currentConversation?.title || 'Chat Assistant'}
            </h2>
          </div>
          
          <div className="flex items-center gap-2">
            <ChatHistory
              conversations={conversations}
              onSelectConversation={loadConversation}
              isLoading={isLoadingHistory}
            />
            
            <Button
              variant="ghost"
              size="sm"
              onClick={startNewConversation}
              className="text-neutral-400 hover:text-neutral-200"
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
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-neutral-500 mt-12">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <h3 className="font-medium mb-1">Start a conversation</h3>
              <p className="text-sm">Ask questions about your documents</p>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}
          
          {isLoading && (
            <div className="flex items-start gap-2">
              <div className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Thinking...
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-neutral-800">
          {!hasEnabledFiles ? (
            <Card>
              <CardContent className="p-3">
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
                  disabled={isLoading || !userId}
                  className="bg-neutral-900 border-neutral-700 text-neutral-200 placeholder-neutral-500 focus:border-indigo-500"
                />
              </div>
              
              <Button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading || !userId}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3"
              >
                {isLoading ? (
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