import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { createSuccessResponse, createErrorResponse } from '../../utils/http'
import { validateUserId, GetConversationsSchema, createApiError, API_ERRORS } from '../../utils/validation'
import { checkRateLimit } from '../../utils/rateLimit'
import { RATE_LIMITS } from '../../utils/validation'
import { getUserConversations, archiveConversation } from '../../utils/chat/conversations'

export const getConversations: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    // Parse and validate query parameters
    const queryParams = {
      userId: event.queryStringParameters?.userId,
      limit: parseInt(event.queryStringParameters?.limit || '20'),
      cursor: event.queryStringParameters?.cursor
    }

    const validatedInput = GetConversationsSchema.parse(queryParams)
    const userId = validateUserId(validatedInput.userId)

    // Rate limiting
    const rateLimitResult = checkRateLimit(userId, RATE_LIMITS.GET_MESSAGES)
    if (!rateLimitResult.allowed) {
      return createErrorResponse(429, createApiError(
        API_ERRORS.RATE_LIMITED,
        'Too many requests',
        { 
          retryAfterMs: rateLimitResult.retryAfterMs,
          resetTime: rateLimitResult.resetTime
        }
      ))
    }

    // Parse cursor for pagination
    let lastEvaluatedKey: Record<string, any> | undefined
    if (validatedInput.cursor) {
      try {
        lastEvaluatedKey = JSON.parse(Buffer.from(validatedInput.cursor, 'base64').toString())
      } catch {
        return createErrorResponse(400, createApiError(
          API_ERRORS.VALIDATION_FAILED,
          'Invalid cursor format'
        ))
      }
    }

    // Get user's conversations
    const result = await getUserConversations(
      userId,
      validatedInput.limit,
      lastEvaluatedKey
    )

    // Create next cursor
    let nextCursor: string | undefined
    if (result.lastEvaluatedKey) {
      nextCursor = Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString('base64')
    }

    // Format conversations for response
    const formattedConversations = result.conversations.map(conv => ({
      conversationId: conv.conversationId,
      title: conv.title,
      messageCount: conv.messageCount,
      lastMessageAt: conv.lastMessageAt,
      tokenUsage: conv.tokenUsage,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt
    }))

    const response = {
      conversations: formattedConversations,
      pagination: {
        hasMore: result.hasMore,
        nextCursor,
        limit: validatedInput.limit
      },
      summary: {
        totalConversations: formattedConversations.length,
        totalTokensUsed: formattedConversations.reduce((sum, conv) => sum + conv.tokenUsage.totalTokens, 0)
      },
      rateLimitInfo: {
        remainingRequests: rateLimitResult.remainingRequests,
        resetTime: rateLimitResult.resetTime
      }
    }

    return createSuccessResponse(response)

  } catch (error) {
    console.error('❌ Error in getConversations:', error)
    
    return createErrorResponse(500, createApiError(
      API_ERRORS.INTERNAL_ERROR,
      'Failed to retrieve conversations'
    ))
  }
}

export const deleteConversation: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const conversationId = event.pathParameters?.conversationId
    const userId = event.queryStringParameters?.userId

    if (!conversationId || !userId) {
      return createErrorResponse(400, createApiError(
        API_ERRORS.VALIDATION_FAILED,
        'conversationId and userId are required'
      ))
    }

    const normalizedUserId = validateUserId(userId)

    // Rate limiting
    const rateLimitResult = checkRateLimit(normalizedUserId, RATE_LIMITS.GET_MESSAGES)
    if (!rateLimitResult.allowed) {
      return createErrorResponse(429, createApiError(
        API_ERRORS.RATE_LIMITED,
        'Too many requests',
        { retryAfterMs: rateLimitResult.retryAfterMs }
      ))
    }

    // Archive conversation (soft delete)
    await archiveConversation(conversationId, normalizedUserId)

    const response = {
      conversationId,
      archived: true,
      archivedAt: new Date().toISOString()
    }

    return createSuccessResponse(response)

  } catch (error) {
    console.error('❌ Error in deleteConversation:', error)
    
    if (error instanceof Error && error.message.includes('condition')) {
      return createErrorResponse(404, createApiError(
        API_ERRORS.CONVERSATION_NOT_FOUND,
        'Conversation not found or access denied'
      ))
    }

    return createErrorResponse(500, createApiError(
      API_ERRORS.INTERNAL_ERROR,
      'Failed to delete conversation'
    ))
  }
}