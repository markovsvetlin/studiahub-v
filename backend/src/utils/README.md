# Utils Directory Documentation

## Overview
The utils directory contains shared utility functions, constants, and helper modules used across the StudiaHub-v2 backend. These utilities provide common functionality for HTTP responses, database operations, queue management, and application constants.

## Directory Structure

```
utils/
├── constants.ts              # Application-wide constants and configuration
├── http.ts                  # HTTP response formatting utilities
├── sqs.ts                   # SQS queue management utilities
├── files/                   # File-related utilities
│   ├── database.ts          # File database operations
│   └── queue.ts             # File processing queue management
└── quiz/                    # Quiz-related utilities
    ├── completionTracker.ts # Quiz generation progress tracking
    └── database.ts          # Quiz database operations
```

## Core Utils

### `constants.ts`
**Purpose**: Centralized application constants and configuration values
**Contents**:
- **File Processing Constants**: 
  - Max file size limits
  - Supported file types
  - Chunk size configurations
- **API Configuration**:
  - Timeout values
  - Retry attempts
  - Rate limiting parameters
- **Database Table Names**: 
  - DynamoDB table references
  - Index names
- **Queue Names**: 
  - SQS queue identifiers
  - Dead letter queue names
- **Processing Constants**:
  - Worker distribution parameters
  - Progress tracking intervals

### `http.ts` 
**Purpose**: Standardized HTTP response formatting for API Gateway
**Key Functions**:

#### `successResponse(data: any, statusCode: number = 200): APIGatewayProxyResult`
- **Purpose**: Format successful API responses
- **Features**:
  - Consistent JSON response structure
  - CORS headers included
  - Optional status code override
- **Usage**: All successful API endpoints

#### `errorResponse(message: string, statusCode: number = 500): APIGatewayProxyResult`
- **Purpose**: Format error responses with consistent structure
- **Features**:
  - Standardized error message format
  - Appropriate HTTP status codes
  - CORS headers for error responses
- **Usage**: Error handling across all handlers

#### `corsHeaders`
- **Purpose**: Standard CORS headers for cross-origin requests
- **Configuration**:
  - Allow-Origin: Configurable based on environment
  - Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
  - Allow-Headers: Content-Type, Authorization
- **Usage**: Applied to all HTTP responses

### `sqs.ts`
**Purpose**: SQS queue operations and message management
**Key Functions**:

#### `sendMessage(queueUrl: string, messageBody: any): Promise<void>`
- **Purpose**: Send messages to SQS queues
- **Features**:
  - JSON serialization
  - Error handling and retries
  - Message attribute support
- **Usage**: Async processing triggers

#### `deleteMessage(queueUrl: string, receiptHandle: string): Promise<void>`
- **Purpose**: Remove processed messages from queue
- **Features**: Prevents message reprocessing
- **Usage**: Handler completion cleanup

#### `getQueueAttributes(queueUrl: string): Promise<any>`
- **Purpose**: Monitor queue metrics
- **Returns**: Queue depth, message counts, visibility timeout
- **Usage**: Queue health monitoring

## File Utils (`/files/`)

### `database.ts`
**Purpose**: File-related database operations and queries
**Key Functions**:

#### `createFileRecord(fileData: FileRecord): Promise<void>`
- **Purpose**: Create new file entry in DynamoDB
- **Features**:
  - UUID generation for file IDs
  - Timestamp management
  - User association
- **Usage**: File upload initialization

#### `updateFileStatus(fileId: string, status: FileStatus, progress?: number): Promise<void>`
- **Purpose**: Update file processing status
- **Features**:
  - Atomic updates
  - Progress percentage tracking
  - Error status handling
- **Usage**: Processing pipeline status updates

#### `getFilesByUser(userId: string): Promise<FileRecord[]>`
- **Purpose**: Retrieve user's files with pagination
- **Features**:
  - User-scoped queries
  - Pagination support
  - Status filtering options
- **Usage**: File listing endpoints

#### `deleteFileRecord(fileId: string, userId: string): Promise<void>`
- **Purpose**: Remove file record and cleanup
- **Features**:
  - User authorization validation
  - Cascade deletion of related data
  - Error handling for missing records
- **Usage**: File deletion operations

#### `toggleFileEnabled(fileId: string, userId: string, enabled: boolean): Promise<void>`
- **Purpose**: Enable/disable files for quiz generation
- **Features**:
  - User authorization
  - Optimistic updates
  - Status validation
- **Usage**: Quiz file selection management

### `queue.ts`
**Purpose**: File processing queue management
**Key Functions**:

#### `queueFileProcessing(fileId: string, s3Location: S3Location): Promise<void>`
- **Purpose**: Queue files for async processing
- **Features**:
  - Message deduplication
  - Delay options for batching
  - Error handling and DLQ routing
- **Usage**: Post-upload processing triggers

#### `getQueueStatus(): Promise<QueueStatus>`
- **Purpose**: Monitor file processing queue
- **Returns**: Pending messages, processing rate, errors
- **Usage**: System monitoring and scaling decisions

## Quiz Utils (`/quiz/`)

### `completionTracker.ts`
**Purpose**: Track progress of parallel quiz generation workers
**Key Functions**:

#### `initializeTracker(quizId: string, totalQuestions: number): Promise<void>`
- **Purpose**: Set up progress tracking for new quiz
- **Process**:
  1. Create tracker record in DynamoDB
  2. Initialize progress counters
  3. Set up worker coordination metadata
- **Features**: Atomic initialization, conflict prevention

