# Services - File Processing & AI Integration

**Core business logic** for transforming uploaded documents into searchable AI embeddings. This is the heart of the document processing pipeline.

## Service Structure

```
services/
└── files/                    # Document processing services
    ├── textExtraction.ts    # Multi-format text extraction router
    ├── pdf.ts              # PDF text parsing
    ├── docx.ts             # Word document processing  
    ├── textract.ts         # AWS OCR for images
    ├── chunking.ts         # Semantic text chunking
    ├── embeddings.ts       # OpenAI embedding generation
    └── pinecone.ts         # Vector database operations
```

## Processing Pipeline

```
Document Upload → Text Extraction → Chunking → Embeddings → Vector Storage
                                                                   ↓
                                                         Searchable Knowledge Base
```

## Service Details

### 📄 textExtraction.ts
**Purpose:** Route text extraction based on file type  
**Strategy:** Uses different extraction methods for optimal results

```typescript
export async function extractTextFromFile(bucket: string, key: string): Promise<PageContent[]>
```

**Extraction Logic:**
- **PDFs:** `pdf-parse` library (faster, more reliable)
- **DOCX:** `mammoth` library (preserves formatting)  
- **Images:** AWS Textract OCR (handles scanned documents)

**Output:** Array of pages with text content and page numbers

### 📑 pdf.ts
**Purpose:** PDF text extraction using pdf-parse library  
**Advantages:** Fast, reliable, handles text-based PDFs well

```typescript
export async function extractTextFromPdf(params: { s3Bucket: string; s3Key: string }): Promise<PdfPage[]>
```

**Process:**
1. Downloads PDF from S3
2. Extracts all text using pdf-parse
3. Splits by form feed characters (if present)
4. Returns structured pages

### 📝 docx.ts  
**Purpose:** Word document text extraction using mammoth  
**Advantages:** Preserves document structure and formatting

```typescript
export async function extractTextFromDocx(params: { s3Bucket: string; s3Key: string }): Promise<DocxPage[]>
```

