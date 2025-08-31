/**
 * Unified Chat Service - handles all chat operations
 */

import fetch from 'node-fetch';
import { findRelevantChunks } from '../files/ChatSearchService';
import { getUserEnabledFiles } from '../../utils/files/database';
import { validateUsage, incrementTokensUsed } from '../../utils/usage/database';
import { 
  createConversation, 
  getConversation, 
  getUserConversations,
  updateConversationMetrics,
  archiveConversation 
} from '../../utils/chat/conversations';
import { 
  createMessage, 
  getConversationMessages,
  getConversationContext 
} from '../../utils/chat/messages';

export interface SendMessageRequest {
  message: string;
  conversationId?: string;
  userId: string;
}

export interface SendMessageResult {
  conversationId: string;
  messageId: string;
  message: string;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  sourceFiles: string[];
  timestamp: number;
  isNewConversation: boolean;
}

export class ChatService {
  /**
   * Send a message and get AI response
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResult> {
    const { message, conversationId, userId } = request;
    
    // Validate usage
    const validation = await validateUsage(userId, 'tokens', 10);
    if (!validation.canProceed) {
      throw new Error(validation.message!);
    }

    // Handle conversation
    let currentConversationId = conversationId;
    let isNewConversation = false;
    
    if (conversationId) {
      const conversation = await getConversation(conversationId, userId);
      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }
    } else {
      const conversation = await createConversation(userId, 'New Conversation');
      currentConversationId = conversation.conversationId;
      isNewConversation = true;
    }

    // Get relevant chunks
    const chunks = await findRelevantChunks(message, userId, 5);
    
    // Get conversation history
    let conversationHistory: Array<{ role: 'user' | 'assistant', content: string }> = [];
    if (currentConversationId) {
      const context = await getConversationContext(currentConversationId, 3000, 10);
      conversationHistory = context.messages;
    }

    // Create user message
    const userMessage = await createMessage(currentConversationId!, 'user', message);
    
    // Generate AI response
    const aiResponse = await this.generateResponse(chunks, conversationHistory, message);
    
    // Update token usage
    await incrementTokensUsed(userId, aiResponse.tokenUsage.total);
    
    // Create AI message
    const aiMessage = await createMessage(
      currentConversationId!,
      'assistant',
      aiResponse.content,
      aiResponse.tokenUsage,
      aiResponse.sourceFiles,
      chunks.map(c => c.id)
    );
    
    // Update conversation metrics
    await updateConversationMetrics(currentConversationId!, userId, {
      incrementMessages: 2,
      addPromptTokens: aiResponse.tokenUsage.prompt,
      addCompletionTokens: aiResponse.tokenUsage.completion
    });

    return {
      conversationId: currentConversationId!,
      messageId: aiMessage.messageId,
      message: aiResponse.content,
      tokenUsage: aiResponse.tokenUsage,
      sourceFiles: aiResponse.sourceFiles,
      timestamp: aiMessage.timestamp,
      isNewConversation
    };
  }

  /**
   * Get user conversations
   */
  async getUserConversations(userId: string, limit = 20, cursor?: string): Promise<any> {
    let lastEvaluatedKey: Record<string, any> | undefined;
    if (cursor) {
      try {
        lastEvaluatedKey = JSON.parse(Buffer.from(cursor, 'base64').toString());
      } catch {
        throw new Error('Invalid cursor format');
      }
    }

    const result = await getUserConversations(userId, limit, lastEvaluatedKey);

    let nextCursor: string | undefined;
    if (result.lastEvaluatedKey) {
      nextCursor = Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString('base64');
    }

    return {
      conversations: result.conversations.map(conv => ({
        conversationId: conv.conversationId,
        title: conv.title,
        messageCount: conv.messageCount,
        lastMessageAt: conv.lastMessageAt,
        tokenUsage: conv.tokenUsage,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      })),
      pagination: {
        hasMore: result.hasMore,
        nextCursor,
        limit
      }
    };
  }

