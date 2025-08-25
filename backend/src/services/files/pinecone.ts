import { Pinecone } from '@pinecone-database/pinecone'

// Configuration
const PINECONE_API_KEY = process.env.PINECONE_API_KEY
const PINECONE_ENVIRONMENT = process.env.PINECONE_ENVIRONMENT || 'us-east-1-aws'
const INDEX_NAME = 'studiahub-chunks'
const EMBEDDING_DIMENSION = 3072 // OpenAI text-embedding-3-large

// Types
interface ChunkVector {
  id: string           // Chunk ID from PostgreSQL
  values: number[]     // Embedding vector
  metadata: {
    fileId: string
    chunkIndex: number
    text?: string      // Optional: store snippet for debugging
  }
}

interface SearchResult {
  id: string
  score: number
  metadata: {
    fileId: string
    chunkIndex: number
    text?: string
  }
}

interface SearchOptions {
  topK?: number
  includeMetadata?: boolean
  namespace?: string
  filter?: Record<string, any>
}

class PineconeService {
  private client: Pinecone
  private index: any
  private initialized: boolean = false
  private initPromise: Promise<void> | null = null

  constructor() {
    if (!PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY environment variable is required')
    }

    this.client = new Pinecone({
      apiKey: PINECONE_API_KEY
    })
  }

  async initialize(): Promise<void> {
    // Prevent concurrent initializations
    if (this.initialized) {
      console.log('✅ Pinecone already initialized')
      return
    }

    if (this.initPromise) {
      console.log('⏳ Waiting for existing initialization...')
      return this.initPromise
    }

    this.initPromise = this._initialize()
    return this.initPromise
  }

  private async _initialize(): Promise<void> {
    try {
      console.log('🔧 Initializing Pinecone connection...')
      
      // Check if index exists and has correct dimensions
      const indexList = await this.client.listIndexes()
      const existingIndex = indexList.indexes?.find(index => index.name === INDEX_NAME)

      if (existingIndex) {
        // Check if dimensions match
        if (existingIndex.dimension !== EMBEDDING_DIMENSION) {
          console.log(`🔄 Index ${INDEX_NAME} has wrong dimensions (${existingIndex.dimension}), recreating with ${EMBEDDING_DIMENSION}...`)
          await this.client.deleteIndex(INDEX_NAME)
          console.log('⏳ Waiting for index deletion...')
          await new Promise(resolve => setTimeout(resolve, 10000)) // Wait 10s for deletion
        } else {
          console.log(`✅ Index ${INDEX_NAME} already exists with correct dimensions (${EMBEDDING_DIMENSION}D)`)
        }
      }

      // Create index if it doesn't exist or was deleted due to wrong dimensions
      if (!existingIndex || existingIndex.dimension !== EMBEDDING_DIMENSION) {
        console.log(`📦 Creating Pinecone index with ${EMBEDDING_DIMENSION} dimensions...`)
        try {
          await this.client.createIndex({
            name: INDEX_NAME,
            dimension: EMBEDDING_DIMENSION,
            metric: 'cosine',
            spec: {
              serverless: {
                cloud: 'aws',
                region: 'us-east-1'
              }
            }
          })
          
          // Wait for index to be ready
          console.log('⏳ Waiting for index to be ready...')
          await this.waitForIndexReady()
        } catch (error: any) {
          // Handle case where index already exists (race condition)
          if (error.message?.includes('ALREADY_EXISTS')) {
            console.log('📦 Index already exists, continuing...')
          } else {
            throw error
          }
        }
      }

      this.index = this.client.index(INDEX_NAME)
      this.initialized = true
      this.initPromise = null
      console.log('✅ Pinecone initialized successfully')
    } catch (error) {
      console.error('❌ Pinecone initialization failed:', error)
      this.initPromise = null // Reset promise on failure
      throw error
    }
  }