#### `updateProgress(quizId: string, workerId: string, question: QuizQuestion): Promise<void>`
- **Purpose**: Record individual worker completion
- **Process**:
  1. Validate worker assignment
  2. Store generated question
  3. Update completion counter
  4. Check for overall completion
- **Features**: Race condition prevention, duplicate detection

#### `checkCompletion(quizId: string): Promise<boolean>`
- **Purpose**: Verify all workers have completed
- **Logic**:
  1. Query completion tracker
  2. Validate question count matches target
  3. Verify all questions are valid
- **Returns**: Boolean indicating completion status

#### `getProgress(quizId: string): Promise<ProgressStatus>`
- **Purpose**: Get current generation progress
- **Returns**:
  - Completion percentage
  - Worker status
  - Generated question count
  - Error information
- **Usage**: Progress polling endpoints

#### `assembleQuiz(quizId: string): Promise<Quiz>`
- **Purpose**: Combine worker results into final quiz
- **Process**:
  1. Retrieve all completed questions
  2. Validate question format and content
  3. Create final quiz structure
  4. Clean up tracker resources
- **Features**: Question validation, error recovery

#### `cleanupTracker(quizId: string): Promise<void>`
- **Purpose**: Remove tracking data after completion
- **Features**: Resource cleanup, error handling
- **Usage**: Post-generation cleanup

### `database.ts`
**Purpose**: Quiz-related database operations
**Key Functions**:

#### `createQuizRecord(quizData: QuizRecord): Promise<string>`
- **Purpose**: Create new quiz entry
- **Features**:
  - UUID generation
  - User association
  - Metadata storage
- **Returns**: Generated quiz ID

#### `getQuizzesByUser(userId: string): Promise<QuizRecord[]>`
- **Purpose**: Retrieve user's quizzes
- **Features**:
  - User-scoped queries
  - Sorting by creation date
  - Status filtering
- **Usage**: Quiz listing endpoints

#### `deleteQuizRecord(quizId: string, userId: string): Promise<void>`
- **Purpose**: Remove quiz and associated data
- **Features**:
  - User authorization validation
  - Cascade deletion
  - Completion tracker cleanup
- **Usage**: Quiz deletion operations

#### `updateQuizStatus(quizId: string, status: QuizStatus): Promise<void>`
- **Purpose**: Update quiz generation status
- **Features**: Atomic status updates, progress tracking
- **Usage**: Generation pipeline status management

## Utility Patterns

### 1. Error Handling Pattern
```typescript
export async function utilityFunction(params: any): Promise<Result> {
  try {
    // Validate input parameters
    if (!params.required) {
      throw new ValidationError('Required parameter missing')
    }
    
    // Perform operation
    const result = await performOperation(params)
    return result
  } catch (error) {
    console.error(`Error in ${utilityFunction.name}:`, error)
    throw new UtilityError(`Operation failed: ${error.message}`)
  }
}
```

### 2. Database Operation Pattern
```typescript
async function databaseOperation(params: DbParams): Promise<Result> {
  const dynamodb = getDynamoDBClient()
  
  const dbParams = {
    TableName: TABLE_NAME,
    Key: { id: params.id },
    // Additional parameters
  }
  
  try {
    const result = await dynamodb.get(dbParams).promise()
    return result.Item
  } catch (error) {
    console.error('Database operation failed:', error)
    throw new DatabaseError(`Failed to ${operation}: ${error.message}`)
  }
}
```

### 3. Queue Management Pattern
```typescript
async function queueOperation(params: QueueParams): Promise<void> {
  const sqs = getSQSClient()
  
  const messageParams = {
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify(params.message),
    // Additional attributes
  }
  
  try {
    await sqs.sendMessage(messageParams).promise()
    console.log('Message queued successfully')
  } catch (error) {
    console.error('Queue operation failed:', error)
    throw new QueueError(`Failed to queue message: ${error.message}`)
  }
}
```

## Configuration Management

### Environment Variables
- Database table names and indexes
- Queue URLs and configurations
- API endpoints and timeouts
- Feature flags and limits

### Constants Organization
```typescript
export const FILE_CONSTANTS = {
  MAX_SIZE: 50 * 1024 * 1024, // 50MB
  SUPPORTED_TYPES: ['pdf', 'docx', 'png', 'jpg', 'jpeg'],
  CHUNK_SIZE: 200 // words
}

export const QUIZ_CONSTANTS = {
  MIN_QUESTIONS: 1,
  MAX_QUESTIONS: 50,
  DEFAULT_DIFFICULTY: 'medium',
  WORKER_TIMEOUT: 300000 // 5 minutes
}
```

## Performance Considerations

### 1. Database Optimizations
- Batch operations where possible
- Efficient query patterns
- Index usage optimization
- Connection pooling (singleton pattern)

### 2. Queue Optimizations
- Message batching
- Visibility timeout tuning
- Dead letter queue configuration
- Retry policy optimization

### 3. Memory Management
- Efficient object creation and disposal
- Stream processing for large data
- Buffer management
- Garbage collection considerations

## Testing and Debugging

### 1. Logging Standards
- Consistent log levels (error, warn, info, debug)
- Structured logging with context
- Performance timing logs
- Error stack trace preservation

### 2. Validation Helpers
- Input parameter validation
- Type checking utilities
- Data format validation
- Business rule enforcement

### 3. Monitoring Integration
- CloudWatch metrics
- Error tracking
- Performance monitoring
- Health check utilities

This utilities architecture provides a solid foundation for shared functionality across the StudiaHub-v2 backend, ensuring consistency, reliability, and maintainability in common operations.