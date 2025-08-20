import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { AWS_REGION, S3_BUCKET, PROCESSING_QUEUE_URL } from '../constants';

const sqs = new SQSClient({ region: AWS_REGION });

/**
 * Trigger file processing
 */
export async function triggerFileProcessing(key: string): Promise<void> {
  if (process.env.IS_OFFLINE) {
    const { processObject } = await import('../../handlers/files/processFile');
    processObject(S3_BUCKET, key).catch(console.error);
    return;
  }
  if (!PROCESSING_QUEUE_URL) {
    console.warn('No queue URL configured');
    return;
  }
  
  try {
    await sqs.send(new SendMessageCommand({
      QueueUrl: PROCESSING_QUEUE_URL,
      MessageBody: JSON.stringify({ bucket: S3_BUCKET, key })
    }));
  } catch (error) {
    console.error('Failed to queue processing:', error);
  }
}