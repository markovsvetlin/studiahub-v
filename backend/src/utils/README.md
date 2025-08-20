# Utils - Database Operations & Shared Utilities

**Shared utilities** and database operations that support all backend functionality. These provide consistent patterns for database access, HTTP responses, and common operations.

## Utility Structure

```
utils/
├── files/              # File-specific database operations
│   ├── database.ts     # DynamoDB CRUD operations for files
│   └── queue.ts        # SQS message handling
├── constants.ts        # Shared configuration and constants
└── http.ts            # HTTP response utilities
```

## Utility Details

### 🗄️ files/database.ts
**Purpose:** DynamoDB operations for file management  
**Pattern:** Abstraction layer over DynamoDB Document Client

#### File Record Interface
```typescript
interface FileRecord {
  id: string              // UUID primary key
  key: string            // S3 object key (GSI)
  status: 'uploading' | 'queued' | 'processing' | 'ready' | 'error'
  progress: number       // Processing progress (0-100)
  totalChunks: number    // Number of generated chunks
  createdAt: string      // ISO timestamp
  updatedAt?: string     // ISO timestamp
  isEnabled?: boolean    // Context pool toggle
}
```

#### Core Functions

**`createFileRecord()`** - Create new file entry
```typescript
export async function createFileRecord(key: string, status: FileRecord['status'] = 'uploading'): Promise<FileRecord>
```
- Generates UUID for new file
- Sets default values (enabled: true, progress: 0)
- Creates DynamoDB record atomically

**`updateFileProgress()`** - Update processing status
```typescript
export async function updateFileProgress(key: string, progress: number, status?: FileRecord['status']): Promise<void>
```
- Finds file by S3 key using GSI
- Updates progress and status atomically
- Handles missing files gracefully

**`updateFileById()`** - Direct update by ID
```typescript
export async function updateFileById(fileId: string, data: Partial<FileRecord>): Promise<void>
```
- Updates multiple fields atomically
- Sets updatedAt timestamp automatically
- Used for bulk updates

**`findFileByKey()`** - Lookup by S3 key
```typescript
export async function findFileByKey(key: string): Promise<FileRecord | null>
```
- Uses GSI for efficient key-based queries
- Returns null if not found
- Critical for upload confirmation flow

### 📨 files/queue.ts
**Purpose:** SQS message operations for async processing  
**Pattern:** Environment-aware queue handling

```typescript
export async function triggerFileProcessing(key: string): Promise<void>
```

**Logic:**
- **Local Development:** Direct function call for immediate processing
- **Production:** SQS message for scalable async processing
- **Message Format:** `{bucket: S3_BUCKET, key: fileKey}`

**Error Handling:**
- Logs warnings if queue URL not configured
- Graceful degradation in local development
- Non-blocking failures (processing continues)

### 🔧 constants.ts  
**Purpose:** Shared configuration and validation rules  

#### File Upload Constants
```typescript
export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/msword',
  'image/png',
  'image/jpeg', 
  'image/webp',
  'image/gif'
]);
```

#### Environment Configuration
```typescript
export const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
export const S3_BUCKET = process.env.S3_BUCKET || '';
export const FILES_TABLE = process.env.FILES_TABLE!;
export const ITEMS_TABLE = process.env.ITEMS_TABLE!;
export const PROCESSING_QUEUE_URL = process.env.PROCESSING_QUEUE_URL;
```

**Usage Pattern:**
- Import once, use everywhere
- Environment variable defaults
- Type-safe access to configuration

### 🌐 http.ts
**Purpose:** Standardized HTTP response utilities  
**Pattern:** Consistent API responses across all handlers

#### Success Response
```typescript
export function createSuccessResponse(data: any, statusCode: number = 200): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ok: true, ...data })
  };
}
```

#### Error Response
```typescript
export function createErrorResponse(statusCode: number, error: string): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ok: false, error })
  };
}
```

**Response Format:**
- **Success:** `{ok: true, ...data}`
- **Error:** `{ok: false, error: "message"}`
- **Headers:** Always includes JSON content-type
- **CORS:** Handled at API Gateway level

## Database Connection (../db.ts)

**Purpose:** Global DynamoDB client with local development support

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

let dynamoClient: DynamoDBDocumentClient;

// Global singleton pattern
if (!global.__dynamoClient) {
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
    // Local development configuration
    ...(process.env.IS_OFFLINE && {
      endpoint: 'http://localhost:8000',
      credentials: {
        accessKeyId: 'fake',
        secretAccessKey: 'fake'
      }
    })
  });
  
  global.__dynamoClient = DynamoDBDocumentClient.from(client);
}

export { dynamoClient as db };
```

**Features:**
- **Singleton:** One client instance across all Lambda invocations
- **Local Development:** Automatically connects to local DynamoDB
- **Production:** Uses IAM roles and AWS credentials
- **Type Safety:** Full TypeScript support with Document Client

## Usage Patterns

### Error Handling Pattern
```typescript
try {
  const file = await createFileRecord(key, 'uploading');
  return createSuccessResponse({ fileId: file.id });
} catch (error) {
  console.error('Failed to create file:', error);
  return createErrorResponse(500, (error as Error).message);
}
```

### Database Operation Pattern
```typescript
// Always use utility functions, not direct DynamoDB calls
const file = await findFileByKey(s3Key);
if (!file) {
  return createErrorResponse(404, 'File not found');
}

await updateFileById(file.id, { status: 'processing', progress: 50 });
```

### Environment Configuration Pattern
```typescript
import { S3_BUCKET, FILES_TABLE, ALLOWED_CONTENT_TYPES } from '../constants';

// Validate against allowed types
if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
  return createErrorResponse(400, 'Unsupported file type');
}
```

## Database Schema & Indexes

### Files Table Structure
- **Primary Key:** `id` (String Hash)
- **Global Secondary Index:** `key-index` on `key` field
- **Billing Mode:** Pay-per-request (auto-scaling)
- **Attributes:** All file metadata and processing state

### Access Patterns
1. **Create File:** Direct write with generated UUID
2. **Find by Key:** Query GSI for S3 key lookups
3. **Update Progress:** Update by ID with atomic operations
4. **List Files:** Scan with filter for ready files
5. **Delete File:** Delete by ID after cleanup operations

## Local Development

### DynamoDB Local Setup
```bash
# Start local DynamoDB
docker-compose up -d

# Initialize tables with proper schema
npm run db:init:local

# Access admin UI
npm run db:admin  # http://localhost:8001
```

### Table Initialization Script
Location: `backend/scripts/init-dynamo.js`
- Creates tables with correct schema
- Sets up GSI indexes
- Handles local and remote environments
- Respects serverless naming conventions

## Testing Utilities

### Mock Database Operations
```typescript
// Test pattern for database utilities
const mockFile: FileRecord = {
  id: 'test-id',
  key: 'uploads/test-file.pdf',
  status: 'ready',
  progress: 100,
  totalChunks: 5,
  createdAt: new Date().toISOString(),
  isEnabled: true
};
```

### HTTP Response Testing
```typescript
// Test success response format
const response = createSuccessResponse({ fileId: 'test' });
expect(JSON.parse(response.body)).toEqual({
  ok: true,
  fileId: 'test'
});
```

---

*These utilities provide the foundation for all backend operations with consistent patterns and error handling.*
