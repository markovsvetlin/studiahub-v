/**
 * Chat Search Service - handles semantic search for chat
 */

import { EmbeddingService } from './EmbeddingService';
import { pineconeService } from './pinecone';
import { getEnabledFileIds } from '../../utils/files/database';

export interface RelevantChunk {
  id: string;
  text: string;
  score: number;
  metadata?: {
    fileId: string;
    fileName: string;
    chunkIndex: number;
  };
}

export class ChatSearchService {
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }
  /**
   * Find relevant chunks for chat using vector search
   */
  async findRelevantChunks(
    query: string,
    userId: string,
    topK: number = 5
  ): Promise<RelevantChunk[]> {
    try {
      // Initialize Pinecone
      await pineconeService.initialize();

      // Get user's enabled files
      const enabledFileIds = await getEnabledFileIds(userId);
      if (enabledFileIds.length === 0) {
        return [];
      }



      // Generate embedding for the query
      const [queryEmbedding] = await this.embeddingService.generateEmbeddings([query]);

      // Search for similar chunks
      const searchResults = await pineconeService.searchChunks(queryEmbedding, {
        topK,
        filter: { fileId: { $in: enabledFileIds } }
      }, userId);

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
      }));



      return relevantChunks;

    } catch (error) {
      console.error('❌ Failed to find relevant chunks:', error);
      throw error instanceof Error ? error : new Error('Failed to search for relevant chunks');
    }
  }
}

// Singleton instance
export const chatSearchService = new ChatSearchService();

// Backward compatibility function
export async function findRelevantChunks(
  query: string,
  userId: string,
  topK: number = 5
): Promise<RelevantChunk[]> {
  return await chatSearchService.findRelevantChunks(query, userId, topK);
}
