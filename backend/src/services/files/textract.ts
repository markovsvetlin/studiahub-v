/**
 * Simple Textract OCR service
 */

import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import { AWS_REGION } from '../../utils/constants';

const textract = new TextractClient({ region: AWS_REGION });

export interface TextractPage {
  pageNumber: number;
  text: string;
}

/**
 * Extract text from images/PDFs using Textract
 */
export async function extractTextFromImageOrPdf(params: { s3Bucket: string; s3Key: string }): Promise<TextractPage[]> {
  const { s3Bucket, s3Key } = params;
  
  const response = await textract.send(new DetectDocumentTextCommand({
    Document: { S3Object: { Bucket: s3Bucket, Name: s3Key } }
  }));
  
  const blocks = response.Blocks || [];
  const lines = blocks
    .filter(block => block.BlockType === 'LINE' && block.Text?.trim())
    .map(block => ({
      text: block.Text!,
      page: block.Page || 1
    }));
  
  if (!lines.length) {
    return [{ pageNumber: 1, text: '' }];
  }
  
  // Group by page
  const pageMap: Record<number, string[]> = {};
  for (const line of lines) {
    if (!pageMap[line.page]) pageMap[line.page] = [];
    pageMap[line.page].push(line.text);
  }
  
  return Object.entries(pageMap)
    .map(([pageNum, textLines]) => ({
      pageNumber: Number(pageNum),
      text: textLines.join('\n')
    }))
    .sort((a, b) => a.pageNumber - b.pageNumber);
}