import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { createSuccessResponse, createErrorResponse } from '../../utils/http'
import { ChatService } from '../../services/chat/ChatService'

const chatService = new ChatService()

export const sendMessage: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}')
    const { message, conversationId, userId } = body

    if (!message?.trim() || !userId) {
      return createErrorResponse(400, 'Message and userId are required')
    }

    const result = await chatService.sendMessage({
      message: message.trim(),
      conversationId,
      userId
    })

    return createSuccessResponse(result)

  } catch (error) {
    console.error('Error in chat send:', error)
    return createErrorResponse(500, (error as Error).message)
  }
}