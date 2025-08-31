import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { createSuccessResponse, createErrorResponse } from '../../utils/http'
import { ChatService } from '../../services/chat/ChatService'
import { validateJWT } from '../../middleware/jwtAuth'

const chatService = new ChatService()

export const sendMessage: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    // Validate JWT token and get userId
    const { userId, error } = await validateJWT(event)
    if (!userId || error) {
      return createErrorResponse(401, error || 'Unauthorized')
    }

    const body = JSON.parse(event.body || '{}')
    const { message, conversationId } = body

    if (!message?.trim()) {
      return createErrorResponse(400, 'Message is required')
    }

    const result = await chatService.sendMessage({
      message: message.trim(),
      conversationId,
      userId // Use userId from JWT token
    })

    return createSuccessResponse(result)

  } catch (error) {
    console.error('Error in chat send:', error)
    return createErrorResponse(500, (error as Error).message)
  }
}