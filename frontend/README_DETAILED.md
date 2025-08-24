# Frontend Architecture Documentation

## Overview
The StudiaHub-v2 frontend is a modern React application built with Next.js 15, featuring a beautiful dark theme interface for AI-powered quiz generation from uploaded documents.

## Technology Stack
- **Framework**: Next.js 15 with App Router
- **React**: Version 19 with Server Components
- **TypeScript**: Full type safety throughout
- **Styling**: Tailwind CSS 4 with custom gradients
- **UI Components**: Radix UI primitives
- **Authentication**: Clerk
- **State Management**: React hooks with custom abstractions
- **Icons**: Lucide React
- **Notifications**: Sonner toast notifications

## Architecture Overview

### 1. App Directory Structure (`/src/app/`)

#### Core Pages
**`page.tsx`** - Homepage
- Landing page with hero section
- Features overview and call-to-action
- Responsive design with gradient backgrounds

**`layout.tsx`** - Root Layout
- Global HTML structure and metadata
- Clerk authentication provider setup
- Global styles and font configuration
- Toast notifications provider

**`globals.css`** - Global Styles
- Tailwind CSS imports and customizations
- Dark theme CSS variables
- Custom gradient definitions
- Component-specific styling overrides

#### Dashboard (`/dashboard/page.tsx`)
**Purpose**: Main application interface after login
**Components Used**:
- `FileUploadDemo`: File upload interface
- `FilesList`: Display and manage uploaded files
- `QuizList`: Show generated quizzes
- `QuizDrawer`: Quiz taking interface

### 2. Components Directory (`/src/app/components/`)

#### Core Components

**`FileUploadDemo.tsx`**
- **Purpose**: Main file upload interface
- **Features**:
  - Drag-and-drop file upload
  - Progress tracking for file processing
  - Real-time status updates
  - Error handling and user feedback
- **Key Functions**:
  - File validation and upload
  - Progress polling
  - State management for upload flow

**`FilesList.tsx`** (430+ lines - Large Component)
- **Purpose**: Display and manage user's uploaded files
- **Features**:
  - File listing with metadata (name, size, upload date, status)
  - Toggle file inclusion in quiz generation
  - Delete files functionality
  - Real-time status updates
  - Responsive table design
- **Key Functions**:
  - `fetchFiles()`: Load user's files from API
  - `toggleFileStatus()`: Enable/disable files for quiz generation
  - `deleteFile()`: Remove files and associated data
  - File status polling and updates

**`QuizList.tsx`**
- **Purpose**: Display user's generated quizzes
- **Features**:
  - Quiz metadata display (title, question count, creation date)
  - Quiz selection and launching
  - Delete quiz functionality
  - Empty state handling
- **Key Functions**:
  - Quiz listing and management
  - Integration with QuizDrawer for quiz taking

**`QuizDrawer.tsx`**
- **Purpose**: Interactive quiz taking interface
- **Features**:
  - Slide-out drawer for quiz interaction
  - Question progression and scoring
  - Multiple choice question handling
  - Results display and progress tracking
- **Key Functions**:
  - Quiz state management
  - Answer selection and validation
  - Progress calculation and display

**`QuizQuestions.tsx`**
- **Purpose**: Individual question display and interaction
- **Features**:
  - Multiple choice question rendering
  - Answer selection handling
  - Question navigation
  - Scoring and feedback

#### Upload Components (`/components/UploadDropzone/`)

**`index.tsx`** - Main Dropzone Component
- **Purpose**: Orchestrates file upload UI
- **Features**:
  - Drag-and-drop interface
  - File validation
  - Upload progress display
- **Integration**: Combines DropArea and FileList

**`DropArea.tsx`** - Drag-and-Drop Zone
- **Purpose**: Visual drop zone for files
- **Features**:
  - Drag state visualization
  - File type validation
  - Accessibility support
- **Functions**:
  - `handleDragOver()`, `handleDrop()`: Drag-and-drop handlers
  - `validateFile()`: File type and size validation

**`FileList.tsx`** - Upload File Display
- **Purpose**: Show files during upload process
- **Features**:
  - File preview with icons
  - Upload progress indicators
  - Remove files before upload
- **Functions**:
  - File list management and display
  - Progress visualization

**`utils.ts`** - Upload Utilities
- **Functions**:
  - `formatFileSize()`: Human-readable file sizes
  - `getFileIcon()`: File type-specific icons
  - File validation helpers

### 3. Hooks Directory (`/src/hooks/` & `/src/app/hooks/`)

**`useFiles.ts`**
- **Purpose**: File management state and operations
- **Functions**:
  - `fetchFiles()`: Load user's files from API
  - `deleteFile()`: Remove files with optimistic updates
  - `toggleFileStatus()`: Enable/disable files for quizzes
- **State Management**:
  - Files list state
  - Loading and error states
  - Optimistic UI updates

**`useQuiz.ts`**
- **Purpose**: Quiz generation and management
- **Functions**:
  - `generateQuiz()`: Initiate quiz creation
  - `deleteQuiz()`: Remove quizzes
  - `checkQuizStatus()`: Poll generation progress
- **State Management**:
  - Quiz list state
  - Generation progress tracking
  - Error handling

### 4. Services Directory (`/src/services/` & `/src/app/services/`)

