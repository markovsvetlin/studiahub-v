import fetch from 'node-fetch'

export interface ChatResponse {
  content: string
  tokenUsage: {
    prompt: number
    completion: number
    total: number
  }
  sourceFiles: string[]
  finishReason: 'stop' | 'length' | 'content_filter' | 'null'
}

export interface ChatContext {
  chunks: Array<{
    id: string
    text: string
    fileName: string
    fileId: string
  }>
  conversationHistory: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
  userMessage: string
}

/**
 * Create optimized chat prompt with proper context management
 */
function createChatPrompt(context: ChatContext): Array<{ role: string, content: string }> {
  const contextText = context.chunks
    .map(chunk => `[Source: ${chunk.fileName}]\n${chunk.text}`)
    .join('\n\n---\n\n')

  const systemPrompt = `You are an AI assistant helping users understand their documents. Follow these guidelines:

CONTEXT PROVIDED:
${contextText}

INSTRUCTIONS:
- Answer based primarily on the provided context
- If context doesn't contain relevant information, clearly state this
- Be concise but thorough in your responses  
- Reference specific documents when relevant
- Maintain conversational tone
- If asked about something not in the context, offer to help find relevant information

CONVERSATION CONTEXT:
The user has access to documents in their knowledge base. Use the conversation history to maintain context and provide coherent responses.`

  const messages = [
    { role: 'system', content: systemPrompt }
  ]

  // Add conversation history (limit to prevent context overflow)
  const historyLimit = Math.min(context.conversationHistory.length, 10)
  const recentHistory = context.conversationHistory.slice(-historyLimit)
  
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    })
  }

  // Add current user message
  messages.push({
    role: 'user',
    content: context.userMessage
  })

  return messages
}

/**
 * Generate chat response with proper error handling and retries
 */
export async function generateChatResponse(
  context: ChatContext
): Promise<ChatResponse> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const messages = createChatPrompt(context)
  const sourceFiles = Array.from(new Set(context.chunks.map(c => c.fileName)))

  console.log(`🤖 Generating response using GPT-4o-mini`)
  console.log(`📚 Context: ${context.chunks.length} chunks from ${sourceFiles.length} files`)
  console.log(`💬 History: ${context.conversationHistory.length} previous messages`)

  const maxRetries = 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          temperature: 0.3, // Lower temperature for more focused responses
          max_tokens: 1500,
          top_p: 0.9,
          frequency_penalty: 0.1,
          presence_penalty: 0.1,
          user: `user_${Date.now()}` // For OpenAI usage tracking
        }),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      })

      if (!response.ok) {
        const errorText = await response.text()
        
        // Handle specific OpenAI errors
        if (response.status === 429) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt), 8000) // Exponential backoff
          console.warn(`Rate limited, waiting ${waitTime}ms before retry ${attempt}/${maxRetries}`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
          continue
        }
        
        if (response.status === 400) {
          throw new Error(`Invalid request: ${errorText}`)
        }
        
        if (response.status >= 500) {
          throw new Error(`OpenAI server error (${response.status}): ${errorText}`)
        }
        
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`)
      }

      const data = await response.json() as any
      
      if (!data.choices?.[0]?.message?.content) {
        throw new Error('Invalid response format from OpenAI')
      }

      const choice = data.choices[0]
      const usage = data.usage || {}

      const result: ChatResponse = {
        content: choice.message.content.trim(),
        tokenUsage: {
          prompt: usage.prompt_tokens || 0,
          completion: usage.completion_tokens || 0,
          total: usage.total_tokens || 0
        },
        sourceFiles,
        finishReason: choice.finish_reason || 'stop'
      }

      console.log(`✅ Generated response: ${result.tokenUsage.total} tokens, reason: ${result.finishReason}`)
      
      // Check for content issues
      if (result.finishReason === 'content_filter') {
        throw new Error('Response was filtered for content policy violations')
      }
      
      if (result.finishReason === 'length') {
        console.warn('Response was truncated due to length limits')
      }

      return result

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      console.error(`Attempt ${attempt}/${maxRetries} failed:`, lastError.message)
      
      // Don't retry on certain errors
      if (lastError.message.includes('Invalid request') || 
          lastError.message.includes('content policy')) {
        break
      }
      
      // Wait before retry (except on last attempt)
      if (attempt < maxRetries) {
        const waitTime = 1000 * attempt // Linear backoff for other errors
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
  }

  throw lastError || new Error('Failed to generate response after all retries')
}

/**
 * Generate conversation title with fallback
 */
export async function generateConversationTitle(
  messages: string[],
  maxRetries: number = 2
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return 'New Conversation' // Fallback if API key missing
  }

  const conversationSample = messages.slice(0, 2).join('\n\n')
  
  if (!conversationSample.trim()) {
    return 'New Conversation'
  }

  const prompt = `Generate a concise, descriptive title (2-6 words) for this conversation:

${conversationSample}

Requirements:
- 2-6 words maximum
- Descriptive of the main topic
- No quotes or special characters
- Professional tone

Title:`

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
              content: 'You generate concise, professional titles for conversations. Always respond with just the title, nothing else.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 20
        }),
        signal: AbortSignal.timeout(10000) // 10 second timeout for titles
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      const data = await response.json() as any
      const title = data.choices?.[0]?.message?.content?.trim()

      if (!title) {
        throw new Error('No title generated')
      }

      // Clean and validate title
      const cleanTitle = title
        .replace(/^["']|["']$/g, '') // Remove quotes
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .trim()
        .substring(0, 50) // Limit length

      return cleanTitle || 'New Conversation'

    } catch (error) {
      console.warn(`Title generation attempt ${attempt}/${maxRetries} failed:`, error)
      
      if (attempt === maxRetries) {
        return 'New Conversation'
      }
    }
  }

  return 'New Conversation'
}