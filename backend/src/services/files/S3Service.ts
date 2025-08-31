/**
 * S3 Service - handles all S3 operations
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AWS_REGION, S3_BUCKET } from '../../utils/constants';

export class S3Service {
  private client: S3Client;

  constructor() {
    this.client = new S3Client({ region: AWS_REGION });
  }

  /**
   * Generate presigned upload URL
   */
  async generateUploadUrl(key: string, contentType: string, fileSize: number): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: fileSize
    });

    return await getSignedUrl(this.client, command, { expiresIn: 3600 });
  }

  /**
   * Delete file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: key
      }));

    } catch (error) {
      console.warn(`⚠️  Failed to delete from S3: ${error}`);
      throw error;
    }
  }

  /**
   * Get file content from S3
   */
  async getFileContent(key: string): Promise<string> {
    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key
      }));

      return await response.Body?.transformToString() || '';
    } catch (error) {
      console.error(`Failed to get file content from S3: ${error}`);
      throw error;
    }
  }

  /**
   * Get file as buffer
   */
  async getFileBuffer(key: string): Promise<Buffer> {
    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key
      }));

      return Buffer.from(await response.Body?.transformToByteArray() || []);
    } catch (error) {
      console.error(`Failed to get file buffer from S3: ${error}`);
      throw error;
    }
  }
}
