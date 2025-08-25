import { db } from '../../db'
import { PutCommand, QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'

const MESSAGES_TABLE = process.env.MESSAGES_TABLE!

export interface Message {
  messageId: string
  conversationId: string
  type: 'user' | 'assistant'
  content: string
  timestamp: number
  tokenUsage?: {
    prompt: number
    completion: number
    total: number
  }
  sourceFiles?: string[]
  chunkIds?: string[]
  createdAt: string
  // No updatedAt - messages are immutable
}

/**
 * Create a message - ATOMIC operation
 */
export async function createMessage(
  conversationId: string,
  type: 'user' | 'assistant',
  content: string,
  tokenUsage?: Message['tokenUsage'],
  sourceFiles?: string[],
  chunkIds?: string[]
): Promise<Message> {
  const now = new Date()
  const messageId = uuidv4()
  const timestamp = now.getTime()
  
  // Add small random component to prevent collisions in high-frequency scenarios
  const uniqueTimestamp = timestamp * 1000 + Math.floor(Math.random() * 1000)
  
  const message: Message = {
    messageId,
    conversationId,
    type,
    content,
    timestamp: uniqueTimestamp,
    tokenUsage,
    sourceFiles,
    chunkIds,
    createdAt: now.toISOString()
  }

  await db.send(new PutCommand({
    TableName: MESSAGES_TABLE,
    Item: message,
    ConditionExpression: 'attribute_not_exists(conversationId) AND attribute_not_exists(#timestamp)',
    ExpressionAttributeNames: {
      '#timestamp': 'timestamp'
    }
  }))

  return message
}

/**
 * Get messages with cursor-based pagination
 */
export async function getConversationMessages(
  conversationId: string,
  limit: number = 50,
  lastEvaluatedKey?: Record<string, any>,
  scanForward: boolean = true // true = oldest first, false = newest first
): Promise<{
  messages: Message[]
  lastEvaluatedKey?: Record<string, any>
  hasMore: boolean
}> {
  const result = await db.send(new QueryCommand({
    TableName: MESSAGES_TABLE,
    KeyConditionExpression: 'conversationId = :conversationId',
    ExpressionAttributeValues: {
      ':conversationId': conversationId
    },
    ScanIndexForward: scanForward,
    Limit: limit,
    ExclusiveStartKey: lastEvaluatedKey
  }))

  return {
    messages: (result.Items || []) as Message[],
    lastEvaluatedKey: result.LastEvaluatedKey,
    hasMore: !!result.LastEvaluatedKey
  }
}

/**
 * Get recent messages for context (optimized for chat history)
 */
export async function getRecentMessages(
  conversationId: string,
  limit: number = 10
): Promise<Message[]> {
  const result = await db.send(new QueryCommand({
    TableName: MESSAGES_TABLE,
    KeyConditionExpression: 'conversationId = :conversationId',
    ExpressionAttributeValues: {
      ':conversationId': conversationId
    },
    ScanIndexForward: false, // Newest first
    Limit: limit
  }))

  // Return in chronological order (oldest first) for chat context
  const messages = (result.Items || []) as Message[]
  return messages.reverse()
}

/**
 * Get specific message by ID
 */
export async function getMessage(messageId: string): Promise<Message | null> {
  const result = await db.send(new QueryCommand({
    TableName: MESSAGES_TABLE,
    IndexName: 'message-id-index',
    KeyConditionExpression: 'messageId = :messageId',
    ExpressionAttributeValues: {
      ':messageId': messageId
    },
    Limit: 1
  }))

  const messages = result.Items as Message[] | undefined
  return messages?.[0] || null
}

/**
 * Get multiple messages by IDs (for optimistic update recovery)
 */
export async function getMessagesByIds(messageIds: string[]): Promise<Message[]> {
  if (messageIds.length === 0) return []
  
  const keys = messageIds.map(messageId => ({ messageId }))
  
  const result = await db.send(new BatchGetCommand({
    RequestItems: {
      [MESSAGES_TABLE]: {
        Keys: keys
      }
    }
  }))

  return (result.Responses?.[MESSAGES_TABLE] || []) as Message[]
}

/**
 * Get conversation context for AI (last N messages with token counting)
 */
export async function getConversationContext(
  conversationId: string,
  maxTokens: number = 4000,
  maxMessages: number = 20
): Promise<{
  messages: Array<{ role: 'user' | 'assistant', content: string }>
  tokenCount: number
  truncated: boolean
}> {
  const recentMessages = await getRecentMessages(conversationId, maxMessages)
  
  const contextMessages: Array<{ role: 'user' | 'assistant', content: string }> = []
  let tokenCount = 0
  let truncated = false
  
  // Estimate tokens (rough approximation: 1 token ≈ 0.75 words)
  const estimateTokens = (text: string) => Math.ceil(text.split(' ').length / 0.75)
  
  // Add messages from most recent, stopping when we hit token limit
  for (let i = recentMessages.length - 1; i >= 0; i--) {
    const message = recentMessages[i]
    const messageTokens = estimateTokens(message.content)
    
    if (tokenCount + messageTokens > maxTokens && contextMessages.length > 0) {
      truncated = true
      break
    }
    
    contextMessages.unshift({
      role: message.type,
      content: message.content
    })
    
    tokenCount += messageTokens
  }
  
  return {
    messages: contextMessages,
    tokenCount,
    truncated
  }
}