/**
 * Files list handler - returns all files in the database
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { createErrorResponse, createSuccessResponse } from '../../utils/http';
import { FileService } from '../../services/files/FileService';
import { validateJWT } from '../../middleware/jwtAuth';

const fileService = new FileService();

export async function list(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    // Validate JWT token and get userId
    const { userId, error } = await validateJWT(event);
    if (!userId || error) {
      return createErrorResponse(401, error || 'Unauthorized');
    }

    const files = await fileService.getUserFiles(userId);
    return createSuccessResponse({ files });
  } catch (error) {
    console.error('Failed to list files:', error);
    return createErrorResponse(500, (error as Error).message);
  }
}


export async function deleteFile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    // Validate JWT token and get userId
    const { userId, error } = await validateJWT(event);
    if (!userId || error) {
      return createErrorResponse(401, error || 'Unauthorized');
    }

    const fileId = event.pathParameters?.id;
    if (!fileId) {
      return createErrorResponse(400, 'File ID required');
    }

    const result = await fileService.deleteFile(fileId);
    return createSuccessResponse(result);
  } catch (error) {
    console.error('Failed to delete file:', error);
    return createErrorResponse(500, `Failed to delete file: ${(error as Error).message}`);
  }
}

export async function toggleFile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    // Validate JWT token and get userId
    const { userId, error } = await validateJWT(event);
    if (!userId || error) {
      return createErrorResponse(401, error || 'Unauthorized');
    }

    const fileId = event.pathParameters?.id;
    if (!fileId) {
      return createErrorResponse(400, 'File ID required');
    }

    if (!event.body) {
      return createErrorResponse(400, 'Request body required');
    }

    const { isEnabled } = JSON.parse(event.body);
    const result = await fileService.toggleFile(fileId, isEnabled);
    
    return createSuccessResponse(result);
  } catch (error) {
    console.error('Failed to toggle file:', error);
    return createErrorResponse(500, (error as Error).message);
  }
}

