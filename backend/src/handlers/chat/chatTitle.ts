import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { createSuccessResponse, createErrorResponse } from '../../utils/http'
import { ChatService } from '../../services/chat/ChatService'

const chatService = new ChatService()

export const generateTitle: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const conversationId = event.pathParameters?.conversationId
    const body = JSON.parse(event.body || '{}')
    const { userId } = body

    if (!conversationId || !userId) {
      return createErrorResponse(400, 'conversationId and userId are required')
    }

    const result = await chatService.generateConversationTitle(conversationId, userId)
    return createSuccessResponse(result)

  } catch (error) {
    console.error('Error generating conversation title:', error)
    return createErrorResponse(500, (error as Error).message)
  }
}