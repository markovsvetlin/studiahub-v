/**
 * Simple file processing handler
 */

import { extractTextFromFile } from '../../services/files/textExtraction';
import { simpleSemanticChunk } from '../../services/files/chunking';
import { embedOpenAI } from '../../services/files/embeddings';
import { pineconeService } from '../../services/files/pinecone';
import { findFileByKey, updateFileProgress, updateFileById, updateFileError } from '../../utils/files/database';
import { validateUsage, incrementWordsStored } from '../../utils/usage/database';
import { countWordsInPages } from '../../utils/usage/wordCount';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { db } from '../../db';
import { FILES_TABLE, S3_BUCKET, AWS_REGION } from '../../utils/constants';

const s3 = new S3Client({ region: AWS_REGION });

/**
 * Main file processing function
 */
export async function processObject(bucket: string, key: string, userId?: string): Promise<void> {
  try {
    // Update status to processing
    await updateFileProgress(key, 10, 'processing');
    
    // Extract text from file
    const pages = await extractTextFromFile(bucket, key, userId);
    await updateFileProgress(key, 40);
    
    // Check minimum content length (200 characters)
    const totalCharacters = pages.reduce((sum, page) => sum + page.text.length, 0);
    console.log(`📊 File contains ${totalCharacters} characters`);
    
    if (totalCharacters < 200) {
      console.log(`❌ File content too small: ${totalCharacters} characters (minimum 200 required)`);
      
      // Set error status first before cleanup
      const errorMessage = `FILE_TOO_SMALL: File content is too small (${totalCharacters} characters). Please upload a file with at least 200 characters of meaningful content.`;
      await updateFileError(key, errorMessage);
      
      // Get file record before cleanup  
      const file = await findFileByKey(key);
      if (file) {
        // Small delay to allow frontend polling to catch the error status
        await new Promise(resolve => setTimeout(resolve, 2000));
        await cleanupSmallContentFile(bucket, key, file.id, file.userId);
      }
      
      throw new Error(errorMessage);
    }
    
    // Count words and validate usage
    const wordCount = countWordsInPages(pages);
    console.log(`📊 File contains ${wordCount} words`);
    
    // Get file record to get userId if not provided
    const file = await findFileByKey(key);
    const fileUserId = userId || file?.userId;
    
    if (!fileUserId) {
      throw new Error('User ID not found for usage validation');
    }
    
    // Validate word usage before processing
    const usageValidation = await validateUsage(fileUserId, 'words', wordCount);
    if (!usageValidation.canProceed) {
      throw new Error(`Usage limit exceeded: ${usageValidation.message}`);
    }
    
    // Create chunks with guaranteed complete coverage
    const chunks = simpleSemanticChunk(pages);
    const totalOriginalChars = pages.reduce((sum, p) => sum + p.text.length, 0);
    const totalChunkChars = chunks.reduce((sum, c) => sum + c.text.length, 0);
    const coverage = totalChunkChars / totalOriginalChars * 100;
    
    console.log(`📄 Text chunking analysis:`);
    console.log(`  - Original document: ${totalOriginalChars} characters`);
    console.log(`  - Generated chunks: ${chunks.length} chunks with ${totalChunkChars} characters`);
    console.log(`  - Coverage: ${coverage.toFixed(1)}% (should be ~99-100%)`);
    console.log(`  - Chunk sizes: min=${Math.min(...chunks.map(c => c.text.length))}, max=${Math.max(...chunks.map(c => c.text.length))}, avg=${Math.round(totalChunkChars/chunks.length)}`);
    
    if (coverage < 99) {
      console.warn(`⚠️  Low coverage detected: ${coverage.toFixed(1)}% - some text may be missing!`);
    } else {
      console.log(`✅ Excellent coverage: ${coverage.toFixed(1)}% - virtually complete text extraction`);
    }
    
    await updateFileProgress(key, 60);
    
    
    if (file) {
      await updateFileById(file.id, { totalChunks: chunks.length, wordCount });
    }
    
    // Process embeddings with user namespace
    const userNamespace = userId || file?.userId || 'default';
    await processEmbeddings(file, chunks, userNamespace);
    
    // Mark as complete
    await updateFileProgress(key, 100, 'ready');
    
    // Increment word storage after successful processing
    await incrementWordsStored(fileUserId, wordCount);
    console.log(`✅ Updated user ${fileUserId} word storage: +${wordCount} words`);
  } catch (error) {
    console.error('Processing failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
    await updateFileError(key, errorMessage);
    throw error;
  }
}

/**
 * Process embeddings for chunks with dynamic parallel processing
 */
async function  processEmbeddings(file: any, chunks: any[], namespace: string = 'default'): Promise<void> {
  if (!chunks.length) return;
  
  // Initialize Pinecone
  await pineconeService.initialize();
  
  // Linear dynamic scaling formula
  const totalChunks = chunks.length;
  
  // Base configuration  
  const baseBatchSize = 3;
  const baseConcurrency = 4; // Faster processing for small documents
  
  // Scaling formula: every 20 chunks adds 1 to batchSize and concurrency
  const scalingInterval = 20;
  const extraWorkers = Math.floor(totalChunks / scalingInterval);
  
  // Calculate final values with reasonable limits
  const batchSize = Math.min(baseBatchSize + extraWorkers, 8); // Max 8 chunks per batch
  const concurrency = Math.min(baseConcurrency + extraWorkers, 20); // Max 20 concurrent batches
  
  const totalParallelChunks = batchSize * concurrency;
  
  console.log(`📊 Linear scaling: ${totalChunks} chunks → +${extraWorkers} workers → batchSize=${batchSize}, concurrency=${concurrency} (${totalParallelChunks} chunks simultaneously)`)
  
  const batches: any[][] = [];
  for (let i = 0; i < chunks.length; i += batchSize) {
    batches.push(chunks.slice(i, i + batchSize));
  }
  
  let completedChunks = 0;
  
  // Process batches with limited concurrency
  for (let i = 0; i < batches.length; i += concurrency) {
    const currentBatches = batches.slice(i, i + concurrency);
    
    // Process current set of batches in parallel
    const promises = currentBatches.map(async (batch, batchIndex) => {
      const texts = batch.map(chunk => chunk.text);
      
      // Generate embeddings
      const embeddings = await embedOpenAI(texts);
      
      // Save to Pinecone
      const startIndex = (i + batchIndex) * batchSize;
      const vectors = batch.map((chunk, idx) => ({
        id: `chunk_${file.id}_${startIndex + idx}`,
        values: embeddings[idx],
        metadata: {
          fileId: file.id,
          chunkIndex: startIndex + idx,
          text: chunk.text.substring(0, 40000)
        }
      }));
      
      await pineconeService.upsertChunks(vectors, namespace);
      return batch.length;
    });
    
    // Wait for all parallel batches to complete
    const results = await Promise.all(promises);
    completedChunks += results.reduce((sum, count) => sum + count, 0);
    
    // Update progress
    const progress = 60 + (40 * completedChunks / chunks.length);
    await updateFileProgress(file.key, Math.round(progress));
  }
}

/**
 * Cleanup function for files with insufficient content
 * Removes file from S3, DynamoDB, and Pinecone
 */
async function cleanupSmallContentFile(bucket: string, s3Key: string, fileId: string, userId?: string): Promise<void> {
  try {
    console.log(`🧹 Cleaning up small content file: ${fileId}`);
    
    // 1. Delete from S3
    try {
      await s3.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: s3Key
      }));
      console.log(`✅ Deleted from S3: ${s3Key}`);
    } catch (s3Error) {
      console.warn(`⚠️ Failed to delete from S3: ${s3Error}`);
    }
    
    // 2. Delete from Pinecone (if any chunks were created)
    try {
      await pineconeService.initialize();
      await pineconeService.deleteFileChunks(fileId, userId);
      console.log(`✅ Deleted chunks from Pinecone for file: ${fileId}`);
    } catch (pineconeError) {
      console.warn(`⚠️ Failed to delete from Pinecone: ${pineconeError}`);
    }
    
    // 3. Delete from DynamoDB
    try {
      await db.send(new DeleteCommand({
        TableName: FILES_TABLE,
        Key: { id: fileId }
      }));
      console.log(`✅ Deleted from DynamoDB: ${fileId}`);
    } catch (dbError) {
      console.warn(`⚠️ Failed to delete from DynamoDB: ${dbError}`);
    }
    
    console.log(`🎉 Successfully cleaned up file ${fileId} due to insufficient content`);
  } catch (error) {
    console.error(`❌ Error during cleanup of file ${fileId}:`, error);
    // Don't throw error here - we still want the main error to be thrown
  }
}