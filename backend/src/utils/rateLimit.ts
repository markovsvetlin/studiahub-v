// In-memory rate limiter for serverless (could be replaced with Redis for multi-instance)
interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyGenerator: (userId: string) => string
}

export interface RateLimitResult {
  allowed: boolean
  remainingRequests: number
  resetTime: number
  retryAfterMs?: number
}

export function checkRateLimit(
  userId: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = config.keyGenerator(userId)
  const now = Date.now()
  const resetTime = now + config.windowMs
  
  let entry = rateLimitStore.get(key)
  
  // Clean up or initialize entry
  if (!entry || entry.resetTime < now) {
    entry = { count: 0, resetTime }
    rateLimitStore.set(key, entry)
  }
  
  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remainingRequests: 0,
      resetTime: entry.resetTime,
      retryAfterMs: entry.resetTime - now
    }
  }
  
  // Increment counter
  entry.count++
  
  return {
    allowed: true,
    remainingRequests: config.maxRequests - entry.count,
    resetTime: entry.resetTime
  }
}

export function resetRateLimit(userId: string, config: RateLimitConfig): void {
  const key = config.keyGenerator(userId)
  rateLimitStore.delete(key)
}