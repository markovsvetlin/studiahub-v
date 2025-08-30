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
import { decrementWordsStored } from '../../utils/usage/database';
import { getUserReadyFiles } from '../../utils/files/database';

const s3 = new S3Client({ region: AWS_REGION });

export async function list(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = event.queryStringParameters?.userId;
    if (!userId) {
      return createErrorResponse(400, 'userId query parameter required');
    }

    const readyFiles = await getUserReadyFiles(userId);

    const files = readyFiles.map(item => {
      const keyParts = item.key.split('/');
      const filename = keyParts[keyParts.length - 1];
      const cleanFilename = filename.replace(/^\d+-/, ''); // Remove timestamp prefix
      let contentType = 'application/octet-stream';
      if (cleanFilename.toLowerCase().endsWith('.pdf')) {
        contentType = 'application/pdf';
      } else if (cleanFilename.toLowerCase().endsWith('.docx')) {
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (cleanFilename.toLowerCase().match(/\.(png|jpg|jpeg|gif|webp)$/)) {
        contentType = `image/${cleanFilename.split('.').pop()?.toLowerCase()}`;
      }  
      return {
        id: item.id,
        key: item.key,
        fileName: cleanFilename,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        contentType,
        isEnabled: item.isEnabled !== undefined ? item.isEnabled : true
      };
    });

    files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return createSuccessResponse({ files });
  } catch (error) {
    console.error('Failed to list files:', error);
    return createErrorResponse(500, (error as Error).message);
  }
}


export async function deleteFile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const fileId = event.pathParameters?.id;
    if (!fileId) {
      return createErrorResponse(400, 'File ID required');
    }

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
    }

    try {
      await pineconeService.initialize();
      await pineconeService.deleteFileChunks(fileId, fileRecord.userId);
      console.log(`✅ Deleted chunks from Pinecone for file: ${fileId}`);
    } catch (pineconeError) {
      console.warn(`⚠️  Failed to delete from Pinecone: ${pineconeError}`);
    }

    // Step 3: Decrement word storage if wordCount is available
    console.log(`🔍 File record debug:`, {
      fileId,
      userId: fileRecord.userId,
      wordCount: fileRecord.wordCount,
      hasWordCount: !!fileRecord.wordCount,
      hasUserId: !!fileRecord.userId
    });
    
    if (fileRecord.wordCount && fileRecord.userId) {
      try {
        await decrementWordsStored(fileRecord.userId, fileRecord.wordCount);
        console.log(`✅ Decremented word storage by ${fileRecord.wordCount} words for user ${fileRecord.userId}`);
      } catch (usageError) {
        console.warn(`⚠️  Failed to decrement word storage: ${usageError}`);
      }
    } else {
      console.warn(`⚠️  Cannot decrement word storage: wordCount=${fileRecord.wordCount}, userId=${fileRecord.userId}`);
      
      // For files without wordCount, we can't track usage accurately
      // This happens with files uploaded before wordCount tracking was added
      if (fileRecord.userId && !fileRecord.wordCount) {
        console.log(`💡 File ${fileId} was uploaded before word tracking - no usage adjustment needed`);
      }
    }

    await db.send(new DeleteCommand({
      TableName: FILES_TABLE,
      Key: { id: fileId }
    }));

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

