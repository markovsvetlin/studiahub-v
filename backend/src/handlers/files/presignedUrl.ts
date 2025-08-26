/**
 * Simple presigned URL handler
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { 
  S3_BUCKET, 
  AWS_REGION, 
  MAX_FILE_SIZE_BYTES, 
  ALLOWED_CONTENT_TYPES 
} from '../../utils/constants';
import { createErrorResponse, createSuccessResponse } from '../../utils/http';
import { createFileRecord, updateFileById, findFileByKey } from '../../utils/files/database';
import { triggerFileProcessing } from '../../utils/files/queue';
import { validateUsage } from '../../utils/usage/database';

const s3 = new S3Client({ region: AWS_REGION });

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
    
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return createErrorResponse(400, 'Unsupported file type');
    }
    
    if (fileSize && fileSize > MAX_FILE_SIZE_BYTES) {
      return createErrorResponse(400, 'File too large');
    }
    
    // Check if user has any remaining word quota before allowing upload
    try {
      const validation = await validateUsage(userId, 'words', 1); // Check if user can process at least 1 word
      if (!validation.canProceed) {
        return createErrorResponse(400, validation.message || 'Usage limit exceeded');
      }
    } catch (error) {
      console.error('Usage validation failed:', error);
      // Continue with upload - don't block on validation errors, let processing handle it
    }
    
    // Generate user-specific file key
    const timestamp = Date.now();
    const cleanName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const fileKey = `uploads/${userId}/${timestamp}-${cleanName}`;
    
    // Generate presigned URL
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: fileKey,
      ContentType: contentType,
      ContentLength: fileSize
    });
    
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    
    // Create file record with userId
    const fileRecord = await createFileRecord(fileKey, userId, 'uploading');
    
    return createSuccessResponse({
      uploadUrl,
      fileId: fileRecord.id,
      key: fileKey
    });
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
    
    // Update file status
    const file = await findFileByKey(key);
    if (!file) {
      return createErrorResponse(404, 'File not found');
    }
    
    await updateFileById(file.id, { status: 'queued' });
    
    // Trigger processing with userId
    await triggerFileProcessing(key, userId);
    
    return createSuccessResponse({
      fileId: file.id,
      status: 'queued'
    });
  } catch (error) {
    return createErrorResponse(500, (error as Error).message);
  }
}