  private async waitForIndexReady(): Promise<void> {
    const maxAttempts = 30
    let attempts = 0

    while (attempts < maxAttempts) {
      try {
        const indexInfo = await this.client.describeIndex(INDEX_NAME)
        if (indexInfo.status?.ready) {
          return
        }
      } catch (error) {
        console.log(`⏳ Index not ready yet, attempt ${attempts + 1}/${maxAttempts}`)
      }
      
      await new Promise(resolve => setTimeout(resolve, 10000)) // Wait 10 seconds
      attempts++
    }

    throw new Error('Index failed to become ready within timeout')
  }

  /**
   * Store chunk embeddings in Pinecone
   * Uses user namespace for multi-tenancy
   */
  async upsertChunks(chunks: ChunkVector[], userId?: string): Promise<void> {
    if (!this.index) {
      throw new Error('Pinecone not initialized. Call initialize() first.')
    }

    try {
      const namespace = this.getUserNamespace(userId)
      console.log(`💾 Upserting ${chunks.length} chunks to Pinecone (namespace: ${namespace})`)
      console.log(`🔍 Chunk format: ${chunks.length} chunks, each with ${chunks[0]?.values?.length || 0} dimensions`)

      // Validate chunk format before upsert
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        if (!chunk.id || !chunk.values || !Array.isArray(chunk.values)) {
          throw new Error(`Invalid chunk format at index ${i}: ${JSON.stringify(chunk)}`)
        }
        if (chunk.values.length !== EMBEDDING_DIMENSION) {
          throw new Error(`Wrong embedding dimension at index ${i}: expected ${EMBEDDING_DIMENSION}, got ${chunk.values.length}`)
        }
      }

      console.log('✅ Chunk validation passed, upserting to Pinecone...')
      
      // Add timeout to prevent hanging
      const upsertPromise = this.index.namespace(namespace).upsert(chunks)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Pinecone upsert timeout after 30s')), 30000)
      )
      
      const result = await Promise.race([upsertPromise, timeoutPromise])
      console.log(`🚀 Pinecone upsert completed`)
      console.log(`✅ Successfully upserted ${chunks.length} chunks to namespace: ${namespace}`)
    } catch (error) {
      console.error('❌ Failed to upsert chunks:', error)
      throw error
    }
  }


  /**
   * Search for similar chunks using vector similarity
   */
  async searchChunks(queryVector: number[], options: SearchOptions = {}, userId?: string): Promise<SearchResult[]> {
    if (!this.index) {
      throw new Error('Pinecone not initialized. Call initialize() first.')
    }

    try {
      const namespace = this.getUserNamespace(userId)
      const {
        topK = 10,
        includeMetadata = true,
        filter
      } = options

      console.log(`🔍 Searching ${topK} chunks in namespace: ${namespace}`)
      if (filter) {
        console.log(`🔧 Using filter: ${JSON.stringify(filter)}`)
      }

      const queryRequest = {
        vector: queryVector,
        topK,
        includeMetadata,
        ...(filter && { filter })
      }

      const searchResults = await this.index.namespace(namespace).query(queryRequest)
      
      const results: SearchResult[] = (searchResults.matches || []).map((match: any) => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata || {}
      }))

      console.log(`✅ Found ${results.length} matching chunks`)
      return results
    } catch (error) {
      console.error('❌ Failed to search chunks:', error)
      throw error
    }
  }

  /**
   * Get random chunks from enabled files
   */
  async getRandomChunks(enabledFileIds: string[], count: number, userId?: string): Promise<SearchResult[]> {
    if (!this.index) {
      throw new Error('Pinecone not initialized. Call initialize() first.')
    }

    if (enabledFileIds.length === 0) {
      return []
    }

    try {
      const namespace = this.getUserNamespace(userId)
      console.log(`🎲 Getting ${count} random chunks from ${enabledFileIds.length} enabled files`)

      // Create a random query vector to get diverse results
      const randomVector = Array(EMBEDDING_DIMENSION).fill(0).map(() => (Math.random() - 0.5) * 0.1)

      const filter = {
        fileId: { $in: enabledFileIds }
      }

      // Get more chunks than needed to allow for randomization
      const searchCount = Math.min(count * 3, 100)
      
      const searchResults = await this.searchChunks(randomVector, {
        topK: searchCount,
        filter
      }, userId)

      // Randomly sample the requested number of chunks
      const shuffled = searchResults.sort(() => Math.random() - 0.5)
      const selected = shuffled.slice(0, count)

      console.log(`✅ Selected ${selected.length} random chunks from ${searchResults.length} candidates`)
      return selected
    } catch (error) {
      console.error('❌ Failed to get random chunks:', error)
      throw error
    }
  }

  /**
   * Delete all chunks for a file
   */
  async deleteFileChunks(fileId: string, userId?: string): Promise<void> {
    if (!this.index) {
      throw new Error('Pinecone not initialized')
    }

    try {
      const namespace = this.getUserNamespace(userId)
      console.log(`🗑️ Deleting all chunks for file ${fileId} from namespace: ${namespace}`)

      // Delete by ID pattern since we know the chunk IDs follow: chunk_{fileId}_{index}
      // This is more reliable than filter-based deletion
      const idsToDelete = []
      
      // Try to delete up to 1000 chunks (should be more than enough for most files)
      for (let i = 0; i < 1000; i++) {
        idsToDelete.push(`chunk_${fileId}_${i}`)
      }

      // Delete in batches to avoid hitting API limits
      const batchSize = 100
      for (let i = 0; i < idsToDelete.length; i += batchSize) {
        const batch = idsToDelete.slice(i, i + batchSize)
        try {
          await this.index.namespace(namespace).deleteMany(batch)
        } catch (batchError) {
          // Ignore errors for non-existent IDs
          console.debug(`Batch deletion completed for IDs ${i}-${i + batchSize}`)
        }
      }

      console.log(`✅ Successfully deleted chunks for file ${fileId}`)
    } catch (error) {
      console.error('❌ Failed to delete file chunks:', error)
      throw error
    }
  }



  /**
   * Generate namespace for user separation
   * Format: user_<userId> or 'default' for system chunks
   */
  private getUserNamespace(userId?: string): string {
    return userId ? `user_${userId}` : 'default'
  }
}

