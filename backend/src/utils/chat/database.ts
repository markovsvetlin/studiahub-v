import { db } from '../../db'
import { PutCommand, QueryCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'

import { CHAT_TABLE } from '../constants';

const CHAT_TABLE_NAME = CHAT_TABLE;

export interface ChatMessage {
  id: string
  conversationId: string
  userId: string
  type: 'user' | 'assistant'
  content: string
  timestamp: number
  tokenUsage?: {
    prompt: number
    completion: number
    total: number
  }
  sourceFiles?: string[]
  chunks?: string[]
  createdAt: string
  updatedAt: string
}

export interface Conversation {
  id: string
  userId: string
  title?: string
  timestamp: number
  lastMessageAt: number
  messageCount: number
  createdAt: string
  updatedAt: string
}

export async function createMessage(
  conversationId: string,
  userId: string,
  type: 'user' | 'assistant',
  content: string,
  tokenUsage?: ChatMessage['tokenUsage'],
  sourceFiles?: string[],
  chunks?: string[]
): Promise<ChatMessage> {
  const now = new Date()
  const timestamp = now.getTime()
  
  const message = {
    id: uuidv4(),
    conversationId,
    userId,
    type,
    content,
    timestamp,
    tokenUsage,
    sourceFiles,
    chunks,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    recordType: 'message' // Add record type to distinguish from conversations
  }

  await db.send(new PutCommand({
    TableName: CHAT_TABLE_NAME,
    Item: message
  }))

  return message as ChatMessage
}

export async function getConversationMessages(
  conversationId: string,
  userId: string
): Promise<ChatMessage[]> {
  const result = await db.send(new QueryCommand({
    TableName: CHAT_TABLE_NAME,
    IndexName: 'conversation-index',
    KeyConditionExpression: 'conversationId = :conversationId',
    FilterExpression: 'userId = :userId AND recordType = :recordType',
    ExpressionAttributeValues: {
      ':conversationId': conversationId,
      ':userId': userId,
      ':recordType': 'message'
    },
    ScanIndexForward: true // Sort by timestamp ascending
  }))

  return (result.Items || []) as ChatMessage[]
}

export async function getUserConversations(userId: string): Promise<Conversation[]> {
  const result = await db.send(new QueryCommand({
    TableName: CHAT_TABLE_NAME,
    IndexName: 'user-index',
    KeyConditionExpression: 'userId = :userId',
    FilterExpression: 'recordType = :recordType',
    ExpressionAttributeValues: {
      ':userId': userId,
      ':recordType': 'conversation'
    },
    ScanIndexForward: false // Sort by timestamp descending (newest first)
  }))

  return (result.Items || []) as Conversation[]
}

export async function createOrUpdateConversation(
  conversationId: string,
  userId: string,
  title?: string
): Promise<Conversation> {
  const now = new Date()
  const timestamp = now.getTime()

  try {
    // Create a specific conversation record ID to avoid conflicts with messages
    const conversationRecordId = `conv_${conversationId}`
    
    // Try to get existing conversation
    const existing = await db.send(new GetCommand({
      TableName: CHAT_TABLE_NAME,
      Key: { id: conversationRecordId }
    }))

    if (existing.Item) {
      // Update existing conversation
      const conversation = existing.Item as Conversation & { type: string }
      const updatedConversation = {
        ...conversation,
        title: title || conversation.title,
        lastMessageAt: timestamp,
        messageCount: (conversation.messageCount || 0) + 1,
        updatedAt: now.toISOString()
      }

      await db.send(new PutCommand({
        TableName: CHAT_TABLE_NAME,
        Item: updatedConversation
      }))

      return updatedConversation
    } else {
      // Create new conversation record with userId
      const conversationRecord = {
        id: conversationRecordId, // Use conv_ prefix to distinguish from messages
        conversationId, // Keep original conversation ID for reference
        userId, // CRUCIAL: Add userId for GSI querying
        title,
        timestamp,
        lastMessageAt: timestamp,
        messageCount: 1,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        recordType: 'conversation' // Add type for filtering
      }

      await db.send(new PutCommand({
        TableName: CHAT_TABLE_NAME,
        Item: conversationRecord
      }))

      return conversationRecord as Conversation
    }
  } catch (error) {
    console.error('Error creating/updating conversation:', error)
    throw error
  }
}

export async function updateConversationTitle(
  conversationId: string,
  userId: string,
  title: string
): Promise<void> {
  const now = new Date()
  const conversationRecordId = `conv_${conversationId}`
  
  await db.send(new UpdateCommand({
    TableName: CHAT_TABLE_NAME,
    Key: { id: conversationRecordId },
    UpdateExpression: 'SET title = :title, updatedAt = :updatedAt',
    ConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':title': title,
      ':updatedAt': now.toISOString(),
      ':userId': userId
    }
  }))
}

export async function getConversation(
  conversationId: string,
  userId: string
): Promise<Conversation | null> {
  const conversationRecordId = `conv_${conversationId}`
  const result = await db.send(new GetCommand({
    TableName: CHAT_TABLE_NAME,
    Key: { id: conversationRecordId }
  }))

  const conversation = result.Item as (Conversation & { userId: string }) | undefined
  if (!conversation || conversation.userId !== userId) {
    return null
  }

  return conversation
}