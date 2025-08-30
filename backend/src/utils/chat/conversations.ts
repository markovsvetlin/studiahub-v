import { db } from '../../db'
import { PutCommand, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'

import { CONVERSATIONS_TABLE } from '../constants';

const CONVERSATIONS_TABLE_NAME = CONVERSATIONS_TABLE;

export interface Conversation {
  conversationId: string
  userId: string
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
  status: 'active' | 'archived'
}

/**
 * Create a new conversation - ATOMIC operation
 */
export async function createConversation(
  userId: string,
  title: string = 'New Conversation'
): Promise<Conversation> {
  const now = new Date()
  const conversationId = uuidv4()
  
  const conversation: Conversation = {
    conversationId,
    userId,
    title,
    messageCount: 0,
    lastMessageAt: now.getTime(),
    tokenUsage: {
      totalPrompt: 0,
      totalCompletion: 0,
      totalTokens: 0
    },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    status: 'active'
  }

  await db.send(new PutCommand({
    TableName: CONVERSATIONS_TABLE_NAME,
    Item: conversation,
    ConditionExpression: 'attribute_not_exists(conversationId)' // Prevent duplicates
  }))

  return conversation
}

/**
 * Update conversation atomically with proper counters
 */
export async function updateConversationMetrics(
  conversationId: string,
  userId: string,
  updates: {
    incrementMessages?: number
    addPromptTokens?: number
    addCompletionTokens?: number
    updateTitle?: string
  }
): Promise<void> {
  const now = new Date()
  
  let updateExpression = 'SET lastMessageAt = :lastMessageAt, updatedAt = :updatedAt'
  const expressionAttributeValues: Record<string, any> = {
    ':lastMessageAt': now.getTime(),
    ':updatedAt': now.toISOString(),
    ':userId': userId
  }

  if (updates.incrementMessages) {
    updateExpression += ', messageCount = messageCount + :messageIncrement'
    expressionAttributeValues[':messageIncrement'] = updates.incrementMessages
  }

  if (updates.addPromptTokens) {
    updateExpression += ', tokenUsage.totalPrompt = tokenUsage.totalPrompt + :promptTokens'
    expressionAttributeValues[':promptTokens'] = updates.addPromptTokens
  }

  if (updates.addCompletionTokens) {
    updateExpression += ', tokenUsage.totalCompletion = tokenUsage.totalCompletion + :completionTokens'
    expressionAttributeValues[':completionTokens'] = updates.addCompletionTokens
  }

  // Update total tokens only once with the sum of both prompt and completion tokens
  if (updates.addPromptTokens || updates.addCompletionTokens) {
    const totalTokensToAdd = (updates.addPromptTokens || 0) + (updates.addCompletionTokens || 0)
    updateExpression += ', tokenUsage.totalTokens = tokenUsage.totalTokens + :totalTokens'
    expressionAttributeValues[':totalTokens'] = totalTokensToAdd
  }

  if (updates.updateTitle) {
    updateExpression += ', title = :title'
    expressionAttributeValues[':title'] = updates.updateTitle
  }

  await db.send(new UpdateCommand({
    TableName: CONVERSATIONS_TABLE_NAME,
    Key: { conversationId },
    UpdateExpression: updateExpression,
    ConditionExpression: 'userId = :userId AND #status = :activeStatus',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ...expressionAttributeValues,
      ':activeStatus': 'active'
    }
  }))
}

/**
 * Get user's conversations with cursor-based pagination
 */
export async function getUserConversations(
  userId: string,
  limit: number = 20,
  lastEvaluatedKey?: Record<string, any>
): Promise<{
  conversations: Conversation[]
  lastEvaluatedKey?: Record<string, any>
  hasMore: boolean
}> {
  const result = await db.send(new QueryCommand({
    TableName: CONVERSATIONS_TABLE_NAME,
    IndexName: 'user-conversations-index',
    KeyConditionExpression: 'userId = :userId',
    FilterExpression: '#status = :status',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':userId': userId,
      ':status': 'active'
    },
    ScanIndexForward: false, // Most recent first
    Limit: limit,
    ExclusiveStartKey: lastEvaluatedKey
  }))

  return {
    conversations: (result.Items || []) as Conversation[],
    lastEvaluatedKey: result.LastEvaluatedKey,
    hasMore: !!result.LastEvaluatedKey
  }
}

/**
 * Get specific conversation with authorization
 */
export async function getConversation(
  conversationId: string,
  userId: string
): Promise<Conversation | null> {
  const result = await db.send(new GetCommand({
    TableName: CONVERSATIONS_TABLE_NAME,
    Key: { conversationId }
  }))

  const conversation = result.Item as Conversation | undefined
  
  // Authorization check
  if (!conversation || conversation.userId !== userId || conversation.status !== 'active') {
    return null
  }

  return conversation
}

/**
 * Archive conversation (soft delete)
 */
export async function archiveConversation(
  conversationId: string,
  userId: string
): Promise<void> {
  await db.send(new UpdateCommand({
    TableName: CONVERSATIONS_TABLE_NAME,
    Key: { conversationId },
    UpdateExpression: 'SET #status = :archivedStatus, updatedAt = :updatedAt',
    ConditionExpression: 'userId = :userId AND #status = :activeStatus',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':userId': userId,
      ':archivedStatus': 'archived',
      ':activeStatus': 'active',
      ':updatedAt': new Date().toISOString()
    }
  }))
}