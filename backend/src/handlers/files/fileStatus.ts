/**
 * File status and content retrieval handler
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { S3_BUCKET, AWS_REGION } from '../../utils/constants';
import { createErrorResponse, createSuccessResponse } from '../../utils/http';

const s3 = new S3Client({ region: AWS_REGION });


export async function get(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const fileKey = event.pathParameters?.key;
    if (!fileKey) {
      return createErrorResponse(400, 'File key required');
    }

    const isStatusRequest = event.queryStringParameters?.status === '1';
    
    if (isStatusRequest) {
      const { findFileByKey } = await import('../../utils/files/database');
      const file = await findFileByKey(fileKey);
      return createSuccessResponse({ file });
    } else {
      const response = await s3.send(new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: fileKey
      }));
      
      const content = await response.Body?.transformToString();
      return {
        statusCode: 200,
        headers: { 'content-type': 'text/plain' },
        body: content || ''
      };
    }
  } catch (error) {
    return createErrorResponse(500, (error as Error).message);
  }
}