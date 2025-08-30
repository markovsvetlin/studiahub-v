/**
 * File status and content retrieval handler
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { createErrorResponse, createSuccessResponse } from '../../utils/http';
import { S3Service } from '../../services/files/S3Service';

const s3Service = new S3Service();

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
      const content = await s3Service.getFileContent(fileKey);
      return {
        statusCode: 200,
        headers: { 'content-type': 'text/plain' },
        body: content
      };
    }
  } catch (error) {
    return createErrorResponse(500, (error as Error).message);
  }
}