# Backend Architecture Documentation

## Overview
The StudiaHub-v2 backend is a serverless application built on AWS Lambda functions using the Serverless Framework. It provides AI-powered document processing and quiz generation services.

## Core Architecture

### 1. Database Layer (`/src/db.ts`)
**Purpose**: Centralized DynamoDB connection management
**Functions**:
- `getDynamoDBClient()`: Returns singleton DynamoDB client instance
- Handles local vs production environment configurations
- Prevents connection leaks with global singleton pattern

### 2. Handlers Directory (`/src/handlers/`)

#### Health Handler (`/handlers/health.ts`)
**Purpose**: System health monitoring endpoint
**Function**: `health()`
- Returns service status and timestamp
- Used for load balancer health checks

#### Files Handlers (`/handlers/files/`)

**`fileStatus.ts`**
- **Function**: `fileStatus(event)`
- **Purpose**: Get processing status of uploaded files
- **Flow**: Query DynamoDB for file metadata and processing status

**`filesList.ts`** 
- **Function**: `filesList(event)`
- **Purpose**: List all files for a user with pagination
- **Flow**: DynamoDB scan with user filtering

**`presignedUrl.ts`**
- **Function**: `presignedUrl(event)`
- **Purpose**: Generate secure S3 upload URLs
- **Flow**: Creates presigned URL for S3 PUT operation with file metadata

**`processFile.ts`**
- **Function**: `processFile(event)`
- **Purpose**: Main file processing orchestrator
- **Flow**: 
  1. Extract text from uploaded file
  2. Create semantic chunks
  3. Generate embeddings
  4. Store in Pinecone vector database
  5. Update processing status

**`queue.ts`**
- **Function**: `queue(event)`
- **Purpose**: SQS message handler for file processing queue
- **Flow**: Triggers file processing for queued files

#### Quiz Handlers (`/handlers/quiz/`)

**`deleteQuiz.ts`**
- **Function**: `deleteQuiz(event)`
- **Purpose**: Delete quiz and associated data
- **Flow**: Remove quiz from DynamoDB and associated metadata

**`generateQuiz.ts`**
- **Function**: `generateQuiz(event)`
- **Purpose**: Initiate quiz generation process
- **Flow**:
  1. Local mode: Generate quiz synchronously
  2. Production mode: Spawn worker functions
  3. Track progress in database

**`quizStatus.ts`**
- **Function**: `quizStatus(event)`
- **Purpose**: Check quiz generation progress
- **Flow**: Query completion tracker for progress updates

**`quizWorker.ts`**
- **Function**: `quizWorker(event)`
- **Purpose**: Generate individual quiz questions in parallel
- **Flow**:
  1. Receive question assignment
  2. Perform semantic search in Pinecone
  3. Generate question using GPT-4
  4. Update completion tracker

### 3. Services Directory (`/src/services/`)

#### File Processing Services (`/services/files/`)

**`textExtraction.ts`**
- **Functions**:
  - `extractTextFromFile(buffer, filename)`: Route to appropriate extraction method
  - `extractTextFromPDF(buffer)`: Extract text from PDF using pdf-parse
  - `extractTextFromDocx(buffer)`: Extract text from DOCX using mammoth
  - `extractTextFromImage(buffer, filename)`: Use AWS Textract for image OCR

**`chunking.ts`**
- **Functions**:
  - `createChunks(text, maxWordsPerChunk)`: Split text into semantic chunks
  - Smart word boundary preservation
  - Guarantees 99-100% text coverage

**`embeddings.ts`**
- **Functions**:
  - `processEmbeddings(chunks, fileId, userId)`: Generate and store embeddings
  - `createEmbeddingChunks(chunks)`: Batch chunks for API efficiency
  - Uses OpenAI text-embedding-3-large model

**`pinecone.ts`**
- **Functions**:
  - `insertEmbeddings(vectors, userId)`: Store vectors in user namespace
  - `queryEmbeddings(queryText, userId, topK)`: Semantic search
  - `deleteFileEmbeddings(fileId, userId)`: Clean up vectors
  - `checkIndex()`: Verify Pinecone connection

**`pdf.ts` & `docx.ts` & `textract.ts`**
- Specialized file format handlers
- Abstract away format-specific processing details

#### Quiz Services (`/services/quiz/`)

**`chunks.ts`**
- **Functions**:
  - `getRelevantChunks(fileIds, query, userId)`: Perform semantic search
  - Combines results from multiple files
  - Ranks chunks by relevance score

**`gpt.ts`**
- **Functions**:
  - `generateQuestions(chunks, questionCount, difficulty)`: Generate quiz questions
  - `generateSingleQuestion(context, difficulty, existingQuestions)`: Generate individual question
  - Uses GPT-4o-mini with structured prompts

**`prompts.ts`**
- **Constants**: Predefined prompts for different question types and difficulties
- Ensures consistent question generation quality

### 4. Utils Directory (`/src/utils/`)

#### Core Utils
**`constants.ts`**: Application-wide constants and configuration
**`http.ts`**: HTTP response formatting utilities
**`sqs.ts`**: SQS queue management utilities

#### File Utils (`/utils/files/`)
**`database.ts`**: File-related database operations
**`queue.ts`**: File processing queue management

#### Quiz Utils (`/utils/quiz/`)
**`completionTracker.ts`**: 
- **Functions**:
  - `initializeTracker(quizId, totalQuestions)`: Set up progress tracking
  - `updateProgress(quizId, workerId, question)`: Record worker completion
  - `checkCompletion(quizId)`: Verify all workers finished
  - `getProgress(quizId)`: Get current progress status

**`database.ts`**: Quiz-related database operations

## Data Flow Architecture

### File Processing Flow
```
S3 Upload → SQS Queue → processFile Handler → Text Extraction → Chunking → Embeddings → Pinecone Storage
```

### Quiz Generation Flow
```
User Request → generateQuiz → Worker Spawn → Semantic Search → GPT Generation → Progress Tracking → Quiz Assembly
```

## Configuration Files

### `serverless.yml`
- Defines Lambda functions, timeouts, memory allocation
- IAM permissions for AWS services
- Environment variables and resource provisioning
- SQS queues, DynamoDB tables, S3 buckets

### `package.json`
- Dependencies: aws-sdk, openai, pinecone, pdf-parse, mammoth
- Scripts for deployment and development
- TypeScript configuration

## Key Architectural Patterns

1. **Event-Driven Architecture**: SQS queues decouple processing
2. **Worker Pattern**: Parallel quiz generation with progress tracking
3. **Singleton Pattern**: Database connection management
4. **Strategy Pattern**: File type-specific processing
5. **Factory Pattern**: Handler creation and routing

## Performance Characteristics

- **Scalability**: Auto-scaling Lambda functions
- **Resilience**: Dead letter queues and error handling
- **Efficiency**: Parallel processing and batching
- **Cost Optimization**: Pay-per-use serverless model

## Security Features

- IAM role-based access control
- User-scoped data isolation
- Presigned URLs for secure uploads
- Environment variable configuration

## Development & Deployment

- **Local Development**: Serverless offline support
- **Environment Management**: Stage-based configurations  
- **Monitoring**: CloudWatch logs and metrics
- **CI/CD Ready**: Serverless Framework deployment