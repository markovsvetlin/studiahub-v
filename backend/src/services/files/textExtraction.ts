/**
 * Simple text extraction router
 */

import { extractTextFromImageOrPdf } from './textract';
import { extractTextFromPdf } from './pdf';
import { extractTextFromDocx } from './docx';
import { countWordsInPages } from '../../utils/usage/wordCount';
import { validateUsage } from '../../utils/usage/database';

export interface PageContent {
  pageNumber: number;
  text: string;
}

/**
 * Extract text from file based on type with usage validation
 */
export async function extractTextFromFile(bucket: string, key: string, userId?: string): Promise<PageContent[]> {
  let pages: PageContent[];
  console.log('vlizaaa')
  if (key.toLowerCase().endsWith('.pdf')) {
    // Try pdf-parse first (fast for text-based PDFs)
    pages = await extractTextFromPdf({ s3Bucket: bucket, s3Key: key });
    const extractedChars = pages.reduce((sum, p) => sum + p.text.length, 0);
    console.log(`📄 Extracted PDF text via pdf-parse: ${extractedChars} characters`);
    
    // If no meaningful text extracted, likely a scanned PDF - use Textract OCR
    if (extractedChars < 200) { // Threshold for minimal text content
      console.log(`🔍 PDF appears to be scanned (${extractedChars} chars), falling back to Textract OCR...`);
      pages = await extractTextFromImageOrPdf({ s3Bucket: bucket, s3Key: key });
      console.log(`📄 Extracted PDF text via Textract OCR: ${pages.reduce((sum, p) => sum + p.text.length, 0)} characters`);
    }
  } else if (key.toLowerCase().endsWith('.docx')) {
    pages = await extractTextFromDocx({ s3Bucket: bucket, s3Key: key });
    console.log(`📄 Extracted DOCX text: ${pages.reduce((sum, p) => sum + p.text.length, 0)} characters`);
  } else {
    // Default to Textract for images and other formats
    pages = await extractTextFromImageOrPdf({ s3Bucket: bucket, s3Key: key });
    console.log(`📄 Extracted text via Textract: ${pages.reduce((sum, p) => sum + p.text.length, 0)} characters`);
  }
  
  // Count words for logging (usage will be handled in processFile.ts)
  const wordCount = countWordsInPages(pages);
  console.log(`📊 Word count: ${wordCount.toLocaleString()} words`);
  
  return pages;
}