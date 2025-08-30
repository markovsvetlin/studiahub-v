import { pineconeService } from '../../services/files/pinecone'
import { EmbeddingService } from '../../services/files/EmbeddingService'
import { getEnabledFileIds } from '../../utils/files/database'

// Create embedding service instance
const embeddingService = new EmbeddingService()

// Constants
const SEARCH_MULTIPLIER = 4
const MAX_SEARCH_RESULTS = 100
const MIN_SCORE_DROP = 0.01

// Types
interface ChunkRetrievalOptions {
  focusArea?: string
  questionCount: number
  userId?: string
}

interface RetrievedChunk {
  id: string
  text: string
  fileId: string
  score?: number
}

interface SearchResult {
  id: string
  score: number
  metadata: {
    fileId: string
    text?: string
  }
}

// Utility Functions
function shuffleArray<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5)
}

function validateInputs(options: ChunkRetrievalOptions): void {
  const { questionCount } = options
  
  if (!questionCount || questionCount < 1 || questionCount > 50) {
    throw new Error('Question count must be between 1 and 50')
  }
}

function findAdaptiveThreshold(searchResults: SearchResult[]): SearchResult[] {
  if (searchResults.length <= 1) {
    return searchResults
  }

  // Sort by score (highest first)
  const sortedByScore = searchResults.sort((a, b) => b.score - a.score)
  
  // Find the biggest score drop
  let bestBreakpoint = sortedByScore.length
  let maxDrop = 0
  
  for (let i = 0; i < sortedByScore.length - 1; i++) {
    const drop = sortedByScore[i].score - sortedByScore[i + 1].score
    if (drop > maxDrop && drop > MIN_SCORE_DROP) {
      maxDrop = drop
      bestBreakpoint = i + 1
    }
  }
  
  const relevantChunks = sortedByScore.slice(0, Math.max(bestBreakpoint, 1))
  
  console.log(`📊 Adaptive threshold: ${relevantChunks.length}/${searchResults.length} chunks, max drop: ${maxDrop.toFixed(3)}`)
  
  return relevantChunks
}

function repeatChunksToTarget(chunks: SearchResult[], targetCount: number): SearchResult[] {
  if (chunks.length >= targetCount) {
    return shuffleArray(chunks).slice(0, targetCount)
  }

  console.log(`🔄 Repeating ${chunks.length} chunks to reach ${targetCount}`)
  
  const result: SearchResult[] = []
  
  // Efficiently fill the target count
  while (result.length < targetCount) {
    const shuffled = shuffleArray(chunks)
    const needed = targetCount - result.length
    result.push(...shuffled.slice(0, needed))
  }
  
  return result
}

async function searchFocusedChunks(
  focusArea: string, 
  questionCount: number, 
  enabledFileIds: string[], 
  userId?: string
): Promise<SearchResult[]> {
  console.log(`🎯 Searching for "${focusArea}" content`)
  
  // Generate embedding for focus area
  const [focusEmbedding] = await embeddingService.generateEmbeddings([focusArea])
  
  // Search with file filtering
  const searchCount = Math.min(questionCount * SEARCH_MULTIPLIER, MAX_SEARCH_RESULTS)
  const searchResults = await pineconeService.searchChunks(focusEmbedding, {
    topK: searchCount,
    filter: { fileId: { $in: enabledFileIds } }
  }, userId)

  if (searchResults.length === 0) {
    throw new Error(`No content found for "${focusArea}". Try a broader search term.`)
  }

  // Apply adaptive threshold to get only relevant chunks
  const relevantChunks = findAdaptiveThreshold(searchResults)
  
  // Repeat chunks to reach target count
  return repeatChunksToTarget(relevantChunks, questionCount)
}

async function searchGeneralChunks(
  questionCount: number,
  enabledFileIds: string[], 
  userId?: string
): Promise<SearchResult[]> {
  console.log(`🎲 Getting random content`)
  
  const chunks = await pineconeService.getRandomChunks(enabledFileIds, questionCount, userId)
  
  if (chunks.length === 0) {
    throw new Error('No content available. Please check your files are processed.')
  }
  
  return chunks
}

function transformToRetrievedChunks(chunks: SearchResult[]): RetrievedChunk[] {
  return chunks.map(chunk => ({
    id: chunk.id,
    text: chunk.metadata.text || 'Text not available',
    fileId: chunk.metadata.fileId,
    score: chunk.score
  }))
}

// Main Function
export async function retrieveChunksForQuiz(options: ChunkRetrievalOptions): Promise<RetrievedChunk[]> {
  const { focusArea, questionCount, userId } = options
  
  try {
    validateInputs(options)
    
    // Log namespace info
    console.log(`🔧 Using namespace: ${userId ? `user_${userId}` : 'default'}`)
    
    // Initialize services
    await pineconeService.initialize()
    
    // Get enabled files for the user
    const enabledFileIds = await getEnabledFileIds(userId || '')
    if (enabledFileIds.length === 0) {
      throw new Error('No enabled files found. Please enable at least one file in the context pool.')
    }
    
    console.log(`📚 Found ${enabledFileIds.length} enabled files`)
    
    // Search for chunks
    const chunks = focusArea 
      ? await searchFocusedChunks(focusArea, questionCount, enabledFileIds, userId)
      : await searchGeneralChunks(questionCount, enabledFileIds, userId)
    
    // Transform and return
    const retrievedChunks = transformToRetrievedChunks(chunks)
    
    console.log(`✅ Retrieved ${retrievedChunks.length} chunks for quiz generation`)
    
    return retrievedChunks
  } catch (error) {
    console.error('❌ Failed to retrieve chunks:', error)
    throw error instanceof Error ? error : new Error('Unknown error occurred')
  }
}