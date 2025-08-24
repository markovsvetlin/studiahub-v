/**
 * Simple database utilities for files
 */

import { PutCommand, UpdateCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db';
import { FILES_TABLE } from '../constants';

export interface FileRecord {
  id: string;
  key: string;
  userId: string;
  status: 'uploading' | 'queued' | 'processing' | 'ready' | 'error';
  progress: number;
  totalChunks: number;
  createdAt: string;
  updatedAt?: string;
  isEnabled?: boolean;
}

/**
 * Create a new file record
 */
export async function createFileRecord(key: string, userId: string, status: FileRecord['status'] = 'uploading'): Promise<FileRecord> {
  const record: FileRecord = {
    id: uuidv4(),
    key,
    userId,
    status,
    progress: 0,
    totalChunks: 0,
    createdAt: new Date().toISOString(),
    isEnabled: true
  };
  
  await db.send(new PutCommand({
    TableName: FILES_TABLE,
    Item: record
  }));
  
  return record;
}

/**
 * Update file progress by key (finds file first, then updates by id)
 */
export async function updateFileProgress(key: string, progress: number, status?: FileRecord['status']): Promise<void> {
  // First find the file by key to get the id
  const file = await findFileByKey(key);
  if (!file) {
    throw new Error(`File not found with key: ${key}`);
  }
  
  // Update by id
  await updateFileById(file.id, { progress, ...(status && { status }) });
}

/**
 * Update file by ID
 */
export async function updateFileById(fileId: string, data: Partial<FileRecord>): Promise<void> {
  await db.send(new UpdateCommand({
    TableName: FILES_TABLE,
    Key: { id: fileId },
    UpdateExpression: 'SET progress = :progress, #status = :status, totalChunks = :totalChunks, updatedAt = :updatedAt',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':progress': data.progress ?? 0,
      ':status': data.status ?? 'processing', 
      ':totalChunks': data.totalChunks ?? 0,
      ':updatedAt': new Date().toISOString()
    }
  }));
}

/**
 * Find file by key
 */
export async function findFileByKey(key: string): Promise<any> {
  const result = await db.send(new QueryCommand({
    TableName: FILES_TABLE,
    IndexName: 'key-index',
    KeyConditionExpression: '#key = :key',
    ExpressionAttributeNames: { '#key': 'key' },
    ExpressionAttributeValues: { ':key': key },
    Limit: 1
  }));
  
  return result.Items?.[0] || null;
}

/**
 * Get IDs of all enabled and ready files for a user
 */
export async function getEnabledFileIds(userId?: string): Promise<string[]> {
  const filterExpression = userId 
    ? '#status = :status AND #isEnabled = :isEnabled AND userId = :userId'
    : '#status = :status AND #isEnabled = :isEnabled';
    
  const expressionAttributeValues: any = { 
    ':status': 'ready',
    ':isEnabled': true
  };
  
  if (userId) {
    expressionAttributeValues[':userId'] = userId;
  }
  
  const result = await db.send(new ScanCommand({
    TableName: FILES_TABLE,
    FilterExpression: filterExpression,
    ExpressionAttributeNames: { 
      '#status': 'status',
      '#isEnabled': 'isEnabled'
    },
    ExpressionAttributeValues: expressionAttributeValues
  }));
  
  return (result.Items || []).map(item => item.id);
}