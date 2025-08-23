import { pineconeService } from '../files/pinecone'
import { embedOpenAI } from '../files/embeddings'
import { db } from '../../db'
import { ScanCommand } from '@aws-sdk/lib-dynamodb'
import { FILES_TABLE } from '../../utils/constants'

export interface Chunk {
  id: string
  content: string
  fileId: string
  chunkIndex: number
  score?: number
}

export interface FileRecord {
  id: string
  key: string
  status: 'uploading' | 'queued' | 'processing' | 'ready' | 'error'
  progress: number
  totalChunks: number
  isEnabled: boolean
  createdAt: string
  updatedAt?: string
}

export class ChunksRetriever {
  /**
   * Get chunks for specific mode using semantic search
   */
  async getSpecificChunks(query: string, limit: number = 15, userId?: string): Promise<Chunk[]> {

    
    try {
      // Initialize Pinecone if needed
      await pineconeService.initialize()
      
      // Get enabled file IDs to filter results
      const enabledFileIds = await this.getEnabledFileIds()
      if (enabledFileIds.length === 0) {
        return []
      }
      
      // Generate embedding for the query
      const queryEmbedding = await this.generateQueryEmbedding(query)
      
      // Search Pinecone
      const searchResults = await this.searchPinecone(
        queryEmbedding, 
        limit * 2, // Get more results to filter and shuffle
        userId, 
        enabledFileIds
      )
      
      // Filter to only enabled files and convert to chunks
      const filteredChunks = this.convertSearchResultsToChunks(searchResults, enabledFileIds)
      
      // Shuffle and limit results
      const shuffledChunks = this.shuffleChunks(filteredChunks).slice(0, limit)
      

      return shuffledChunks
      
    } catch (error) {
      console.error('❌ Failed to get specific chunks:', error)
      throw new Error(`Failed to retrieve specific chunks: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get chunks for general mode using random sampling
   */
  async getGeneralChunks(limit: number = 20, userId?: string): Promise<Chunk[]> {

    
    try {
      // Initialize Pinecone if needed
      await pineconeService.initialize()
      
      // Get enabled file IDs
      const enabledFileIds = await this.getEnabledFileIds()
      if (enabledFileIds.length === 0) {
        console.log('⚠️ No enabled files found')
        return []
      }
      
      console.log(`📁 Found ${enabledFileIds.length} enabled files`)
      
      // Get chunks by randomly sampling from enabled files
      const chunks = await this.getRandomChunksFromFiles(enabledFileIds, limit, userId)
      
      // Shuffle the results
      const shuffledChunks = this.shuffleChunks(chunks)
      
      console.log(`✅ Retrieved ${shuffledChunks.length} general chunks for quiz generation`)
      return shuffledChunks
      
    } catch (error) {
      console.error('❌ Failed to get general chunks:', error)
      throw new Error(`Failed to retrieve general chunks: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get all enabled file IDs from the database
   */
  private async getEnabledFileIds(): Promise<string[]> {
    try {
      console.log('📊 Querying enabled files from database...')
      
      const result = await db.send(new ScanCommand({
        TableName: FILES_TABLE,
        FilterExpression: '#status = :readyStatus AND (#isEnabled = :enabled OR attribute_not_exists(#isEnabled))',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#isEnabled': 'isEnabled'
        },
        ExpressionAttributeValues: {
          ':readyStatus': 'ready',
          ':enabled': true
        },
        ProjectionExpression: 'id'
      }))

      const fileIds = result.Items?.map(item => item.id as string) || []
      console.log(`📁 Found ${fileIds.length} enabled and ready files`)
      
      return fileIds
    } catch (error) {
      console.error('❌ Failed to get enabled file IDs:', error)
      throw new Error('Failed to query enabled files from database')
    }
  }

  /**
   * Generate embedding for search query
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    try {

      const embeddings = await embedOpenAI([query])
      return embeddings[0]
    } catch (error) {
      console.error('❌ Failed to generate query embedding:', error)
      throw new Error('Failed to generate query embedding')
    }
  }

  /**
   * Search Pinecone with query embedding
   */
  private async searchPinecone(
    queryEmbedding: number[], 
    topK: number, 
    userId?: string,
    enabledFileIds?: string[]
  ): Promise<any[]> {
    try {

      
      // Get the Pinecone index
      const index = (pineconeService as any).index
      if (!index) {
        throw new Error('Pinecone index not available')
      }
      
      const namespace = userId ? `user_${userId}` : 'default'
      
      // Build filter for enabled files if provided
      const filter = enabledFileIds && enabledFileIds.length > 0 ? {
        fileId: { $in: enabledFileIds }
      } : undefined
      
      const searchResponse = await index.namespace(namespace).query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
        ...(filter && { filter })
      })
      
      console.log(`🎯 Found ${searchResponse.matches?.length || 0} matching chunks`)
      return searchResponse.matches || []
      
    } catch (error) {
      console.error('❌ Pinecone search failed:', error)
      throw new Error('Failed to search Pinecone')
    }
  }

