import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { getConversationMessages } from '../../utils/chat/messages'
import { getConversation, updateConversationMetrics } from '../../utils/chat/conversations'
import { generateConversationTitle } from '../../services/chat/gpt'
import { createSuccessResponse, createErrorResponse } from '../../utils/http'
import { validateUserId, createApiError, API_ERRORS, RATE_LIMITS } from '../../utils/validation'
import { checkRateLimit } from '../../utils/rateLimit'

interface GenerateTitleRequest {
  userId: string
}

export const generateTitle: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const conversationId = event.pathParameters?.conversationId
    const body = JSON.parse(event.body || '{}') as GenerateTitleRequest
    const { userId } = body

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

    console.log(`🏷️  Generating title for conversation: ${conversationId}`)

    // Verify conversation belongs to user
    const conversation = await getConversation(conversationId, normalizedUserId)
    if (!conversation) {
      return createErrorResponse(404, createApiError(
        API_ERRORS.CONVERSATION_NOT_FOUND,
        'Conversation not found'
      ))
    }

    // Get conversation messages
    const messagesResult = await getConversationMessages(conversationId, 10)
    if (messagesResult.messages.length === 0) {
      return createErrorResponse(400, createApiError(
        API_ERRORS.VALIDATION_FAILED,
        'Cannot generate title for empty conversation'
      ))
    }

    // Sort messages and get first few for title generation
    const sortedMessages = messagesResult.messages
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, 3) // Use first 3 messages
      .map(msg => msg.content)

    // Generate title using GPT
    const title = await generateConversationTitle(sortedMessages)

    // Update conversation with new title
    await updateConversationMetrics(conversationId, normalizedUserId, {
      updateTitle: title
    })

    console.log(`✅ Generated title: "${title}"`)

    return createSuccessResponse({
      title,
      conversationId,
      rateLimitInfo: {
        remainingRequests: rateLimitResult.remainingRequests,
        resetTime: rateLimitResult.resetTime
      }
    })

  } catch (error) {
    console.error('❌ Error generating conversation title:', error)
    
    if (error instanceof Error && error.message.includes('condition')) {
      return createErrorResponse(404, createApiError(
        API_ERRORS.CONVERSATION_NOT_FOUND,
        'Conversation not found or access denied'
      ))
    }
    
    return createErrorResponse(500, createApiError(
      API_ERRORS.INTERNAL_ERROR,
      'Failed to generate conversation title'
    ))
  }
}