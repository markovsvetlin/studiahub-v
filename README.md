# StudiaHub v2

**AI-powered document processing platform** that transforms course materials (PDFs, DOCX, images) into a searchable knowledge base using OpenAI embeddings and Pinecone vector database.

## Quick Context

**What it does:** Upload documents → Extract text → AI chunking → Generate embeddings → Vector search  
**Architecture:** Serverless (AWS Lambda + Next.js) with event-driven processing  
**AI Stack:** OpenAI embeddings + Pinecone + AWS Textract OCR

## 🚀 Quick Start

```bash
# Setup
git clone <repo> && cd StudiaHub-v2
cd backend && npm install && docker-compose up -d && npm run db:init:local
cd ../frontend && npm install

# Configure (add your API keys)
cp backend/.env.example backend/.env.dev
cp frontend/.env.example frontend/.env.local

# Run
cd backend && npm run dev     # Terminal 1: http://localhost:4000
cd frontend && npm run dev    # Terminal 2: http://localhost:3000
```

## 📂 Navigation & Detailed Docs

| Component | Quick Description | Detailed Documentation |
|-----------|-------------------|------------------------|
| **Backend** | Serverless API + file processing | [`backend/README.md`](backend/README.md) |
| **API Handlers** | Lambda functions & endpoints | [`backend/src/handlers/README.md`](backend/src/handlers/README.md) |
| **Processing Services** | File processing pipeline & AI integration | [`backend/src/services/README.md`](backend/src/services/README.md) |
| **Utilities** | Database operations & shared utilities | [`backend/src/utils/README.md`](backend/src/utils/README.md) |
| **Frontend** | Next.js app + React components | [`frontend/README.md`](frontend/README.md) |
| **UI Components** | File upload, management, display | [`frontend/src/app/components/README.md`](frontend/src/app/components/README.md) |
| **State Management** | Custom hooks & API integration | [`frontend/src/hooks/README.md`](frontend/src/hooks/README.md) |

## 🧠 AI Assistant Context

Each folder contains focused documentation for efficient development assistance:

- **Component-specific context** - understand individual parts quickly
- **Integration patterns** - how components work together  
- **Key files & functions** - main entry points and critical code
- **Common patterns** - conventions used in each area

## 🎯 Key Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS |
| **Backend** | Node.js 20, AWS Lambda, Serverless Framework 3.39 |
| **Database** | DynamoDB, Pinecone Vector DB |
| **AI/ML** | OpenAI text-embedding-3-large, AWS Textract |
| **Infrastructure** | AWS (S3, SQS, API Gateway), Docker |

## 🔗 Quick Links

- **Local Frontend:** http://localhost:3000
- **Local API:** http://localhost:4000  
- **DB Admin:** http://localhost:8002
- **Health Check:** http://localhost:4000/health

---

*Each README is optimized for AI assistance and contextual understanding.*
