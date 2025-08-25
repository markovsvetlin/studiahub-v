import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { createSuccessResponse, createErrorResponse } from '../../utils/http'
import { validateUserId, SendMessageSchema, sanitizeMessage, containsHarmfulContent, createApiError, API_ERRORS } from '../../utils/validation'
import { checkRateLimit } from '../../utils/rateLimit'
import { RATE_LIMITS } from '../../utils/validation'
import { createConversation, updateConversationMetrics, getConversation } from '../../utils/chat/conversations'
import { createMessage, getConversationContext } from '../../utils/chat/messages'
import { prepareChatContext } from '../../services/chat/chatService'
import { generateChatResponse } from '../../services/chat/gptService'
import { v4 as uuidv4 } from 'uuid'

interface CompensatingAction {
  name: string
  action: () => Promise<void>
}

export const sendMessage: APIGatewayProxyHandlerV2 = async (event) => {
  const compensatingActions: CompensatingAction[] = []
  
  try {
    // Parse and validate input
    const body = JSON.parse(event.body || '{}')
    const validatedInput = SendMessageSchema.parse(body)
    
    // Normalize user ID
    const userId = validateUserId(validatedInput.userId)
    
    // Sanitize and validate message content
    const sanitizedMessage = sanitizeMessage(validatedInput.message)
    
    if (containsHarmfulContent(sanitizedMessage)) {
      return createErrorResponse(400, createApiError(
        API_ERRORS.CONTENT_FILTERED,
        'Message contains inappropriate content'
      ))
    }

    // Rate limiting check
    const rateLimitResult = checkRateLimit(userId, RATE_LIMITS.SEND_MESSAGE)
    if (!rateLimitResult.allowed) {
      return createErrorResponse(429, createApiError(
        API_ERRORS.RATE_LIMITED,
        'Too many requests. Please wait before sending another message.',
        { 
          retryAfterMs: rateLimitResult.retryAfterMs,
          resetTime: rateLimitResult.resetTime
        }
      ))
    }

    console.log(`📨 Processing message for user: ${userId}`)
    console.log(`🔄 Rate limit: ${rateLimitResult.remainingRequests} requests remaining`)

    let conversationId = validatedInput.conversationId
    let conversation
    let isNewConversation = false

    // Handle conversation creation/validation
    if (conversationId) {
      // Validate existing conversation
      conversation = await getConversation(conversationId, userId)
      if (!conversation) {
        return createErrorResponse(404, createApiError(
          API_ERRORS.CONVERSATION_NOT_FOUND,
          'Conversation not found or access denied'
        ))
      }
    } else {
      // Create new conversation
      conversation = await createConversation(userId, 'New Conversation')
      conversationId = conversation.conversationId
      isNewConversation = true
      
      // Add compensating action for conversation cleanup
      compensatingActions.push({
        name: 'delete-conversation',
        action: async () => {
          console.warn(`🔄 Rolling back conversation creation: ${conversationId}`)
          // Note: In production, you'd implement soft delete/cleanup
        }
      })
      
      console.log(`✅ Created new conversation: ${conversationId}`)
    }

    // Prepare chat context (get chunks and history)
    console.log(`🔍 Preparing chat context...`)
    const chatContext = await prepareChatContext(
      sanitizedMessage,
      userId,
      conversationId
    )
    
    console.log(`📚 Context prepared: ${chatContext.chunks.length} chunks, ${chatContext.conversationHistory.length} history messages`)

    // Create user message first (before AI call for better UX)
    const userMessage = await createMessage(
      conversationId,
      'user',
      sanitizedMessage
    )
    
    // Add compensating action for user message cleanup
    compensatingActions.push({
      name: 'cleanup-user-message',
      action: async () => {
        console.warn(`🔄 Rolling back user message creation: ${userMessage.messageId}`)
        // Note: Messages are immutable, so we'd mark as deleted in production
      }
    })

    console.log(`✅ Created user message: ${userMessage.messageId}`)

    // Generate AI response
    console.log(`🤖 Generating AI response...`)
    const aiResponse = await generateChatResponse(chatContext)
    
    console.log(`✅ AI response generated: ${aiResponse.tokenUsage.total} tokens`)

    // Create AI message
    const aiMessage = await createMessage(
      conversationId,
      'assistant',
      aiResponse.content,
      aiResponse.tokenUsage,
      aiResponse.sourceFiles,
      chatContext.chunks.map(c => c.id)
    )
    
    console.log(`✅ Created AI message: ${aiMessage.messageId}`)

    // Update conversation metadata atomically
    await updateConversationMetrics(conversationId, userId, {
      incrementMessages: 2, // User + AI message
      addPromptTokens: aiResponse.tokenUsage.prompt,
      addCompletionTokens: aiResponse.tokenUsage.completion
    })
    
    console.log(`✅ Updated conversation metrics`)

    // Success - clear compensating actions since we succeeded
    compensatingActions.length = 0

    const response = {
      conversationId,
      messageId: aiMessage.messageId,
      message: aiResponse.content,
      tokenUsage: aiResponse.tokenUsage,
      sourceFiles: aiResponse.sourceFiles,
      timestamp: aiMessage.timestamp,
      isNewConversation,
      rateLimitInfo: {
        remainingRequests: rateLimitResult.remainingRequests,
        resetTime: rateLimitResult.resetTime
      }
    }

    return createSuccessResponse(response)

  } catch (error) {
    console.error('❌ Error in sendMessage:', error)
    
    // Execute compensating actions (rollback)
    if (compensatingActions.length > 0) {
      console.log(`🔄 Executing ${compensatingActions.length} compensating actions...`)
      
      for (const action of compensatingActions.reverse()) {
        try {
          await action.action()
          console.log(`✅ Completed compensating action: ${action.name}`)
        } catch (rollbackError) {
          console.error(`❌ Failed compensating action ${action.name}:`, rollbackError)
        }
      }
    }

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('No enabled files')) {
        return createErrorResponse(400, createApiError(
          API_ERRORS.SERVICE_UNAVAILABLE,
          'No enabled files found in your knowledge base. Please enable some documents first.'
        ))
      }
      
      if (error.message.includes('content policy') || error.message.includes('content_filter')) {
        return createErrorResponse(400, createApiError(
          API_ERRORS.CONTENT_FILTERED,
          'Response was filtered due to content policy. Please try rephrasing your question.'
        ))
      }
      
      if (error.message.includes('OpenAI')) {
        return createErrorResponse(503, createApiError(
          API_ERRORS.SERVICE_UNAVAILABLE,
          'AI service temporarily unavailable. Please try again in a moment.'
        ))
      }
    }

    // Generic error response
    return createErrorResponse(500, createApiError(
      API_ERRORS.INTERNAL_ERROR,
      'Something went wrong while processing your message. Please try again.'
    ))
  }
}