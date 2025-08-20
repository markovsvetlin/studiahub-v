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
   * Delete all chunks for a file
   */
  async deleteFileChunks(fileId: string, userId?: string): Promise<void> {
    if (!this.index) {
      throw new Error('Pinecone not initialized')
    }

    try {
      const namespace = this.getUserNamespace(userId)
      console.log(`🗑️ Deleting all chunks for file ${fileId}`)

      await this.index.namespace(namespace).deleteMany({ filter: { fileId } })
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
