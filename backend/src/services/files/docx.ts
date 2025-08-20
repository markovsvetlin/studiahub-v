/**
 * Simple DOCX text extraction
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import mammoth from 'mammoth';
import { AWS_REGION } from '../../utils/constants';

const s3 = new S3Client({ region: AWS_REGION });

export interface DocxPage {
  pageNumber: number;
  text: string;
}

/**
 * Extract text from DOCX
 */
export async function extractTextFromDocx(params: { s3Bucket: string; s3Key: string }): Promise<DocxPage[]> {
  const { s3Bucket, s3Key } = params;
  
  const response = await s3.send(new GetObjectCommand({
    Bucket: s3Bucket,
    Key: s3Key
  }));
  
  const buffer = Buffer.from(await response.Body?.transformToByteArray() || []);
  const result = await mammoth.extractRawText({ buffer }) as { value: string };
  
  return [{
    pageNumber: 1,
    text: result.value.trim()
  }];
}