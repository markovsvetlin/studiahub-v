/**
 * Simple presigned URL handler
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { createErrorResponse, createSuccessResponse } from '../../utils/http';
import { FileService } from '../../services/files/FileService';
import { triggerFileProcessing } from '../../utils/files/queue';
import { validateJWT } from '../../middleware/nextAuthMiddleware';

const fileService = new FileService();

/**
 * Generate presigned URL for upload
 */
export async function generatePresignedUrl(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    // Validate JWT token and get userId
    const { userId, error } = await validateJWT(event);
    if (!userId || error) {
      return createErrorResponse(401, error || 'Unauthorized');
    }

    if (!event.body) {
      return createErrorResponse(400, 'Request body required');
    }
    
    const { fileName, contentType, fileSize } = JSON.parse(event.body);
    if (!fileName || !contentType) {
      return createErrorResponse(400, 'fileName and contentType required');
    }
    
    const result = await fileService.createUploadUrl(fileName, contentType, fileSize, userId);
    return createSuccessResponse(result);
  } catch (error) {
    return createErrorResponse(500, (error as Error).message);
  }
}

/**
 * Confirm upload completion
 */
export async function confirmUpload(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    // Validate JWT token and get userId
    const { userId, error } = await validateJWT(event);
    if (!userId || error) {
      return createErrorResponse(401, error || 'Unauthorized');
    }

    if (!event.body) {
      return createErrorResponse(400, 'Request body required');
    }
    
    const { key } = JSON.parse(event.body);
    if (!key) {
      return createErrorResponse(400, 'File key required');
    }
    
    const result = await fileService.confirmUpload(key, userId);
    
    // Trigger processing with userId
    await triggerFileProcessing(key, userId);
    
    return createSuccessResponse(result);
  } catch (error) {
    return createErrorResponse(500, (error as Error).message);
  }
}