// Singleton instance
export const pineconeService = new PineconeService()

// Helper functions
export async function initializePinecone(): Promise<void> {
  await pineconeService.initialize()
}

export { PineconeService, ChunkVector, SearchResult, SearchOptions }

// Import embeddings service
import { embedOpenAI } from './embeddings'
import { getEnabledFileIds } from '../../utils/files/database'

interface RelevantChunk {
  id: string
  text: string
  score: number
  metadata?: {
    fileId: string
    fileName: string
    chunkIndex: number
  }
}

/**
 * Find relevant chunks for chat using vector search
 */
export async function findRelevantChunks(
  query: string,
  userId: string,
  topK: number = 5
): Promise<RelevantChunk[]> {
  try {
    // Initialize Pinecone
    await pineconeService.initialize()

    // Get user's enabled files
    const enabledFileIds = await getEnabledFileIds(userId)
    if (enabledFileIds.length === 0) {
      return []
    }

    console.log(`🔍 Searching for relevant chunks for query: "${query.substring(0, 50)}..."`)
    console.log(`📚 Searching across ${enabledFileIds.length} enabled files`)

    // Generate embedding for the query
    const [queryEmbedding] = await embedOpenAI([query])

    // Search for similar chunks
    const searchResults = await pineconeService.searchChunks(queryEmbedding, {
      topK,
      filter: { fileId: { $in: enabledFileIds } }
    }, userId)

    // Transform results to include text content
    const relevantChunks: RelevantChunk[] = searchResults.map(result => ({
      id: result.id,
      text: result.metadata.text || 'Text not available',
      score: result.score,
      metadata: {
        fileId: result.metadata.fileId,
        fileName: (result.metadata as any).fileName || 'Unknown File',
        chunkIndex: result.metadata.chunkIndex || 0
      }
    }))

    console.log(`✅ Found ${relevantChunks.length} relevant chunks with scores: ${relevantChunks.map(c => c.score.toFixed(3)).join(', ')}`)

    return relevantChunks

  } catch (error) {
    console.error('❌ Failed to find relevant chunks:', error)
    throw error instanceof Error ? error : new Error('Failed to search for relevant chunks')
  }
}
