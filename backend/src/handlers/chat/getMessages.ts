import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { createSuccessResponse, createErrorResponse } from '../../utils/http'
import { validateUserId, GetMessagesSchema, createApiError, API_ERRORS } from '../../utils/validation'
import { checkRateLimit } from '../../utils/rateLimit'
import { RATE_LIMITS } from '../../utils/validation'
import { getConversation } from '../../utils/chat/conversations'
import { getConversationMessages } from '../../utils/chat/messages'

export const getMessages: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    // Parse and validate query parameters
    const queryParams = {
      conversationId: event.pathParameters?.conversationId,
      userId: event.queryStringParameters?.userId,
      limit: parseInt(event.queryStringParameters?.limit || '50'),
      cursor: event.queryStringParameters?.cursor,
      direction: event.queryStringParameters?.direction || 'forward'
    }

    const validatedInput = GetMessagesSchema.parse(queryParams)
    const userId = validateUserId(validatedInput.userId)

    // Rate limiting
    const rateLimitResult = checkRateLimit(userId, RATE_LIMITS.GET_MESSAGES)
    if (!rateLimitResult.allowed) {
      return createErrorResponse(429, createApiError(
        API_ERRORS.RATE_LIMITED,
        'Too many requests. Please wait before making another request.',
        { 
          retryAfterMs: rateLimitResult.retryAfterMs,
          resetTime: rateLimitResult.resetTime
        }
      ))
    }

    // Verify conversation exists and user has access
    const conversation = await getConversation(validatedInput.conversationId, userId)
    if (!conversation) {
      return createErrorResponse(404, createApiError(
        API_ERRORS.CONVERSATION_NOT_FOUND,
        'Conversation not found or access denied'
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

    // Get messages with pagination
    const result = await getConversationMessages(
      validatedInput.conversationId,
      validatedInput.limit,
      lastEvaluatedKey,
      validatedInput.direction === 'forward'
    )

    // Create next cursor if there are more messages
    let nextCursor: string | undefined
    if (result.lastEvaluatedKey) {
      nextCursor = Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString('base64')
    }

    // Format messages for response
    const formattedMessages = result.messages.map(msg => ({
      messageId: msg.messageId,
      type: msg.type,
      content: msg.content,
      timestamp: msg.timestamp,
      tokenUsage: msg.tokenUsage,
      sourceFiles: msg.sourceFiles,
      createdAt: msg.createdAt
    }))

    const response = {
      conversationId: validatedInput.conversationId,
      messages: formattedMessages,
      pagination: {
        hasMore: result.hasMore,
        nextCursor,
        direction: validatedInput.direction,
        limit: validatedInput.limit
      },
      metadata: {
        conversationTitle: conversation.title,
        messageCount: conversation.messageCount,
        totalTokens: conversation.tokenUsage.totalTokens
      },
      rateLimitInfo: {
        remainingRequests: rateLimitResult.remainingRequests,
        resetTime: rateLimitResult.resetTime
      }
    }

    return createSuccessResponse(response)

  } catch (error) {
    console.error('❌ Error in getMessages:', error)

    if (error instanceof Error) {
      if (error.message.includes('validation') || error.message.includes('Invalid')) {
        return createErrorResponse(400, createApiError(
          API_ERRORS.VALIDATION_FAILED,
          'Invalid request parameters'
        ))
      }
    }

    return createErrorResponse(500, createApiError(
      API_ERRORS.INTERNAL_ERROR,
      'Failed to retrieve messages'
    ))
  }
}