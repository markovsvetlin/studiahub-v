/**
 * Simple presigned URL handler
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { createErrorResponse, createSuccessResponse } from '../../utils/http';
import { FileService } from '../../services/files/FileService';
import { triggerFileProcessing } from '../../utils/files/queue';

const fileService = new FileService();

/**
 * Generate presigned URL for upload
 */
export async function generatePresignedUrl(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    if (!event.body) {
      return createErrorResponse(400, 'Request body required');
    }
    
    const { fileName, contentType, fileSize, userId } = JSON.parse(event.body);
    if (!fileName || !contentType || !userId) {
      return createErrorResponse(400, 'fileName, contentType, and userId required');
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
    if (!event.body) {
      return createErrorResponse(400, 'Request body required');
    }
    
    const { key, userId } = JSON.parse(event.body);
    if (!key || !userId) {
      return createErrorResponse(400, 'File key and userId required');
    }
    
    const result = await fileService.confirmUpload(key, userId);
    
    // Trigger processing with userId
    await triggerFileProcessing(key, userId);
    
    return createSuccessResponse(result);
  } catch (error) {
    return createErrorResponse(500, (error as Error).message);
  }
}