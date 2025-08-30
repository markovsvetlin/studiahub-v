import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { createMessage, createOrUpdateConversation, getConversationMessages } from '../../utils/chat/database'
import { generateChatResponse, ChatContext } from '../../services/chat/gpt'
import { findRelevantChunks } from '../../services/files/ChatSearchService'
import { getUserEnabledFiles } from '../../utils/files/database'
import { createSuccessResponse, createErrorResponse } from '../../utils/http'
import { v4 as uuidv4 } from 'uuid'

interface SendMessageRequest {
  message: string
  conversationId?: string
  userId: string
}

export const sendMessage: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}') as SendMessageRequest
    const { message, conversationId, userId } = body

    if (!message?.trim() || !userId) {
      return createErrorResponse(400, 'Message and userId are required')
    }

    console.log(`📨 Processing chat message for user: ${userId}`)

    // Get user's enabled files
    const enabledFiles = await getUserEnabledFiles(userId)
    if (enabledFiles.length === 0) {
      return createErrorResponse(400, 'No enabled files found in knowledge base')
    }

    console.log(`📚 Found ${enabledFiles.length} enabled files`)

    // Find relevant chunks using vector search
    const relevantChunks = await findRelevantChunks(message, userId, 5)
    console.log(`🔍 Found ${relevantChunks.length} relevant chunks`)

    // Create or use existing conversation ID
    const currentConversationId = conversationId || uuidv4()

    // Get conversation history if existing conversation
    let conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = []
    if (conversationId) {
      const messages = await getConversationMessages(conversationId, userId)
      conversationHistory = messages
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-10) // Last 10 messages for context
        .map(msg => ({
          role: msg.type,
          content: msg.content
        }))
    }

    // Save user message
    await createMessage(
      currentConversationId,
      userId,
      'user',
      message.trim()
    )

    // Prepare context for GPT
    const chatContext: ChatContext = {
      chunks: relevantChunks.map(chunk => ({
        id: chunk.id,
        text: chunk.text,
        fileName: chunk.metadata?.fileName || 'Unknown',
        fileId: chunk.metadata?.fileId || ''
      })),
      messages: conversationHistory
    }

    // Generate AI response
    const aiResponse = await generateChatResponse(chatContext, message)

    // Save AI message
    await createMessage(
      currentConversationId,
      userId,
      'assistant',
      aiResponse.content,
      aiResponse.tokenUsage,
      aiResponse.sourceFiles,
      relevantChunks.map(c => c.id)
    )

    // Update conversation metadata
    await createOrUpdateConversation(currentConversationId, userId)

    return createSuccessResponse({
      conversationId: currentConversationId,
      message: aiResponse.content,
      tokenUsage: aiResponse.tokenUsage,
      sourceFiles: aiResponse.sourceFiles,
      timestamp: Date.now()
    })

  } catch (error) {
    console.error('❌ Error in chat send:', error)
    return createErrorResponse(500, 'Something went wrong while processing your message')
  }
}