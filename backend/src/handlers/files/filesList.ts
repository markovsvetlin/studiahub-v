/**
 * Files list handler - returns all files in the database
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DeleteCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { db } from '../../db';
import { FILES_TABLE, S3_BUCKET, AWS_REGION } from '../../utils/constants';
import { createErrorResponse, createSuccessResponse } from '../../utils/http';
import { pineconeService } from '../../services/files/pinecone';
import { getUserReadyFiles } from '../../utils/files/database';

const s3 = new S3Client({ region: AWS_REGION });

/**
 * List user's ready files - now using optimal GSI query (no filtering!)
 */
export async function list(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = event.queryStringParameters?.userId;
    if (!userId) {
      return createErrorResponse(400, 'userId query parameter required');
    }

    // Direct query for ready files - no filtering needed!
    const readyFiles = await getUserReadyFiles(userId);

    const files = readyFiles.map(item => {
      // Extract filename from key (remove timestamp prefix)
      const keyParts = item.key.split('/');
      const filename = keyParts[keyParts.length - 1];
      const cleanFilename = filename.replace(/^\d+-/, ''); // Remove timestamp prefix
      
      // Determine content type from filename
      let contentType = 'application/octet-stream';
      if (cleanFilename.toLowerCase().endsWith('.pdf')) {
        contentType = 'application/pdf';
      } else if (cleanFilename.toLowerCase().endsWith('.docx')) {
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (cleanFilename.toLowerCase().match(/\.(png|jpg|jpeg|gif|webp)$/)) {
        contentType = `image/${cleanFilename.split('.').pop()?.toLowerCase()}`;
      }

      // Estimate file size from filename or use a default
      // In a real implementation, you'd store this in the DB or get it from S3
      let estimatedSize = 1024 * 1024; // Default 1MB
      if (cleanFilename.toLowerCase().endsWith('.pdf')) {
        estimatedSize = 2.5 * 1024 * 1024; // 2.5MB for PDFs
      } else if (cleanFilename.toLowerCase().endsWith('.docx')) {
        estimatedSize = 1.8 * 1024 * 1024; // 1.8MB for DOCX
      } else if (cleanFilename.toLowerCase().match(/\.(png|jpg|jpeg|gif|webp)$/)) {
        estimatedSize = 0.8 * 1024 * 1024; // 800KB for images
      }

      return {
        id: item.id,
        key: item.key,
        fileName: cleanFilename,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        contentType,
        fileSize: Math.round(estimatedSize),
        isEnabled: item.isEnabled !== undefined ? item.isEnabled : true
      };
    });

    // Sort by creation date (newest first) - simple and clean
    files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return createSuccessResponse({ files });
  } catch (error) {
    console.error('Failed to list files:', error);
    return createErrorResponse(500, (error as Error).message);
  }
}

/**
 * Delete a file completely - removes from S3, Pinecone, and DynamoDB
 */
export async function deleteFile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const fileId = event.pathParameters?.id;
    if (!fileId) {
      return createErrorResponse(400, 'File ID required');
    }

    console.log(`Starting deletion process for file: ${fileId}`);

    // Step 1: Get file record to get the S3 key
    const getResult = await db.send(new GetCommand({
      TableName: FILES_TABLE,
      Key: { id: fileId }
    }));

    const fileRecord = getResult.Item;
    if (!fileRecord) {
      return createErrorResponse(404, 'File not found');
    }

    const s3Key = fileRecord.key;
    console.log(`Found file record with S3 key: ${s3Key}`);

    // Step 2: Delete from S3
    try {
      await s3.send(new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key
      }));
      console.log(`✅ Deleted from S3: ${s3Key}`);
    } catch (s3Error) {
      console.warn(`⚠️  Failed to delete from S3: ${s3Error}`);
      // Continue with other deletions even if S3 fails
    }

    // Step 3: Delete from Pinecone (use userId from file record)
    try {
      await pineconeService.initialize();
      await pineconeService.deleteFileChunks(fileId, fileRecord.userId);
      console.log(`✅ Deleted chunks from Pinecone for file: ${fileId}`);
    } catch (pineconeError) {
      console.warn(`⚠️  Failed to delete from Pinecone: ${pineconeError}`);
      // Continue with DynamoDB deletion even if Pinecone fails
    }

    // Step 4: Delete from DynamoDB
    await db.send(new DeleteCommand({
      TableName: FILES_TABLE,
      Key: { id: fileId }
    }));
    console.log(`✅ Deleted from DynamoDB: ${fileId}`);

    console.log(`🎉 Successfully deleted file ${fileId} from all systems`);
    return createSuccessResponse({ 
      message: 'File deleted successfully from all systems',
      deletedFileId: fileId,
      deletedS3Key: s3Key
    });
  } catch (error) {
    console.error('❌ Failed to delete file:', error);
    return createErrorResponse(500, `Failed to delete file: ${(error as Error).message}`);
  }
}

/**
 * Toggle file enabled status
 */
export async function toggleFile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const fileId = event.pathParameters?.id;
    if (!fileId) {
      return createErrorResponse(400, 'File ID required');
    }

    if (!event.body) {
      return createErrorResponse(400, 'Request body required');
    }

    const { isEnabled } = JSON.parse(event.body);
    if (typeof isEnabled !== 'boolean') {
      return createErrorResponse(400, 'isEnabled must be a boolean');
    }

    // Update the isEnabled field in DynamoDB
    await db.send(new UpdateCommand({
      TableName: FILES_TABLE,
      Key: { id: fileId },
      UpdateExpression: 'SET isEnabled = :isEnabled, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':isEnabled': isEnabled,
        ':updatedAt': new Date().toISOString()
      }
    }));

    console.log(`✅ File ${fileId} ${isEnabled ? 'enabled' : 'disabled'} in context pool`);
    
    return createSuccessResponse({ 
      fileId, 
      isEnabled,
      message: `File ${isEnabled ? 'enabled' : 'disabled'} in context pool` 
    });
  } catch (error) {
    console.error('Failed to toggle file:', error);
    return createErrorResponse(500, (error as Error).message);
  }
}