  /**
   * Get conversation messages
   */
  async getConversationMessages(conversationId: string, userId: string, limit = 50, cursor?: string, direction = 'forward'): Promise<any> {
    // Verify conversation access
    const conversation = await getConversation(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found or access denied');
    }

    let lastEvaluatedKey: Record<string, any> | undefined;
    if (cursor) {
      try {
        lastEvaluatedKey = JSON.parse(Buffer.from(cursor, 'base64').toString());
      } catch {
        throw new Error('Invalid cursor format');
      }
    }

    const result = await getConversationMessages(
      conversationId,
      limit,
      lastEvaluatedKey,
      direction === 'forward'
    );

    return {
      conversationId,
      messages: result.messages.map(msg => ({
        messageId: msg.messageId,
        type: msg.type,
        content: msg.content,
        timestamp: msg.timestamp,
        tokenUsage: msg.tokenUsage,
        sourceFiles: msg.sourceFiles,
        createdAt: msg.createdAt
      })),
      pagination: {
        hasMore: result.hasMore,
        nextCursor: result.lastEvaluatedKey ? Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString('base64') : undefined,
        direction,
        limit
      },
      metadata: {
        conversationTitle: conversation.title,
        messageCount: conversation.messageCount,
        totalTokens: conversation.tokenUsage.totalTokens
      }
    };
  }

  /**
   * Delete conversation
   */
  async deleteConversation(conversationId: string, userId: string): Promise<{ conversationId: string; archived: boolean; archivedAt: string }> {
    await archiveConversation(conversationId, userId);
    return {
      conversationId,
      archived: true,
      archivedAt: new Date().toISOString()
    };
  }

  /**
   * Generate conversation title
   */
  async generateConversationTitle(conversationId: string, userId: string): Promise<{ title: string; conversationId: string }> {
    const conversation = await getConversation(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const messagesResult = await getConversationMessages(conversationId, 10);
    if (messagesResult.messages.length === 0) {
      throw new Error('Cannot generate title for empty conversation');
    }

    const sortedMessages = messagesResult.messages
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, 3)
      .map(msg => msg.content);

    const title = await this.generateTitle(sortedMessages);
    await updateConversationMetrics(conversationId, userId, {
      updateTitle: title
    });

    return { title, conversationId };
  }

  // Private methods

  private async generateResponse(chunks: any[], history: any[], message: string) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OpenAI API key not configured');

    const contextText = chunks
      .map(chunk => `[Source: ${chunk.metadata?.fileName || 'Unknown'}]\n${chunk.text}`)
      .join('\n\n---\n\n');

    const messages = [
      {
        role: 'system',
        content: `You are an AI assistant helping users understand their documents. Answer based on the provided context.

CONTEXT:
${contextText}`
      },
      ...history.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.3,
        max_tokens: 1500
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    return {
      content,
      tokenUsage: {
        prompt: data.usage?.prompt_tokens || 0,
        completion: data.usage?.completion_tokens || 0,
        total: data.usage?.total_tokens || 0
      },
      sourceFiles: Array.from(new Set(chunks.map(c => c.metadata?.fileName || 'Unknown')))
    };
  }

  private async generateTitle(messages: string[]): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return 'New Conversation';

    const conversationSample = messages.slice(0, 2).join('\n\n');
    if (!conversationSample.trim()) return 'New Conversation';

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Generate a concise, professional title for this conversation. Respond with just the title, 2-6 words maximum.'
            },
            {
              role: 'user',
              content: `Generate title for: ${conversationSample}`
            }
          ],
          temperature: 0.3,
          max_tokens: 20
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json() as any;
      const title = data.choices?.[0]?.message?.content?.trim();

      if (!title) return 'New Conversation';

      return title
        .replace(/^["']|["']$/g, '')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .substring(0, 50) || 'New Conversation';

    } catch (error) {
      console.warn('Title generation failed:', error);
      return 'New Conversation';
    }
  }
}