import fetch from 'node-fetch'

export interface ChatContext {
  chunks: Array<{
    id: string
    text: string
    fileName: string
    fileId: string
  }>
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
}

export interface ChatResponse {
  content: string
  tokenUsage: {
    prompt: number
    completion: number
    total: number
  }
  sourceFiles: string[]
}

export function createChatPrompt(context: ChatContext, userMessage: string): string {
  const contextText = context.chunks
    .map(chunk => `[${chunk.fileName}]\n${chunk.text}`)
    .join('\n\n---\n\n')

  return `You are an AI assistant helping users understand their documents. Use the provided context to answer questions accurately and helpfully.

CONTEXT FROM USER'S DOCUMENTS:
${contextText}

CONVERSATION HISTORY:
${context.messages.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n')}

USER: ${userMessage}

Instructions:
- Answer based primarily on the provided context
- If the context doesn't contain relevant information, say so clearly
- Be concise but thorough
- Reference specific documents when relevant
- Maintain conversation context from previous messages

ASSISTANT:`
}

export async function generateChatResponse(
  context: ChatContext,
  userMessage: string
): Promise<ChatResponse> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const prompt = createChatPrompt(context, userMessage)
  const conversationMessages = [
    {
      role: 'system' as const,
      content: 'You are an AI assistant specializing in helping users understand their documents. Always provide accurate, helpful responses based on the provided context.'
    },
    {
      role: 'user' as const,
      content: prompt
    }
  ]

  console.log(`🤖 Generating chat response using GPT-4o-mini`)
  console.log(`📚 Using ${context.chunks.length} chunks from ${new Set(context.chunks.map(c => c.fileName)).size} files`)

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: conversationMessages,
        temperature: 0.3, // Lower temperature for more focused responses
        max_tokens: 1000,
        stream: false
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json() as any
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No content received from OpenAI')
    }

    const tokenUsage = {
      prompt: data.usage?.prompt_tokens || 0,
      completion: data.usage?.completion_tokens || 0,
      total: data.usage?.total_tokens || 0
    }

    const sourceFiles = Array.from(new Set(context.chunks.map(c => c.fileName)))

    console.log(`✅ Generated chat response with ${tokenUsage.total} tokens`)

    return {
      content,
      tokenUsage,
      sourceFiles
    }

  } catch (error) {
    console.error('❌ Failed to generate chat response:', error)
    throw error instanceof Error ? error : new Error('Unknown error in chat generation')
  }
}

export async function generateConversationTitle(messages: string[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const conversationSample = messages.slice(0, 3).join('\n\n')
  
  const prompt = `Generate a short, descriptive title (2-6 words) for this conversation:

${conversationSample}

Title should:
- Be concise and descriptive
- Capture the main topic or question
- Not include quotes or special characters
- Be suitable for a chat history list

Title:`

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
            content: 'You are a helpful assistant that generates concise, descriptive titles for conversations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 20
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json() as any
    const title = data.choices?.[0]?.message?.content?.trim()

    if (!title) {
      return 'New Conversation'
    }

    // Clean up the title
    const cleanTitle = title
      .replace(/^["']|["']$/g, '') // Remove quotes
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .trim()
      .substring(0, 50) // Limit length

    return cleanTitle || 'New Conversation'

  } catch (error) {
    console.error('❌ Failed to generate conversation title:', error)
    return 'New Conversation'
  }
}