/**
 * Simple file processing handler
 */

import { FileService } from '../../services/files/FileService';

const fileService = new FileService();

/**
 * Main file processing function
 */
export async function processObject(bucket: string, key: string, userId?: string): Promise<void> {
  const result = await fileService.processFile(bucket, key, userId);
  
  if (!result.success) {
    throw new Error(result.error || 'File processing failed');
  }
}

