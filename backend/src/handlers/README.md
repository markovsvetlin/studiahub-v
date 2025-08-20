# Handlers - Lambda Functions & API Endpoints

**HTTP request handlers** that serve as the entry points for all API operations. Each handler is a Lambda function connected to API Gateway.

## Handler Structure

```
handlers/
├── health.ts           # System health check
└── files/             # File management operations
    ├── filesList.ts   # List, delete, toggle files
    ├── presignedUrl.ts # S3 upload URL generation
    ├── fileStatus.ts  # Get file processing status
    ├── processFile.ts # File processing orchestrator  
    └── queue.ts       # SQS message processor
```

## Handler Details

### 🏥 health.ts
**Purpose:** System health monitoring  
**Route:** `GET /health`  
**Function:** Simple health check with service metadata

```typescript
export async function handler(_event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2>
```

**Response:**
```json
{
  "ok": true,
  "status": "healthy", 
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "studiahub-backend",
  "version": "1.0.0"
}
```

### 📁 files/filesList.ts
**Purpose:** File management operations  
**Functions:** List files, delete files, toggle enable/disable

#### `list()` - Get all processed files
- **Route:** `GET /files`
- **Logic:** Scans DynamoDB for files with `status = 'ready'`
- **Processing:** Extracts filename from S3 key, estimates file size, determines content type
- **Sorting:** Returns files sorted by creation date (newest first)

#### `deleteFile()` - Remove file completely
- **Route:** `DELETE /files/{id}`
- **Logic:** 3-step deletion process:
  1. Delete from S3 bucket
  2. Delete vectors from Pinecone  
  3. Delete record from DynamoDB
- **Error Handling:** Continues with remaining deletions even if one step fails

#### `toggleFile()` - Enable/disable in context pool
- **Route:** `PATCH /files/{id}/toggle`
- **Payload:** `{"isEnabled": boolean}`
- **Logic:** Updates `isEnabled` field in DynamoDB

### 🔗 files/presignedUrl.ts  
**Purpose:** S3 upload URL management  
**Functions:** Generate presigned URLs, confirm uploads

#### `generatePresignedUrl()` - Get upload URL
- **Route:** `POST /upload/presigned`
- **Validation:** File type, size limits (50MB max)
- **Logic:** 
  1. Validates file metadata
  2. Generates unique S3 key with timestamp
  3. Creates presigned PUT URL (1 hour expiry)
  4. Creates DynamoDB record with `uploading` status

#### `confirmUpload()` - Trigger processing
- **Route:** `POST /upload/confirm`  
- **Payload:** `{"key": "s3-object-key"}`
- **Logic:**
  1. Updates file status to `queued`
  2. Sends message to SQS processing queue

### 📊 files/fileStatus.ts
**Purpose:** Get file processing status  
**Route:** `GET /files/{key+}?status=1`  
**Logic:** Finds file by S3 key and returns current processing status

### ⚙️ files/processFile.ts
**Purpose:** File processing orchestrator  
**Trigger:** Called by `queue.ts` when SQS message received  
**Process:**
1. Text extraction (PDF/DOCX/OCR)
2. Semantic chunking  
3. Embedding generation with dynamic batching
4. Vector storage in Pinecone
5. Progress updates throughout

### 📨 files/queue.ts
**Purpose:** SQS message processor  
**Trigger:** SQS queue receives processing message  
**Logic:** Parses SQS messages and calls `processObject()` from processFile.ts

## Common Patterns

### Error Handling
```typescript
try {
  // Handler logic
  return createSuccessResponse(data);
} catch (error) {
  console.error('Handler failed:', error);
  return createErrorResponse(500, (error as Error).message);
}
```

### Request Validation
```typescript
if (!event.body) {
  return createErrorResponse(400, 'Request body required');
}

const { fileName, contentType } = JSON.parse(event.body);
if (!fileName || !contentType) {
  return createErrorResponse(400, 'fileName and contentType required');
}
```

### Database Operations
- All handlers use utility functions from `../utils/files/database.ts`
- Consistent error handling and logging
- Atomic operations where possible

### Response Format
All handlers return standardized responses:
```typescript
// Success
{ "ok": true, ...data }

// Error  
{ "ok": false, "error": "Error message" }
```

## Serverless Configuration

Each handler is configured in `serverless.yml`:

```yaml
functions:
  health:
    handler: src/handlers/health.handler
    events:
      - httpApi: { path: /health, method: GET }
  
  filesGet:
    handler: src/handlers/files/fileStatus.get
    events:
      - httpApi: { path: /files/{key+}, method: GET }
```

## Lambda Settings

| Setting | Standard Functions | File Processor |
|---------|-------------------|----------------|
| **Memory** | 1024MB | 2048MB |
| **Timeout** | 30 seconds | 900 seconds (15 min) |
| **Runtime** | Node.js 20.x | Node.js 20.x |

## IAM Permissions

Each handler has access to:
- **DynamoDB:** Read/write on Files and Items tables
- **S3:** Read/write/delete on designated bucket  
- **SQS:** Send messages to processing queue
- **Textract:** Document text detection
- **CloudWatch:** Logging (automatic)

## Error Recovery

- **Retry Logic:** SQS handles retries with exponential backoff
- **Dead Letter Queue:** Failed messages moved to DLQ after 3 attempts
- **Partial Failures:** File deletion continues even if some steps fail
- **Status Tracking:** All operations update file status in real-time

---

*Each handler is designed for single responsibility and easy testing.*
