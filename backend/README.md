# Backend - Serverless API & File Processing

**Serverless backend** built with AWS Lambda, handling file uploads, processing, and AI integration.

## Architecture Overview

```
API Gateway → Lambda Handlers → Processing Services → External APIs
                ↓                        ↓
          DynamoDB Storage    S3 + SQS + OpenAI + Pinecone
```

## Key Components

| Folder | Purpose | Main Files |
|--------|---------|------------|
| `src/handlers/` | **API endpoints** - Lambda functions that handle HTTP requests | [`README.md`](src/handlers/README.md) |
| `src/services/` | **Business logic** - file processing, AI integration, text extraction | [`README.md`](src/services/README.md) |
| `src/utils/` | **Shared utilities** - database operations, HTTP responses, constants | [`README.md`](src/utils/README.md) |
| `src/db.ts` | **Database client** - DynamoDB connection with local development support | - |
| `serverless.yml` | **Infrastructure** - AWS resources, Lambda configs, environment variables | - |

## Tech Stack

- **Runtime:** Node.js 20.x with TypeScript 5.6.3
- **Framework:** Serverless Framework 3.39.0
- **Database:** DynamoDB with pay-per-request billing
- **Storage:** S3 for file uploads
- **Queue:** SQS for async processing with dead letter queue
- **Build:** ESBuild for fast compilation and bundling

## API Endpoints

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| `GET` | `/health` | `health.handler` | System health check |
| `GET` | `/files` | `filesList.list` | List processed files |
| `GET` | `/files/{key+}` | `fileStatus.get` | Get file processing status |
| `DELETE` | `/files/{id}` | `filesList.deleteFile` | Delete file from all systems |
| `PATCH` | `/files/{id}/toggle` | `filesList.toggleFile` | Enable/disable in context pool |
| `POST` | `/upload/presigned` | `presignedUrl.generatePresignedUrl` | Get S3 upload URL |
| `POST` | `/upload/confirm` | `presignedUrl.confirmUpload` | Trigger processing after upload |

## Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `AWS_REGION` | AWS region | `us-east-1` |
| `S3_BUCKET` | File storage bucket | `studiahub-dev-assets` |
| `OPENAI_API_KEY` | OpenAI embeddings | `sk-proj-...` |
| `PINECONE_API_KEY` | Vector database | `your-key` |
| `FILES_TABLE` | DynamoDB table name | `studiahub-backend-dev-files` |
| `PROCESSING_QUEUE_URL` | SQS queue URL | Auto-generated |

## Development Commands

```bash
# Local development
npm run dev                # Start serverless offline (port 4000)
npm run db:init:local     # Initialize DynamoDB tables
npm run db:admin          # Start DynamoDB admin UI (port 8001)

# Deployment
npm run deploy:dev        # Deploy to AWS dev environment
npm run deploy:prod       # Deploy to AWS production
npm run remove            # Remove AWS stack

# Utilities
npm run print:dev         # Print serverless configuration
npm run kill:offline      # Kill background processes
```

## File Processing Flow

1. **Upload Request** → Generate presigned S3 URL
2. **Client Upload** → Direct upload to S3
3. **Confirm Upload** → Add to SQS processing queue
4. **Background Processing** → Extract text → Chunk → Generate embeddings → Store in Pinecone
5. **Status Updates** → Real-time progress tracking in DynamoDB

## Database Schema

### Files Table
```typescript
interface FileRecord {
  id: string              // UUID primary key
  key: string            // S3 object key (GSI)
  status: 'uploading' | 'queued' | 'processing' | 'ready' | 'error'
  progress: number       // 0-100
  totalChunks: number    // Generated chunks count
  createdAt: string      // ISO timestamp
  updatedAt?: string     // ISO timestamp
  isEnabled: boolean     // Context pool toggle
}
```

## Key Patterns

- **Error Handling:** All handlers use try/catch with structured error responses
- **Database Operations:** Utility functions abstract DynamoDB complexity
- **Async Processing:** SQS ensures reliable background processing
- **Type Safety:** Full TypeScript coverage with strict typing
- **Resource Cleanup:** File deletion removes from S3, DynamoDB, and Pinecone

## Local Development

1. **Start Infrastructure:** `docker-compose up -d`
2. **Initialize Tables:** `npm run db:init:local`  
3. **Start Backend:** `npm run dev`
4. **Access Points:**
   - API: http://localhost:4000
   - DB Admin: http://localhost:8001
   - Health: http://localhost:4000/health

## Production Deployment

```bash
npm run deploy:prod
```

Creates:
- 6 Lambda functions with API Gateway
- DynamoDB tables with Global Secondary Index
- S3 bucket with CORS configuration
- SQS queue with dead letter queue
- IAM roles with least-privilege permissions

---

*See individual component READMEs for detailed implementation details.*