**`quiz.ts`**
- **Purpose**: API communication for quiz operations
- **Functions**:
  - `generateQuiz()`: Backend API call for quiz generation
  - `getQuizStatus()`: Poll generation progress
  - `deleteQuiz()`: Remove quiz from backend
  - `getQuizzes()`: Fetch user's quiz list
- **Features**:
  - Error handling and retry logic
  - Type-safe API responses
  - Consistent request formatting

### 5. UI Components (`/src/components/ui/`)

**Radix UI-based Components**:
- `badge.tsx`: Status indicators and labels
- `button.tsx`: Customizable button variants
- `card.tsx`: Content containers with styling
- `input.tsx`: Form input fields
- `label.tsx`: Form labels with accessibility
- `progress.tsx`: Progress bars for loading states
- `select.tsx`: Dropdown selection components
- `separator.tsx`: Visual dividers
- `sheet.tsx`: Slide-out drawer containers
- `sonner.tsx`: Toast notification system
- `switch.tsx`: Toggle switches
- `textarea.tsx`: Multi-line text inputs
- `tooltip.tsx`: Contextual help tooltips

### 6. Types Directory (`/src/types/`)

**`file.ts`**
- **Interfaces**:
  - `FileItem`: File metadata structure
  - `FileStatus`: Processing status enumeration
  - `UploadProgress`: Progress tracking interface
- **Type Definitions**:
  - Ensures type safety across file operations
  - Consistent data structures for API communication

### 7. Library Utilities (`/src/lib/`)

**`cn.ts`**
- **Purpose**: Conditional className utility
- **Function**: `cn()` - Combines Tailwind classes with conflict resolution
- **Usage**: Enables dynamic styling based on component state

**`utils.ts`**
- **Purpose**: General utility functions
- **Functions**:
  - Date formatting helpers
  - String manipulation utilities
  - Common validation functions

### 8. Middleware (`/src/middleware.ts`)

**Purpose**: Request/response processing for Next.js
**Features**:
- Authentication middleware integration with Clerk
- Route protection for dashboard pages
- Request logging and monitoring

## Key Features & User Experience

### 1. File Upload Flow
```
Drag & Drop → Validation → S3 Upload → Processing Status → Quiz Ready
```

### 2. Quiz Generation Flow
```
Select Files → Configure Quiz → Generate → Progress Tracking → Quiz Available
```

### 3. Interactive Elements
- **Real-time Updates**: WebSocket-like polling for status changes
- **Optimistic UI**: Immediate feedback for user actions
- **Error Recovery**: Graceful error handling with retry options
- **Responsive Design**: Mobile-first responsive layout

## Component Interaction Patterns

### 1. State Management
- Custom hooks encapsulate complex state logic
- React Context for global state (minimal usage)
- Local state for component-specific data
- Optimistic updates for better UX

### 2. Data Flow
```
API Service → Custom Hook → Component State → UI Update
```

### 3. Error Handling
- Try-catch blocks in async operations
- User-friendly error messages via toast notifications
- Fallback UI states for error conditions
- Retry mechanisms for failed operations

## Styling Architecture

### 1. Design System
- **Colors**: Dark theme with purple/blue gradients
- **Typography**: Geist font family for modern aesthetics
- **Spacing**: Consistent Tailwind spacing scale
- **Components**: Radix UI for accessibility and consistency

### 2. Responsive Design
- Mobile-first approach with Tailwind breakpoints
- Flexible layouts using CSS Grid and Flexbox
- Touch-friendly interface elements
- Optimized for various screen sizes

## Performance Optimizations

### 1. Code Splitting
- Next.js automatic code splitting
- Dynamic imports for large components
- Lazy loading for non-critical features

### 2. Image Optimization
- Next.js Image component for optimized loading
- WebP format support with fallbacks
- Responsive image sizing

### 3. State Optimization
- Minimal re-renders through proper dependency arrays
- Memoization for expensive calculations
- Debounced API calls for search/filter operations

## Development Workflow

### 1. Type Safety
- Full TypeScript coverage
- Strict type checking enabled
- API response type validation
- Component prop type definitions

### 2. Code Quality
- ESLint configuration for code standards
- Prettier for consistent formatting
- Husky git hooks for pre-commit checks
- Component composition patterns

### 3. Testing Strategy
- Component testing setup (ready for tests)
- API mocking for development
- Error boundary implementation for production

## Security Considerations

### 1. Authentication
- Clerk integration for secure user management
- Protected routes through middleware
- Session management and token handling

### 2. Data Validation
- Input sanitization and validation
- File type and size restrictions
- XSS protection through React's built-in escaping

### 3. API Security
- Secure API endpoint communication
- Error message sanitization
- User data isolation and privacy

## Areas for Improvement

### 1. Component Architecture
- **Large Components**: FilesList.tsx is 430+ lines and should be split
- **Prop Drilling**: Some deeply nested prop passing
- **State Management**: Could benefit from more centralized state

### 2. Performance
- **Bundle Size**: Could optimize with better tree shaking
- **Caching**: Limited caching of API responses
- **Virtualization**: Large lists could use virtual scrolling

### 3. User Experience
- **Loading States**: More sophisticated loading indicators
- **Error Recovery**: Better error boundary implementation
- **Accessibility**: Enhanced ARIA labels and keyboard navigation

This frontend architecture provides a solid foundation for the StudiaHub-v2 application with modern React patterns, excellent TypeScript integration, and a focus on user experience. The main opportunities for improvement lie in component organization, state management optimization, and enhanced accessibility features.