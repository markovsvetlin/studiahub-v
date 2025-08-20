/**
 * Shared constants used across the application
 */

// File upload constants
export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
// Supported file types and extensions
export const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
]);



// Environment variables with defaults
export const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
export const S3_BUCKET = process.env.S3_BUCKET || '';
export const FILES_TABLE = process.env.FILES_TABLE!;
export const ITEMS_TABLE = process.env.ITEMS_TABLE!;
export const PROCESSING_QUEUE_URL = process.env.PROCESSING_QUEUE_URL;