**Process:**
1. Downloads DOCX from S3
2. Extracts raw text using mammoth
3. Returns as single page (DOCX doesn't have distinct pages)

### 🔍 textract.ts
**Purpose:** OCR text extraction using AWS Textract  
**Use Case:** Images, scanned PDFs, handwritten content

```typescript
export async function extractTextFromImageOrPdf(params: { s3Bucket: string; s3Key: string }): Promise<TextractPage[]>
```

**Process:**
1. Calls AWS Textract DetectDocumentText API
2. Filters for LINE blocks with actual text
3. Groups lines by page number  
4. Returns structured pages with OCR text

### ✂️ chunking.ts
**Purpose:** Split extracted text into optimal chunks for AI processing  
**Strategy:** Semantic chunking with guaranteed complete coverage

```typescript
export function simpleSemanticChunk(pages: PageContent[]): Chunk[]
```

**Algorithm:**
- **Target Size:** 1600 characters (~400 tokens at 4 chars/token)
- **Coverage:** 99%+ text coverage (no information loss)
- **Boundaries:** Breaks at word/sentence boundaries when possible
- **No Overlap:** Sequential chunking without duplicates

**Quality Metrics:**
- Logs character counts for verification
- Warns if coverage drops below 99%
- Reports min/max/average chunk sizes

### 🧠 embeddings.ts
**Purpose:** Generate AI embeddings using OpenAI API  
**Model:** `text-embedding-3-large` (3072 dimensions)

```typescript
export async function embedOpenAI(texts: string[]): Promise<number[][]>
```

**Features:**
- **Safety:** Truncates text to 6000 chars (safe token limit)
- **Batch Processing:** Handles multiple texts efficiently
- **Error Handling:** Detailed error messages for debugging
- **Logging:** Reports text lengths for optimization

### 🗄️ pinecone.ts
**Purpose:** Vector database operations for semantic search  
**Architecture:** Singleton service with initialization safety

```typescript
class PineconeService {
  async initialize(): Promise<void>
  async upsertChunks(chunks: ChunkVector[]): Promise<void>
  async deleteFileChunks(fileId: string): Promise<void>
}
```

#### Key Features

**Initialization:**
- Checks if index exists with correct dimensions (3072)
- Creates index automatically if missing
- Handles race conditions and concurrent initialization

**Dynamic Scaling:**
Vector upserts scale based on document size:
```typescript
const batchSize = Math.min(baseBatchSize + extraWorkers, 8);
const concurrency = Math.min(baseConcurrency + extraWorkers, 20);
```

**Data Format:**
```typescript
interface ChunkVector {
  id: string              // Format: chunk_{fileId}_{index}
  values: number[]        // 3072-dimensional embedding
  metadata: {
    fileId: string        // Reference to DynamoDB
    chunkIndex: number    // Sequence number
    text?: string         // First 40K chars for debugging
  }
}
```

**Deletion Strategy:**
- Deletes by ID pattern (more reliable than filters)
- Handles up to 1000 chunks per file
- Batch deletion to avoid API limits

## Processing Orchestration

### File Processing Flow (processFile.ts)
```typescript
export async function processObject(bucket: string, key: string): Promise<void>
```

**Steps:**
1. **Text Extraction** (10% → 40%)
2. **Chunking Analysis** (40% → 60%)  
3. **Embedding Generation** (60% → 100%)
4. **Vector Storage & Completion**

**Dynamic Scaling Algorithm:**
```typescript
// Base configuration
const baseBatchSize = 3;
const baseConcurrency = 4;

// Scale based on document size
const extraWorkers = Math.floor(totalChunks / 20);
const batchSize = Math.min(baseBatchSize + extraWorkers, 8);
const concurrency = Math.min(baseConcurrency + extraWorkers, 20);
```

**Example Scaling:**
- Small doc (20 chunks): 3 batch size, 4 concurrency
- Medium doc (60 chunks): 6 batch size, 7 concurrency  
- Large doc (200 chunks): 8 batch size, 14 concurrency

## Error Handling & Recovery

### Retry Mechanisms
- **SQS:** Automatic retry with exponential backoff
- **Pinecone:** 30-second timeouts with error recovery
- **OpenAI:** Rate limit handling and batch retry

### Progress Tracking
Real-time updates to DynamoDB:
- 10%: Processing started
- 40%: Text extraction complete
- 60%: Chunking complete  
- 60-99%: Embedding progress
- 100%: Ready for use

### Coverage Validation
```typescript
const coverage = totalChunkChars / totalOriginalChars * 100;
console.log(`Coverage: ${coverage.toFixed(1)}% (should be ~99-100%)`);

if (coverage < 99) {
  console.warn(`⚠️  Low coverage detected: ${coverage.toFixed(1)}%`);
}
```

## Configuration & Environment

### Required Environment Variables
- `OPENAI_API_KEY`: OpenAI embeddings API key
- `PINECONE_API_KEY`: Pinecone database API key  
- `PINECONE_ENVIRONMENT`: Pinecone environment (us-east-1-aws)

### Pinecone Configuration
- **Index Name:** `studiahub-chunks`
- **Dimensions:** 3072 (OpenAI text-embedding-3-large)
- **Metric:** Cosine similarity
- **Cloud:** AWS us-east-1

### Performance Tuning
- **Memory:** 2048MB for large document processing
- **Timeout:** 15 minutes maximum processing time
- **Concurrency:** Dynamic scaling based on document size
- **Batch Size:** Optimized for both speed and cost

## Quality Metrics & Monitoring

### Text Extraction Quality
- Character count verification
- Page count validation
- Format-specific handling

### Chunking Quality  
- Coverage percentage (target: 99%+)
- Chunk size distribution
- Boundary quality (word vs character breaks)

### Embedding Quality
- Batch processing efficiency
- API rate limit compliance
- Vector dimension validation

### Vector Storage Quality
- Upsert success rates
- Index health monitoring
- Deletion completeness verification

---

*These services form the intelligent core of the document processing system.*
