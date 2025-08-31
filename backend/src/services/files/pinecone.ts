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

      return
    }

    if (this.initPromise) {

      return this.initPromise
    }

    this.initPromise = this._initialize()
    return this.initPromise
  }

  private async _initialize(): Promise<void> {
    try {

      
      // Check if index exists and has correct dimensions
      const indexList = await this.client.listIndexes()
      const existingIndex = indexList.indexes?.find(index => index.name === INDEX_NAME)

      if (existingIndex) {
        // Check if dimensions match
        if (existingIndex.dimension !== EMBEDDING_DIMENSION) {

          await this.client.deleteIndex(INDEX_NAME)

          await new Promise(resolve => setTimeout(resolve, 10000)) // Wait 10s for deletion
        } else {

        }
      }

      // Create index if it doesn't exist or was deleted due to wrong dimensions
      if (!existingIndex || existingIndex.dimension !== EMBEDDING_DIMENSION) {

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

          await this.waitForIndexReady()
        } catch (error: any) {
          // Handle case where index already exists (race condition)
          if (error.message?.includes('ALREADY_EXISTS')) {

          } else {
            throw error
          }
        }
      }

      this.index = this.client.index(INDEX_NAME)
      this.initialized = true
      this.initPromise = null
      console.log('✅ Pinecone initialized')
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


      
      // Add timeout to prevent hanging
      const upsertPromise = this.index.namespace(namespace).upsert(chunks)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Pinecone upsert timeout after 30s')), 30000)
      )
      
      const result = await Promise.race([upsertPromise, timeoutPromise])

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

// Export types and service
export { PineconeService, ChunkVector, SearchResult, SearchOptions }
