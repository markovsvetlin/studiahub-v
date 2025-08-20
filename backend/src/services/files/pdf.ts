/**
 * Simple PDF text extraction
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { AWS_REGION } from '../../utils/constants';

const s3 = new S3Client({ region: AWS_REGION });

export interface PdfPage {
  pageNumber: number;
  text: string;
}

/**
 * Extract text from PDF
 */
export async function extractTextFromPdf(params: { s3Bucket: string; s3Key: string }): Promise<PdfPage[]> {
  const { s3Bucket, s3Key } = params;
  
  const response = await s3.send(new GetObjectCommand({
    Bucket: s3Bucket,
    Key: s3Key
  }));
  
  const buffer = Buffer.from(await response.Body?.transformToByteArray() || []);
  const result = await pdfParse(buffer) as { text: string };
  
  // Split by form feed or just return as one page
  const pages = result.text.split('\f').filter(text => text.trim());
  
  if (!pages.length) {
    return [{ pageNumber: 1, text: result.text }];
  }
  
  return pages.map((text, index) => ({
    pageNumber: index + 1,
    text: text.trim()
  }));
}