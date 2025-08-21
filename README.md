# StudiaHub v2

**AI-powered learning acceleration platform** that transforms your study materials into personalized, intelligent quizzes designed to maximize learning speed and retention.

## Quick Context

**What it does:** Upload study materials → Process with AI → Generate personalized quizzes → Accelerate learning  
**Core Value:** Learn faster through AI-generated quizzes based on your specific content and focus areas  
**Architecture:** Serverless AI pipeline (AWS Lambda + Next.js) with intelligent content processing  
**AI Stack:** OpenAI embeddings + Pinecone vector database + AI quiz generation

## 🎯 Learning Features

📚 **AI Quiz Generation**: Creates personalized quizzes from your uploaded content  
🎯 **Focus Areas**: Set specific topics/subjects for targeted learning sessions  
🚀 **Learning Acceleration**: Optimized quiz formats for maximum retention and speed  
📄 **Multi-Format Content**: PDFs, DOCX, images - extract knowledge from any material  
🧠 **Semantic Understanding**: AI comprehends context, not just keywords  
⚡ **Real-time Processing**: From upload to quiz-ready in minutes

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
| **Backend** | Serverless API + content processing for quiz generation | [`backend/README.md`](backend/README.md) |
| **API Handlers** | Lambda functions & endpoints for content & quiz management | [`backend/src/handlers/README.md`](backend/src/handlers/README.md) |
| **Processing Services** | AI pipeline: content extraction → embeddings → quiz preparation | [`backend/src/services/README.md`](backend/src/services/README.md) |
| **Utilities** | Database operations & shared utilities | [`backend/src/utils/README.md`](backend/src/utils/README.md) |
| **Frontend** | Learning interface + content management | [`frontend/README.md`](frontend/README.md) |
| **UI Components** | Content upload, quiz interaction, learning dashboard | [`frontend/src/app/components/README.md`](frontend/src/app/components/README.md) |
| **State Management** | Learning state & content API integration | [`frontend/src/hooks/README.md`](frontend/src/hooks/README.md) |

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
| **AI/ML** | OpenAI embeddings + quiz generation, AWS Textract OCR |
| **Infrastructure** | AWS (S3, SQS, API Gateway), Docker |

## 🔗 Quick Links

- **Local Frontend:** http://localhost:3000
- **Local API:** http://localhost:4000  
- **DB Admin:** http://localhost:8002
- **Health Check:** http://localhost:4000/health

---

*Each README is optimized for AI assistance and contextual understanding.*
