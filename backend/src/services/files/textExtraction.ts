/**
 * Simple text extraction router
 */

import { extractTextFromImageOrPdf } from './textract';
import { extractTextFromPdf } from './pdf';
import { extractTextFromDocx } from './docx';

export interface PageContent {
  pageNumber: number;
  text: string;
}

/**
 * Extract text from file based on type
 */
export async function extractTextFromFile(bucket: string, key: string): Promise<PageContent[]> {
  if (key.toLowerCase().endsWith('.pdf')) {
    // Use pdf-parse for PDFs - simpler and focuses on complete text extraction
    const pdfResult = await extractTextFromPdf({ s3Bucket: bucket, s3Key: key });
    console.log(`📄 Extracted PDF text: ${pdfResult.reduce((sum, p) => sum + p.text.length, 0)} characters`);
    return pdfResult;
  }
  
  if (key.toLowerCase().endsWith('.docx')) {
    const docxResult = await extractTextFromDocx({ s3Bucket: bucket, s3Key: key });
    console.log(`📄 Extracted DOCX text: ${docxResult.reduce((sum, p) => sum + p.text.length, 0)} characters`);
    return docxResult;
  }
  
  // Default to Textract for images and other formats
  const textractResult = await extractTextFromImageOrPdf({ s3Bucket: bucket, s3Key: key });
  console.log(`📄 Extracted text via Textract: ${textractResult.reduce((sum, p) => sum + p.text.length, 0)} characters`);
  return textractResult;
}