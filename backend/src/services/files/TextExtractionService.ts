/**
 * Text Extraction Service - simplified text extraction
 */

import { S3Service } from './S3Service';
import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import mammoth from 'mammoth';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { countWordsInPages } from '../../utils/usage/wordCount';
import { AWS_REGION } from '../../utils/constants';

export interface PageContent {
  pageNumber: number;
  text: string;
}

export class TextExtractionService {
  private s3Service: S3Service;
  private textractClient: TextractClient;

  constructor() {
    this.s3Service = new S3Service();
    this.textractClient = new TextractClient({ region: AWS_REGION });
  }

  /**
   * Extract text from any supported file type
   */
  async extractText(bucket: string, key: string): Promise<PageContent[]> {
    const fileExtension = this.getFileExtension(key);
    let pages: PageContent[];

    switch (fileExtension) {
      case 'pdf':
        pages = await this.extractFromPdf(key);
        break;
      case 'docx':
        pages = await this.extractFromDocx(key);
        break;
      default:
        pages = await this.extractFromImageOrOcr(key);
        break;
    }

    const totalChars = pages.reduce((sum, p) => sum + p.text.length, 0);
    const wordCount = countWordsInPages(pages);
    
    console.log(`📄 Extracted text: ${totalChars} characters, ${wordCount} words`);
    
    return pages;
  }

  private async extractFromPdf(key: string): Promise<PageContent[]> {
    const buffer = await this.s3Service.getFileBuffer(key);
    const result = await pdfParse(buffer) as { text: string };
    
    const extractedChars = result.text.length;
    console.log(`📄 PDF extracted via pdf-parse: ${extractedChars} characters`);
    
    // If minimal text, try OCR
    if (extractedChars < 200) {
      console.log('🔍 PDF appears scanned, trying OCR...');
      return await this.extractFromImageOrOcr(key);
    }
    
    // Split by form feed or return as single page
    const pages = result.text.split('\f').filter(text => text.trim());
    
    if (!pages.length) {
      return [{ pageNumber: 1, text: result.text }];
    }
    
    return pages.map((text, index) => ({
      pageNumber: index + 1,
      text: text.trim()
    }));
  }

  private async extractFromDocx(key: string): Promise<PageContent[]> {
    const buffer = await this.s3Service.getFileBuffer(key);
    const result = await mammoth.extractRawText({ buffer }) as { value: string };
    
    return [{
      pageNumber: 1,
      text: result.value.trim()
    }];
  }

  private async extractFromImageOrOcr(key: string): Promise<PageContent[]> {
    const { S3_BUCKET } = await import('../../utils/constants');
    
    const response = await this.textractClient.send(new DetectDocumentTextCommand({
      Document: { S3Object: { Bucket: S3_BUCKET, Name: key } }
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

  private getFileExtension(key: string): string {
    return key.toLowerCase().split('.').pop() || '';
  }
}
