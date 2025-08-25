import { z } from 'zod'

// Input validation schemas
export const SendMessageSchema = z.object({
  message: z.string()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message too long (max 4000 characters)')
    .refine(msg => msg.trim().length > 0, 'Message cannot be only whitespace'),
  conversationId: z.string().uuid().optional(),
  userId: z.string().min(1, 'User ID required')
})

export const GetMessagesSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
  userId: z.string().min(1, 'User ID required'),
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
  direction: z.enum(['forward', 'backward']).default('forward')
})

export const GetConversationsSchema = z.object({
  userId: z.string().min(1, 'User ID required'),
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().optional()
})

export const GenerateTitleSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
  userId: z.string().min(1, 'User ID required')
})

// Rate limiting configuration  
import type { RateLimitConfig } from './rateLimit'

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  SEND_MESSAGE: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 messages per minute
    keyGenerator: (userId: string) => `chat:send:${userId}`
  },
  GET_MESSAGES: {
    windowMs: 60 * 1000, // 1 minute  
    maxRequests: 100, // 100 requests per minute
    keyGenerator: (userId: string) => `chat:get:${userId}`
  }
} as const

// Content filtering
export function containsHarmfulContent(message: string): boolean {
  const harmfulPatterns = [
    /(?:hack|exploit|attack|malware|virus)/gi,
    /(?:kill|murder|suicide|bomb|terrorist)/gi,
    /(?:drug|cocaine|heroin|meth)/gi
    // Add more patterns as needed
  ]
  
  return harmfulPatterns.some(pattern => pattern.test(message))
}

// Input sanitization
export function sanitizeMessage(message: string): string {
  return message
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .substring(0, 4000) // Ensure max length
}

// User ID validation and normalization
export function validateUserId(userId: string): string {
  const normalized = userId.trim()
  if (!normalized) {
    throw new Error('User ID cannot be empty')
  }
  if (normalized.length > 100) {
    throw new Error('User ID too long')
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) {
    throw new Error('User ID contains invalid characters')
  }
  return normalized
}

// Error response standardization
export interface ApiError {
  code: string
  message: string
  details?: Record<string, any>
}

export function createApiError(
  code: string,
  message: string,
  details?: Record<string, any>
): ApiError {
  return { code, message, details }
}

export const API_ERRORS = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
  CONTENT_FILTERED: 'CONTENT_FILTERED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const