/**
 * AWS SQS client configuration
 */

import { SQSClient } from '@aws-sdk/client-sqs';
import { AWS_REGION } from './constants';

// Create and configure SQS client
export const sqs = new SQSClient({
  region: AWS_REGION,
  // Use localstack for local development
  ...(process.env.IS_OFFLINE === 'true' && {
    endpoint: 'http://localhost:4566',
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test'
    }
  })
});