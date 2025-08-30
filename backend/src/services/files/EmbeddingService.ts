/**
 * Embedding Service - handles embeddings and vector operations
 */

import { pineconeService } from './pinecone';
import { updateFileProgress } from '../../utils/files/database';
import { PageContent } from './TextExtractionService';
import fetch from 'node-fetch';

export interface Chunk {
  text: string;
}

export class EmbeddingService {
  /**
   * Process file embeddings - create chunks and store in vector database
   */
  async processFileEmbeddings(file: any, pages: PageContent[], userId: string): Promise<void> {
    if (!pages.length) return;

    // Create chunks
    const chunks = this.createSemanticChunks(pages);
    if (!chunks.length) return;

    // Initialize Pinecone
    await pineconeService.initialize();

    // Calculate batch processing parameters
    const { batchSize, concurrency } = this.calculateBatchParams(chunks.length);
    console.log(`📊 Processing ${chunks.length} chunks with batchSize=${batchSize}, concurrency=${concurrency}`);

    // Create batches
    const batches = this.createBatches(chunks, batchSize);
    let completedChunks = 0;

    // Process batches with concurrency control
    for (let i = 0; i < batches.length; i += concurrency) {
      const currentBatches = batches.slice(i, i + concurrency);
      
      const promises = currentBatches.map(async (batch, batchIndex) => {
        return await this.processBatch(batch, file, i + batchIndex, batchSize, userId);
      });
      
      const results = await Promise.all(promises);
      completedChunks += results.reduce((sum, count) => sum + count, 0);
      
      // Update progress
      const progress = 60 + (40 * completedChunks / chunks.length);
      await updateFileProgress(file.key, Math.round(progress));
    }

    console.log(`✅ Processed ${chunks.length} chunks for file ${file.id}`);
  }

  /**
   * Delete file embeddings from vector database
   */
  async deleteFileEmbeddings(fileId: string, userId?: string): Promise<void> {
    try {
      await pineconeService.initialize();
      await pineconeService.deleteFileChunks(fileId, userId);
      console.log(`✅ Deleted embeddings for file: ${fileId}`);
    } catch (error) {
      console.warn(`⚠️  Failed to delete embeddings: ${error}`);
      throw error;
    }
  }

  private async processBatch(
    batch: any[], 
    file: any, 
    batchIndex: number, 
    batchSize: number, 
    userId: string
  ): Promise<number> {
    const texts = batch.map(chunk => chunk.text);
    
    // Generate embeddings
    const embeddings = await this.generateEmbeddings(texts);
    
    // Create vectors for Pinecone
    const startIndex = batchIndex * batchSize;
    const vectors = batch.map((chunk, idx) => ({
      id: `chunk_${file.id}_${startIndex + idx}`,
      values: embeddings[idx],
      metadata: {
        fileId: file.id,
        chunkIndex: startIndex + idx,
        text: chunk.text.substring(0, 40000) // Limit metadata size
      }
    }));
    
    // Store in Pinecone
    await pineconeService.upsertChunks(vectors, userId);
    
    return batch.length;
  }

  private calculateBatchParams(totalChunks: number): { batchSize: number; concurrency: number } {
    const baseBatchSize = 3;
    const baseConcurrency = 4;
    
    // Scale up for larger documents
    const scalingInterval = 20;
    const extraWorkers = Math.floor(totalChunks / scalingInterval);
    
    return {
      batchSize: Math.min(baseBatchSize + extraWorkers, 8),
      concurrency: Math.min(baseConcurrency + extraWorkers, 20)
    };
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Create semantic chunks from pages with guaranteed complete coverage
   */
  private createSemanticChunks(pages: PageContent[]): Chunk[] {
    if (!pages.length) return [];
    
    const chunks: Chunk[] = [];
    const targetChars = 1600; // ~400 tokens at 4 chars/token
    
    // Concatenate ALL text from all pages for complete coverage
    let allText = '';
    for (const page of pages) {
      const pageText = page.text.trim();
      if (pageText) {
        allText += (allText ? '\n' : '') + pageText;
      }
    }
    
    if (!allText) return [];
    
    // Split the complete text sequentially with no gaps
    let position = 0;
    
    while (position < allText.length) {
      let chunkEnd = Math.min(position + targetChars, allText.length);
      
      // Try to break at word boundaries for better semantic chunks
      if (chunkEnd < allText.length) {
        const lastSpace = allText.lastIndexOf(' ', chunkEnd);
        const lastNewline = allText.lastIndexOf('\n', chunkEnd);
        const bestBreak = Math.max(lastSpace, lastNewline);
        
        // Only break at word boundary if it doesn't make chunk too small
        if (bestBreak > position + targetChars * 0.7) {
          chunkEnd = bestBreak;
        }
      }
      
      const chunkText = allText.substring(position, chunkEnd).trim();
      if (!chunkText) break;
      
      chunks.push({ text: chunkText });
      
      position = chunkEnd;
      // Skip whitespace to avoid gaps
      while (position < allText.length && /\s/.test(allText[position])) {
        position++;
      }
    }
    
    return chunks;
  }

  /**
   * Generate embeddings using OpenAI
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY required');
    if (!texts.length) throw new Error('No texts provided');
    
    // Debug: Log text lengths to identify large chunks
    console.log(`Embedding ${texts.length} texts with lengths:`, texts.map(t => t.length));
    
    // Safety: Truncate any text that's too long (6000 chars = ~1500 tokens, safe margin)
    const safTexts = texts.map(text => text.length > 6000 ? text.substring(0, 6000) + '...' : text);

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: safTexts,
        model: 'text-embedding-3-large'
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json() as { data: { embedding: number[] }[] };
    return data.data.map(item => item.embedding);
  }
}
