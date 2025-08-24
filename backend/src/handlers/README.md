# Handlers Directory Documentation

## Overview
The handlers directory contains AWS Lambda function handlers that serve as API endpoints for the StudiaHub-v2 application. Each handler represents a specific HTTP endpoint or event processor.

## File Structure

### Core Handler
- `health.ts` - System health check endpoint

### File Management Handlers (`/files/`)
- `fileStatus.ts` - Check file processing status
- `filesList.ts` - List user's uploaded files  
- `presignedUrl.ts` - Generate secure S3 upload URLs
- `processFile.ts` - Process uploaded files (text extraction, chunking, embeddings)
- `queue.ts` - SQS queue handler for async file processing

### Quiz Management Handlers (`/quiz/`)
- `deleteQuiz.ts` - Delete quiz and associated data
- `generateQuiz.ts` - Initiate quiz generation process
- `quizStatus.ts` - Check quiz generation progress
- `quizWorker.ts` - Generate individual quiz questions (worker function)

## Handler Patterns

### 1. HTTP Request Handlers
```typescript
export const handlerName = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Input validation
    // Business logic
    // Return formatted response
  } catch (error) {
    // Error handling and logging
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}
```

### 2. SQS Event Handlers
```typescript
export const handlerName = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    // Process each SQS message
    // Handle failures and retries
  }
}
```

## Key Functions by File

### `health.ts`
**Function**: `health()`
- **Purpose**: Health check endpoint for monitoring
- **Returns**: Service status and timestamp
- **Use Case**: Load balancer health checks, monitoring

### `fileStatus.ts`
**Function**: `fileStatus(event)`
- **Input**: `{ fileId }` in path parameters
- **Purpose**: Get processing status of a specific file
- **Business Logic**: Query DynamoDB for file metadata and processing status
- **Returns**: File processing status and metadata

### `filesList.ts`
**Function**: `filesList(event)`
- **Input**: Query parameters for pagination
- **Purpose**: List all files for authenticated user
- **Business Logic**: DynamoDB scan with user filtering
- **Returns**: Array of user's files with metadata

### `presignedUrl.ts`
**Function**: `presignedUrl(event)`
- **Input**: `{ fileName, fileSize, contentType }` in request body
- **Purpose**: Generate secure S3 upload URL
- **Business Logic**: 
  1. Validate file parameters
  2. Create file record in DynamoDB
  3. Generate presigned S3 URL
- **Returns**: Presigned URL and file metadata

### `processFile.ts`
**Function**: `processFile(event)`
- **Input**: S3 event or direct invocation with file details
- **Purpose**: Main file processing orchestrator
- **Business Logic**:
  1. Download file from S3
  2. Extract text content
  3. Create semantic chunks
  4. Generate embeddings
  5. Store in Pinecone vector database
  6. Update processing status
- **Error Handling**: Comprehensive error tracking and status updates

### `queue.ts`
**Function**: `queue(event)`
- **Input**: SQS messages with file processing requests
- **Purpose**: Handle async file processing queue
- **Business Logic**: Process queued files by invoking processFile handler
- **Retry Logic**: Dead letter queue for failed processing

### `deleteQuiz.ts`
**Function**: `deleteQuiz(event)`
- **Input**: `{ quizId }` in path parameters
- **Purpose**: Delete quiz and clean up associated data
- **Business Logic**: Remove quiz from DynamoDB and associated metadata
- **Returns**: Deletion confirmation

### `generateQuiz.ts`
**Function**: `generateQuiz(event)`
- **Input**: `{ fileIds, questionCount, difficulty }` in request body
- **Purpose**: Initiate quiz generation process
- **Business Logic**:
  - **Local Mode**: Generate quiz synchronously for development
  - **Production Mode**: Spawn multiple worker functions for parallel processing
  - Track progress in completion tracker
- **Returns**: Quiz ID and generation status

### `quizStatus.ts`
**Function**: `quizStatus(event)`
- **Input**: `{ quizId }` in path parameters
- **Purpose**: Check quiz generation progress
- **Business Logic**: Query completion tracker for progress updates
- **Returns**: Progress percentage and completion status

### `quizWorker.ts`
**Function**: `quizWorker(event)`
- **Input**: Worker assignment with question range and context
- **Purpose**: Generate individual quiz questions in parallel
- **Business Logic**:
  1. Receive question assignment from main generator
  2. Perform semantic search in Pinecone for relevant content
  3. Generate questions using GPT-4 with context
  4. Update completion tracker with generated questions
- **Coordination**: Updates shared completion tracker for progress monitoring

## Error Handling Patterns

### 1. Input Validation
```typescript
if (!fileId) {
  return {
    statusCode: 400,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'File ID is required' })
  }
}
```

### 2. Database Error Handling
```typescript
try {
  const result = await dynamodb.get(params).promise()
} catch (error) {
  console.error('Database error:', error)
  return {
    statusCode: 500,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Database operation failed' })
  }
}
```

### 3. External Service Error Handling
```typescript
try {
  const response = await openai.createEmbedding(params)
} catch (error) {
  if (error.response?.status === 429) {
    // Rate limiting - retry with backoff
  }
  throw error
}
```

## CORS Configuration
All HTTP handlers include CORS headers for cross-origin requests:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
}
```

## Authentication Integration
Handlers integrate with Clerk authentication for user identification:
```typescript
const userId = event.requestContext?.authorizer?.userId
if (!userId) {
  return {
    statusCode: 401,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Unauthorized' })
  }
}
```

## Monitoring and Logging
All handlers include comprehensive logging for debugging and monitoring:
```typescript
console.log(`Processing request: ${event.httpMethod} ${event.path}`)
console.error('Error processing request:', error)
```

## Performance Considerations
- **Timeouts**: Configured per handler based on expected execution time
- **Memory**: Allocated based on processing requirements
- **Concurrency**: Limited to prevent overwhelming downstream services
- **Cold Starts**: Minimized through proper initialization patterns