import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { getUserConversations, getConversationMessages, getConversation } from '../../utils/chat/database'
import { createSuccessResponse, createErrorResponse } from '../../utils/http'

export const getConversations: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const userId = event.queryStringParameters?.userId

    if (!userId) {
      return createErrorResponse(400, 'userId parameter is required')
    }

    console.log(`📋 Getting conversations for user: ${userId}`)

    const conversations = await getUserConversations(userId)
    
    // Transform conversations for frontend
    const formattedConversations = conversations.map(conv => ({
      id: conv.id,
      title: conv.title || 'New Conversation',
      lastMessageAt: conv.lastMessageAt,
      messageCount: conv.messageCount,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt
    }))

    console.log(`✅ Found ${conversations.length} conversations`)

    return createSuccessResponse({
      conversations: formattedConversations
    })

  } catch (error) {
    console.error('❌ Error getting conversations:', error)
    return createErrorResponse(500, 'Something went wrong while fetching conversations')
  }
}

export const getConversationHandler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const conversationId = event.pathParameters?.conversationId
    const userId = event.queryStringParameters?.userId

    if (!conversationId || !userId) {
      return createErrorResponse(400, 'conversationId and userId are required')
    }

    console.log(`📖 Getting conversation ${conversationId} for user: ${userId}`)

    // Verify conversation belongs to user
    const conversation = await getConversation(conversationId, userId)
    if (!conversation) {
      return createErrorResponse(404, 'Conversation not found')
    }

    // Get all messages in conversation
    const messages = await getConversationMessages(conversationId, userId)
    
    // Sort messages by timestamp
    const sortedMessages = messages
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(msg => ({
        id: msg.id,
        type: msg.type,
        content: msg.content,
        timestamp: msg.timestamp,
        tokenUsage: msg.tokenUsage,
        sourceFiles: msg.sourceFiles,
        createdAt: msg.createdAt
      }))

    console.log(`✅ Found ${sortedMessages.length} messages in conversation`)

    return createSuccessResponse({
      conversation: {
        id: conversation.id,
        title: conversation.title || 'New Conversation',
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      },
      messages: sortedMessages
    })

  } catch (error) {
    console.error('❌ Error getting conversation:', error)
    return createErrorResponse(500, 'Something went wrong while fetching conversation')
  }
}