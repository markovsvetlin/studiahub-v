# Quiz Generation Implementation Plan

## Overview
Implementing an AI-powered quiz generation system that creates high-quality study questions from uploaded materials using GPT-4o and semantic search with Pinecone.

## Architecture

### Data Flow
```
User Request → API Handler → Queue Quiz Generation → Spawn Workers (SQS) 
                                                       ↓
Quiz Ready ← Save to DB ← Combine Results ← Workers Generate Questions (Parallel)
```

## Database Design

### Quiz Table Structure
```typescript
{
  id: string            // UUID for quiz
  userId: string        // For future user management (GSI)
  mode: 'specific' | 'general'
  query?: string        // Search query for specific mode
  questions: Question[] // Array of generated questions
  questionCount: number // Requested number of questions
  status: 'generating' | 'ready' | 'error'
  progress: number      // 0-100 percentage
  chunksUsed: string[]  // IDs of chunks used for generation
  createdAt: string     // ISO timestamp
  updatedAt: string     // ISO timestamp
  error?: string        // Error message if failed
}

interface Question {
  questionText: string
  options: string[]        // Array of 4 options
  correctAnswer: number    // Index of correct option (0-3)
  explanation: string      // Why this answer is correct
  difficulty: 'easy' | 'medium' | 'hard'
}
```

## Implementation Structure

### 1. Lambda Handlers (`/src/handlers/quiz/`)

#### `generate.ts` - Initiate Quiz Generation
- **Route**: `POST /quiz/generate`
- **Payload**:
  ```json
  {
    "mode": "specific" | "general",
    "query": "optional search query for specific mode",
    "questionCount": 10
  }
  ```
- **Process**:
  1. Validate request (1-50 questions limit)
  2. Create quiz record with status='generating'
  3. Queue main generation job to SQS
  4. Return quiz ID immediately

#### `status.ts` - Check Quiz Status
- **Route**: `GET /quiz/{id}`
- **Returns**: Quiz data with current status and progress

#### `worker.ts` - SQS Worker for Question Generation
- **Trigger**: SQS message
- **Process**:
  1. Orchestrate chunk retrieval
  2. Distribute work to sub-workers
  3. Monitor worker completion
  4. Combine results and save

#### `subWorker.ts` - Individual Question Generator
- **Trigger**: SQS message from main worker
- **Process**:
  1. Receive assigned chunks
  2. Call GPT-4o with prompt
  3. Validate response format
  4. Return questions to main worker queue

### 2. Services (`/src/services/quiz/`)

#### `generator.ts` - Core Generation Logic
```typescript
export class QuizGenerator {
  async generateQuiz(params: QuizParams): Promise<void>
  private async retrieveChunks(mode: string, query?: string): Promise<Chunk[]>
  private async distributeWork(chunks: Chunk[], questionCount: number): Promise<WorkerTask[]>
  private async spawnWorkers(tasks: WorkerTask[]): Promise<void>
}
```

#### `chunksRetrieval.ts` - Pinecone Integration
```typescript
export class ChunksRetriever {
  async getSpecificChunks(query: string, limit: number): Promise<Chunk[]>
  async getGeneralChunks(limit: number): Promise<Chunk[]>
  private async getEnabledFileIds(): Promise<string[]>
  private shuffleChunks(chunks: Chunk[]): Chunk[]
}
```
- **Specific Mode**: Semantic search with query → top 15 chunks → shuffle
- **General Mode**: Random sample from all enabled files → 20 chunks → shuffle

#### `prompt.ts` - GPT-4o Prompt Templates
```typescript
export class PromptBuilder {
  buildQuestionPrompt(chunks: string[], count: number): string
  parseGPTResponse(response: string): Question[]
}
```

**Prompt Template**:
```
You are an expert educator creating study questions. Generate {count} high-quality multiple-choice questions based on the following content.

CONTENT:
{chunks}

REQUIREMENTS:
1. Each question must have exactly 4 options
2. Only one option should be correct
3. Questions should test understanding, not memorization
4. Vary difficulty levels
5. Include clear explanations

Return in JSON format:
{
  "questions": [
    {
      "questionText": "...",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "...",
      "difficulty": "medium"
    }
  ]
}
```

### 3. Utilities (`/src/utils/quiz/`)

#### `database.ts` - Quiz Table Operations
```typescript
export async function createQuiz(data: QuizData): Promise<Quiz>
export async function updateQuizProgress(id: string, progress: number): Promise<void>
export async function saveQuizQuestions(id: string, questions: Question[]): Promise<void>
export async function getQuizById(id: string): Promise<Quiz>
```

#### `workers.ts` - Worker Management
```typescript
export function calculateWorkerDistribution(questionCount: number): WorkerConfig
export async function sendToWorkerQueue(task: WorkerTask): Promise<void>
export async function waitForWorkers(workerIds: string[]): Promise<Question[]>
```

## Worker Distribution Strategy

```typescript
function getWorkerCount(questionCount: number): number {
  if (questionCount <= 3) return 1;
  if (questionCount <= 9) return 3;
  if (questionCount <= 15) return 5;
  if (questionCount <= 30) return 10;
  return Math.min(Math.ceil(questionCount / 3), 20); // Max 20 workers
}
```

Each worker generates 2-3 questions from 2-3 chunks.

## Progress Tracking

