import { db } from '../../db'
import { PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'

const USAGE_TABLE = process.env.USAGE_TABLE!

export interface UsageRecord {
  userId: string
  wordsUsed: number // Now represents words stored (current storage, not cumulative processing)
  questionsGenerated: number
  tokensUsed: number
  resetDate: string // ISO date string - still needed for questions/tokens reset
  createdAt: number
  updatedAt: number
}

export interface UsageLimits {
  words: number
  questions: number
  tokens: number
}

/**
 * Get usage limits for free tier (for now, all users)
 */
export function getUsageLimits(): UsageLimits {
  return {
    words: parseInt(process.env.FREE_TIER_WORDS_LIMIT || '100000'),
    questions: parseInt(process.env.FREE_TIER_QUESTIONS_LIMIT || '50'),
    tokens: parseInt(process.env.FREE_TIER_TOKENS_LIMIT || '50000')
  }
}

/**
 * Calculate next reset date (same day next month)
 */
function calculateNextResetDate(registrationDate?: Date): string {
  const now = registrationDate || new Date()
  const nextMonth = new Date(now)
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  return nextMonth.toISOString().split('T')[0] // YYYY-MM-DD format
}

/**
 * Get or create usage record for user
 */
export async function getUserUsage(userId: string): Promise<UsageRecord> {
  try {
    const result = await db.send(new GetCommand({
      TableName: USAGE_TABLE,
      Key: { userId }
    }))

    if (result.Item) {
      const usage = result.Item as UsageRecord
      
      // Check if reset date has passed
      const resetDate = new Date(usage.resetDate + 'T00:00:00.000Z')
      const now = new Date()
      
      if (now >= resetDate) {
        // Reset usage and update reset date (but keep wordsStored as it's based on current files)
        const updatedUsage: UsageRecord = {
          ...usage,
          wordsUsed: usage.wordsUsed, // Keep current storage amount
          questionsGenerated: 0, // Reset questions
          tokensUsed: 0, // Reset tokens
          resetDate: calculateNextResetDate(now),
          updatedAt: Date.now()
        }
        
        await db.send(new PutCommand({
          TableName: USAGE_TABLE,
          Item: updatedUsage
        }))
        
        return updatedUsage
      }
      
      return usage
    }

    // Create new usage record
    const newUsage: UsageRecord = {
      userId,
      wordsUsed: 0,
      questionsGenerated: 0,
      tokensUsed: 0,
      resetDate: calculateNextResetDate(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    await db.send(new PutCommand({
      TableName: USAGE_TABLE,
      Item: newUsage
    }))

    return newUsage
  } catch (error) {
    console.error('Error getting user usage:', error)
    throw new Error('Failed to retrieve usage information')
  }
}

/**
 * Increment words stored (when file is uploaded)
 */
export async function incrementWordsStored(userId: string, wordCount: number): Promise<void> {
  try {
    console.log(`🔍 INCREMENT DEBUG: userId=${userId}, wordCount=${wordCount}`);
    
    const result = await db.send(new UpdateCommand({
      TableName: USAGE_TABLE,
      Key: { userId },
      UpdateExpression: 'SET wordsUsed = wordsUsed + :increment, updatedAt = :now',
      ExpressionAttributeValues: {
        ':increment': wordCount,
        ':now': Date.now()
      },
      ReturnValues: 'ALL_NEW'
    }))
    
    console.log(`✅ INCREMENT SUCCESS: New usage after increment:`, result.Attributes);
  } catch (error) {
    console.error('❌ Error incrementing words stored:', error)
    throw new Error('Failed to update word storage')
  }
}

/**
 * Decrement words stored (when file is deleted)
 */
export async function decrementWordsStored(userId: string, wordCount: number): Promise<void> {
  try {
    console.log(`🔍 DECREMENT DEBUG: userId=${userId}, wordCount=${wordCount}`);
    
    // First check current usage before decrementing
    const currentUsage = await getUserUsage(userId);
    console.log(`📊 Current usage before decrement: ${currentUsage.wordsUsed} words`);
    
    // Calculate new value but don't go below 0
    const newWordsUsed = Math.max(0, currentUsage.wordsUsed - wordCount);
    console.log(`📊 Will set wordsUsed to: ${newWordsUsed} (was ${currentUsage.wordsUsed}, subtracting ${wordCount})`);
    
    const result = await db.send(new UpdateCommand({
      TableName: USAGE_TABLE,
      Key: { userId },
      UpdateExpression: 'SET wordsUsed = :newValue, updatedAt = :now',
      ExpressionAttributeValues: {
        ':newValue': newWordsUsed,
        ':now': Date.now()
      },
      ReturnValues: 'ALL_NEW'
    }))
    
    console.log(`✅ DECREMENT SUCCESS: New usage after decrement:`, result.Attributes);
  } catch (error) {
    console.error('❌ Error decrementing words stored:', error)
    throw new Error('Failed to update word storage')
  }
}

/**
 * Increment questions generated
 */
export async function incrementQuestionsGenerated(userId: string, questionCount: number): Promise<void> {
  try {
    await db.send(new UpdateCommand({
      TableName: USAGE_TABLE,
      Key: { userId },
      UpdateExpression: 'SET questionsGenerated = questionsGenerated + :increment, updatedAt = :now',
      ExpressionAttributeValues: {
        ':increment': questionCount,
        ':now': Date.now()
      }
    }))
  } catch (error) {
    console.error('Error incrementing questions generated:', error)
    throw new Error('Failed to update question usage')
  }
}

/**
 * Increment tokens used
 */
export async function incrementTokensUsed(userId: string, tokenCount: number): Promise<void> {
  try {
    await db.send(new UpdateCommand({
      TableName: USAGE_TABLE,
      Key: { userId },
      UpdateExpression: 'SET tokensUsed = tokensUsed + :increment, updatedAt = :now',
      ExpressionAttributeValues: {
        ':increment': tokenCount,
        ':now': Date.now()
      }
    }))
  } catch (error) {
    console.error('Error incrementing tokens used:', error)
    throw new Error('Failed to update token usage')
  }
}

/**
 * Check if user can perform action (before processing)
 */
export async function validateUsage(
  userId: string, 
  type: 'words' | 'questions' | 'tokens', 
  requestedAmount: number
): Promise<{ canProceed: boolean; message?: string; usage?: UsageRecord }> {
  try {
    const usage = await getUserUsage(userId)
    const limits = getUsageLimits()
    
    let currentUsage: number
    let limit: number
    let usageType: string
    
    switch (type) {
      case 'words':
        currentUsage = usage.wordsUsed
        limit = limits.words
        usageType = 'words'
        break
      case 'questions':
        currentUsage = usage.questionsGenerated
        limit = limits.questions
        usageType = 'questions'
        break
      case 'tokens':
        currentUsage = usage.tokensUsed
        limit = limits.tokens
        usageType = 'tokens'
        break
    }
    
    if (currentUsage + requestedAmount > limit) {
      const remaining = Math.max(0, limit - currentUsage)
      return {
        canProceed: false,
        message: `Usage limit exceeded. You have ${remaining.toLocaleString()} ${usageType} remaining out of ${limit.toLocaleString()}. Resets on ${new Date(usage.resetDate).toLocaleDateString()}.`,
        usage
      }
    }
    
    return { canProceed: true, usage }
  } catch (error) {
    console.error('Error validating usage:', error)
    throw new Error('Failed to validate usage limits')
  }
}