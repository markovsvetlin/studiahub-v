import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { createSuccessResponse, createErrorResponse } from '../../utils/http'
import { ChatService } from '../../services/chat/ChatService'

const chatService = new ChatService()

export const getConversations: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const userId = event.queryStringParameters?.userId
    const limit = parseInt(event.queryStringParameters?.limit || '20')
    const cursor = event.queryStringParameters?.cursor

    if (!userId) {
      return createErrorResponse(400, 'userId parameter is required')
    }

    const result = await chatService.getUserConversations(userId, limit, cursor)
    return createSuccessResponse(result)

  } catch (error) {
    console.error('Error getting conversations:', error)
    return createErrorResponse(500, (error as Error).message)
  }
}

export const deleteConversation: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const conversationId = event.pathParameters?.conversationId
    const userId = event.queryStringParameters?.userId

    if (!conversationId || !userId) {
      return createErrorResponse(400, 'conversationId and userId are required')
    }

    const result = await chatService.deleteConversation(conversationId, userId)
    return createSuccessResponse(result)

  } catch (error) {
    console.error('Error deleting conversation:', error)
    return createErrorResponse(500, (error as Error).message)
  }
}