/**
 * Simple SQS queue handler
 */

import { SQSHandler } from 'aws-lambda';
import { processObject } from './processFile';

/**
 * Process SQS messages
 */
export const process: SQSHandler = async (event) => {
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      await processObject(message.bucket, message.key, message.userId);
    } catch (error) {
      console.error('Failed to process message:', error);
      
      // Don't retry validation errors - they're permanent failures
      if (error instanceof Error && (
        error.message.includes('FILE_TOO_SMALL') ||
        error.message.includes('Usage limit exceeded')
      )) {
        console.log('Skipping retry for validation error:', error.message);
        return; // Don't throw - message will be deleted from queue
      }
      
      // Throw other errors to trigger SQS retry (network issues, temporary failures, etc.)
      throw error;
    }
  }
};