```
10% - Quiz initialized
20% - Retrieving relevant chunks
30% - Chunks retrieved, spawning workers
30-90% - Workers generating questions (linear progress)
95% - Combining results
100% - Quiz ready
```

## Error Handling

1. **Worker Failures**:
   - Retry failed workers up to 2 times
   - If still failing, return partial results if >50% complete
   - Mark quiz as 'error' if <50% complete

2. **GPT-4o Errors**:
   - Rate limiting: Exponential backoff
   - Invalid format: Retry with clearer prompt
   - Token limit: Reduce chunk size and retry

3. **Validation**:
   - Ensure no duplicate questions
   - Verify all questions have 4 distinct options
   - Check correctAnswer index is valid (0-3)

## SQS Queue Configuration

### Main Quiz Queue
- **Name**: `studiahub-{stage}-quiz-generation`
- **Visibility Timeout**: 300 seconds
- **Message Retention**: 1 day

### Worker Queue
- **Name**: `studiahub-{stage}-quiz-workers`
- **Visibility Timeout**: 120 seconds
- **Max Receives**: 3
- **DLQ**: After 3 attempts

## API Endpoints Summary

| Method | Path | Description |
|--------|------|-------------|
| POST | `/quiz/generate` | Start quiz generation |
| GET | `/quiz/{id}` | Get quiz status/data |

## Environment Variables

```yaml
OPENAI_API_KEY: ${env:OPENAI_API_KEY}          # Existing
PINECONE_API_KEY: ${env:PINECONE_API_KEY}      # Existing
QUIZ_TABLE: ${self:service}-${self:provider.stage}-quiz
QUIZ_QUEUE_URL: { Ref: QuizQueue }
WORKER_QUEUE_URL: { Ref: WorkerQueue }
```

## Local Development Mode

### Handling Local Testing Without SQS

For local development with `serverless-offline`, the system will detect `IS_OFFLINE` environment variable and switch to synchronous mode:

```typescript
// In generator.ts
export class QuizGenerator {
  async generateQuiz(params: QuizParams): Promise<void> {
    if (process.env.IS_OFFLINE) {
      // Local mode: Generate all questions synchronously
      await this.generateLocalMode(params);
    } else {
      // Production mode: Use SQS workers
      await this.generateWithWorkers(params);
    }
  }

  private async generateLocalMode(params: QuizParams): Promise<void> {
    // 1. Retrieve chunks (same as production)
    const chunks = await this.retrieveChunks(params.mode, params.query);
    
    // 2. Generate all questions in a single process
    const questions: Question[] = [];
    const tasksCount = this.calculateTaskCount(params.questionCount);
    
    for (let i = 0; i < tasksCount; i++) {
      // Simulate worker progress
      await this.updateProgress(params.quizId, 30 + (60 * i / tasksCount));
      
      // Generate questions directly
      const taskChunks = this.selectChunksForTask(chunks, i);
      const taskQuestions = await this.callGPT(taskChunks, 3);
      questions.push(...taskQuestions);
    }
    
    // 3. Save and complete
    await this.saveQuizQuestions(params.quizId, questions);
  }
}
```

### Local Testing Benefits
- **No SQS Required**: Works with just DynamoDB local
- **Easier Debugging**: Single process, sequential execution
- **Same API**: Frontend doesn't need to know the difference
- **Real GPT Calls**: Still tests actual question generation
- **Progress Updates**: Still updates progress for UI testing

### Environment Detection
```typescript
const isOffline = process.env.IS_OFFLINE === 'true';
const useWorkers = !isOffline && process.env.QUIZ_QUEUE_URL;
```

### Local Testing Commands
```bash
# Start local development environment
cd backend
npm run dev

# Test quiz generation locally (will use synchronous mode)
curl -X POST http://localhost:4000/quiz/generate \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "specific",
    "query": "photosynthesis",
    "questionCount": 5
  }'

# Check quiz status
curl http://localhost:4000/quiz/{quiz-id}
```

### Development Flow
1. **Local Testing**: Develop and test with synchronous mode
2. **Review Questions**: Check GPT output quality locally
3. **Adjust Prompts**: Iterate on prompt templates
4. **Deploy to Dev**: Test with real SQS workers
5. **Production**: Deploy with confidence

## Implementation Order

1. **Database Setup**
   - Create Quiz table in serverless.yml
   - Add GSI for userId

2. **Core Services**
   - Implement prompt.ts with GPT templates
   - Create chunksRetrieval.ts for Pinecone queries
   - Build generator.ts orchestration logic with LOCAL MODE SUPPORT

3. **Lambda Handlers**
   - Create generate.ts endpoint (works in both modes)
   - Implement worker.ts and subWorker.ts (production only)
   - Add status.ts endpoint

4. **Queue Configuration**
   - Add SQS queues to serverless.yml
   - Configure worker triggers
   - Skip queue setup in local mode

5. **Testing & Integration**
   - Test locally first with synchronous mode
   - Verify question quality and format
   - Test production mode with SQS in AWS
   - Ensure progress tracking works in both modes

## Success Metrics

- Questions generated match requested count (±1)
- Generation completes in <30 seconds for 10 questions
- >95% valid JSON responses from GPT-4o
- No duplicate questions in same quiz
- All questions relate to provided content


---

**This implementation prioritizes simplicity, reliability, and maintainability while leveraging your existing infrastructure patterns.**
