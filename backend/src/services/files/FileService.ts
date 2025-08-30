/**
 * Unified File Service - handles all file operations
 */

import { S3Service } from './S3Service';
import { TextExtractionService } from './TextExtractionService';
import { EmbeddingService } from './EmbeddingService';
import { 
  createFileRecord, 
  updateFileById, 
  updateFileProgress, 
  updateFileError,
  findFileByKey,
  getUserReadyFiles 
} from '../../utils/files/database';
import { validateUsage, incrementWordsStored, decrementWordsStored } from '../../utils/usage/database';
import { countWordsInPages } from '../../utils/usage/wordCount';
import { createErrorResponse, createSuccessResponse } from '../../utils/http';

export interface FileProcessingResult {
  success: boolean;
  fileId?: string;
  error?: string;
}

export interface UploadUrlResult {
  uploadUrl: string;
  fileId: string;
  key: string;
}

export interface FileInfo {
  id: string;
  key: string;
  fileName: string;
  createdAt: string;
  updatedAt: string;
  contentType: string;
  isEnabled: boolean;
}

export class FileService {
  private s3Service: S3Service;
  private textService: TextExtractionService;
  private embeddingService: EmbeddingService;

  constructor() {
    this.s3Service = new S3Service();
    this.textService = new TextExtractionService();
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Generate upload URL and create file record
   */
  async createUploadUrl(fileName: string, contentType: string, fileSize: number, userId: string): Promise<UploadUrlResult> {
    // Validate file type and size
    this.validateFileUpload(contentType, fileSize);
    
    // Check user quota
    await this.validateUserQuota(userId);
    
    // Generate S3 key and upload URL
    const fileKey = this.generateFileKey(fileName, userId);
    const uploadUrl = await this.s3Service.generateUploadUrl(fileKey, contentType, fileSize);
    
    // Create file record
    const fileRecord = await createFileRecord(fileKey, userId, 'uploading');
    
    return {
      uploadUrl,
      fileId: fileRecord.id,
      key: fileKey
    };
  }

  /**
   * Confirm upload and start processing
   */
  async confirmUpload(key: string, userId: string): Promise<{ fileId: string; status: string }> {
    const file = await findFileByKey(key);
    if (!file) {
      throw new Error('File not found');
    }
    
    await updateFileById(file.id, { status: 'queued' });
    
    // Start processing (this will be called by SQS)
    return {
      fileId: file.id,
      status: 'queued'
    };
  }

  /**
   * Process uploaded file
   */
  async processFile(bucket: string, key: string, userId?: string): Promise<FileProcessingResult> {
    try {
      const file = await findFileByKey(key);
      if (!file) {
        throw new Error('File record not found');
      }

      const fileUserId = userId || file.userId;
      await updateFileProgress(key, 10, 'processing');

      // Extract text
      const pages = await this.textService.extractText(bucket, key);
      await updateFileProgress(key, 40);

      // Validate content size
      const totalCharacters = pages.reduce((sum, page) => sum + page.text.length, 0);
      if (totalCharacters < 200) {
        const errorMessage = `File content too small (${totalCharacters} characters). Minimum 200 characters required.`;
        await updateFileError(key, errorMessage);
        await this.cleanupFile(bucket, key, file.id, fileUserId);
        throw new Error(errorMessage);
      }

      // Check usage limits
      const wordCount = countWordsInPages(pages);
      await this.validateWordUsage(fileUserId, wordCount);

      await updateFileProgress(key, 60);

      // Process embeddings
      await this.embeddingService.processFileEmbeddings(file, pages, fileUserId);

      // Complete processing
      await updateFileById(file.id, { 
        totalChunks: Math.ceil(pages.reduce((sum, p) => sum + p.text.length, 0) / 1600),
        wordCount 
      });
      await updateFileProgress(key, 100, 'ready');
      await incrementWordsStored(fileUserId, wordCount);

      return { success: true, fileId: file.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      await updateFileError(key, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get user files list
   */
  async getUserFiles(userId: string): Promise<FileInfo[]> {
    const readyFiles = await getUserReadyFiles(userId);
    
    return readyFiles.map(item => {
      const keyParts = item.key.split('/');
      const filename = keyParts[keyParts.length - 1];
      const cleanFilename = filename.replace(/^\d+-/, '');
      
      return {
        id: item.id,
        key: item.key,
        fileName: cleanFilename,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        contentType: this.getContentType(cleanFilename),
        isEnabled: item.isEnabled !== undefined ? item.isEnabled : true
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Delete file completely
   */
  async deleteFile(fileId: string): Promise<{ message: string; deletedFileId: string; deletedS3Key: string }> {
    const file = await this.getFileById(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    // Delete from all systems
    await Promise.allSettled([
      this.s3Service.deleteFile(file.key),
      this.embeddingService.deleteFileEmbeddings(fileId, file.userId),
      this.decrementUserWordCount(file.userId, file.wordCount)
    ]);

    // Delete from database last
    await this.deleteFileRecord(fileId);

    return {
      message: 'File deleted successfully',
      deletedFileId: fileId,
      deletedS3Key: file.key
    };
  }

  /**
   * Toggle file enabled status
   */
  async toggleFile(fileId: string, isEnabled: boolean): Promise<{ fileId: string; isEnabled: boolean; message: string }> {
    await updateFileById(fileId, { 
      isEnabled,
      updatedAt: new Date().toISOString()
    });

    return {
      fileId,
      isEnabled,
      message: `File ${isEnabled ? 'enabled' : 'disabled'} in context pool`
    };
  }

  // Private helper methods
  private validateFileUpload(contentType: string, fileSize: number): void {
    const ALLOWED_CONTENT_TYPES = new Set([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp'
    ]);

    const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new Error('Unsupported file type');
    }

    if (fileSize > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File too large (${Math.round(fileSize / 1024 / 1024)}MB). Maximum size is 25MB.`);
    }
  }

  private async validateUserQuota(userId: string): Promise<void> {
    try {
      const validation = await validateUsage(userId, 'words', 1);
      if (!validation.canProceed) {
        throw new Error(validation.message || 'Usage limit exceeded');
      }
    } catch (error) {
      console.warn('Usage validation failed:', error);
      // Continue - don't block on validation errors
    }
  }

  private async validateWordUsage(userId: string, wordCount: number): Promise<void> {
    const validation = await validateUsage(userId, 'words', wordCount);
    if (!validation.canProceed) {
      throw new Error(`Usage limit exceeded: ${validation.message}`);
    }
  }

  private generateFileKey(fileName: string, userId: string): string {
    const timestamp = Date.now();
    const cleanName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    return `uploads/${userId}/${timestamp}-${cleanName}`;
  }

  private getContentType(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (lower.match(/\.(png|jpg|jpeg|gif|webp)$/)) {
      return `image/${lower.split('.').pop()}`;
    }
    return 'application/octet-stream';
  }

  private async cleanupFile(bucket: string, s3Key: string, fileId: string, userId: string): Promise<void> {
    // Small delay for frontend polling
    setTimeout(async () => {
      await Promise.allSettled([
        this.s3Service.deleteFile(s3Key),
        this.embeddingService.deleteFileEmbeddings(fileId, userId),
        this.deleteFileRecord(fileId)
      ]);
    }, 2000);
  }

  private async getFileById(fileId: string) {
    // This needs to be implemented in database utils
    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const { db } = await import('../../db');
    const { FILES_TABLE } = await import('../../utils/constants');
    
    const result = await db.send(new GetCommand({
      TableName: FILES_TABLE,
      Key: { id: fileId }
    }));
    
    return result.Item;
  }

  private async deleteFileRecord(fileId: string): Promise<void> {
    const { DeleteCommand } = await import('@aws-sdk/lib-dynamodb');
    const { db } = await import('../../db');
    const { FILES_TABLE } = await import('../../utils/constants');
    
    await db.send(new DeleteCommand({
      TableName: FILES_TABLE,
      Key: { id: fileId }
    }));
  }

  private async decrementUserWordCount(userId: string, wordCount: number): Promise<void> {
    if (wordCount && userId) {
      try {
        await decrementWordsStored(userId, wordCount);
      } catch (error) {
        console.warn('Failed to decrement word count:', error);
      }
    }
  }
}
