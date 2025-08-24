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
      throw error; // Trigger SQS retry
    }
  }
};