  /**
   * Get random chunks from enabled files
   */
  private async getRandomChunksFromFiles(
    enabledFileIds: string[], 
    limit: number, 
    userId?: string
  ): Promise<Chunk[]> {
    try {

      const chunks: Chunk[] = []
      const chunksPerFile = Math.max(1, Math.ceil(limit / enabledFileIds.length))
      
      // Shuffle file IDs to randomize selection
      const shuffledFileIds = [...enabledFileIds].sort(() => Math.random() - 0.5)
      
      for (const fileId of shuffledFileIds) {
        if (chunks.length >= limit) break
        
        // Get random chunks from this file
        const fileChunks = await this.getRandomChunksFromFile(fileId, chunksPerFile, userId)
        chunks.push(...fileChunks)
      }
      
      return chunks.slice(0, limit)
      
    } catch (error) {
      console.error('❌ Failed to get random chunks from files:', error)
      throw new Error('Failed to get random chunks from files')
    }
  }

  /**
   * Get random chunks from a specific file using Pinecone query
   */
  private async getRandomChunksFromFile(
    fileId: string, 
    count: number, 
    userId?: string
  ): Promise<Chunk[]> {
    try {
      // Get the Pinecone index
      const index = (pineconeService as any).index
      if (!index) {
        throw new Error('Pinecone index not available')
      }

  
      
      const namespace = userId ? `user_${userId}` : 'default'
      
      // Use a random vector to get chunks from this file
      // Generate a random vector with the same dimensions as embeddings (3072)
      const randomVector = Array.from({ length: 3072 }, () => Math.random() * 2 - 1)
      
      // Query with filter for this specific file to get random chunks
      const searchResponse = await index.namespace(namespace).query({
        vector: randomVector,
        topK: count * 3, // Get more results to increase chances of finding chunks
        includeMetadata: true,
        filter: {
          fileId: fileId
        }
      })

      // Convert search results to chunks
      const chunks: Chunk[] = []
      const matches = searchResponse.matches || []
      
      // Shuffle results and take the requested count
      const shuffledMatches = matches.sort(() => Math.random() - 0.5).slice(0, count)
      
      for (const match of shuffledMatches) {
        if (match.metadata) {
          chunks.push({
            id: match.id,
            content: match.metadata.text || '',
            fileId: match.metadata.fileId || fileId,
            chunkIndex: match.metadata.chunkIndex || 0,
            score: match.score
          })
        }
      }
      
      console.log(`📦 Retrieved ${chunks.length} random chunks from file ${fileId}`)
      return chunks
      
    } catch (error) {
      console.debug(`⚠️ Could not get chunks from file ${fileId}:`, error)
      return [] // Return empty array instead of failing - some files might not have chunks
    }
  }

  /**
   * Convert Pinecone search results to Chunk format
   */
  private convertSearchResultsToChunks(searchResults: any[], enabledFileIds: string[]): Chunk[] {
    const chunks: Chunk[] = []
    
    for (const match of searchResults) {
      if (match.metadata) {
        const fileId = match.metadata.fileId
        
        // Only include chunks from enabled files
        if (enabledFileIds.includes(fileId)) {
          chunks.push({
            id: match.id,
            content: match.metadata.text || '',
            fileId,
            chunkIndex: match.metadata.chunkIndex || 0,
            score: match.score || 0
          })
        }
      }
    }
    
    return chunks
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  private shuffleChunks<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }
}

export const chunksRetriever = new ChunksRetriever()
