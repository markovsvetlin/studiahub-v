import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { createSuccessResponse, createErrorResponse } from '../../utils/http'
import { ChatService } from '../../services/chat/ChatService'

const chatService = new ChatService()

export const getMessages: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const conversationId = event.pathParameters?.conversationId
    const userId = event.queryStringParameters?.userId
    const limit = parseInt(event.queryStringParameters?.limit || '50')
    const cursor = event.queryStringParameters?.cursor
    const direction = event.queryStringParameters?.direction || 'forward'

    if (!conversationId || !userId) {
      return createErrorResponse(400, 'conversationId and userId are required')
    }

    const result = await chatService.getConversationMessages(conversationId, userId, limit, cursor, direction)
    return createSuccessResponse(result)

  } catch (error) {
    console.error('Error getting messages:', error)
    return createErrorResponse(500, (error as Error).message)
  }
}