# Components Directory Documentation

## Overview
The components directory contains all React components for the StudiaHub-v2 frontend. Components are organized by feature and follow a modular architecture pattern with clear separation of concerns.

## Directory Structure

```
components/
├── FileUploadDemo.tsx       # Main file upload interface
├── FilesList.tsx           # File management and display (430+ lines)
├── QuizDrawer.tsx          # Interactive quiz taking interface
├── QuizList.tsx           # Quiz listing and management
├── QuizQuestions.tsx       # Individual question rendering
├── UploadDropzone/         # File upload components
│   ├── index.tsx          # Main dropzone orchestrator
│   ├── DropArea.tsx       # Drag-and-drop zone
│   ├── FileList.tsx       # Upload file display
│   └── utils.ts           # Upload utility functions
└── auth/                   # Authentication components (if needed)
```

## Core Components

### `FileUploadDemo.tsx`
**Purpose**: Main file upload interface for the dashboard
**Features**:
- Drag-and-drop file upload
- Progress tracking for file processing
- Real-time status updates
- Error handling and user feedback

**Key Functions**:
- `handleFileUpload()`: Process file selection and initiate upload
- `trackUploadProgress()`: Monitor file processing status
- `validateFile()`: Check file type and size constraints

**State Management**:
- Upload progress tracking
- File validation states
- Error and success feedback

**Integration**:
- Uses UploadDropzone components for UI
- Integrates with backend file processing APIs
- Real-time status polling

### `FilesList.tsx` (⚠️ Large Component - 430+ lines)
**Purpose**: Display and manage user's uploaded files
**Features**:
- File listing with metadata (name, size, upload date, status)
- Toggle file inclusion in quiz generation
- Delete files functionality
- Real-time status updates
- Responsive table design

**Key Functions**:
- `fetchFiles()`: Load user's files from API
- `toggleFileStatus()`: Enable/disable files for quiz generation
- `deleteFile()`: Remove files and associated data
- `handleFileSelection()`: Manage file selection for quizzes
- `refreshFileStatus()`: Poll for processing updates

**State Management**:
- Files list state with optimistic updates
- Loading states for various operations
- Error handling for API failures
- File selection state for quiz generation

**UI Components**:
- Responsive data table
- Status indicators (badges)
- Action buttons (delete, toggle)
- Progress indicators
- Empty states

**Areas for Refactoring**:
- Component is too large (430+ lines)
- Multiple responsibilities (display, actions, state management)
- Could be split into smaller, focused components

### `QuizList.tsx`
**Purpose**: Display user's generated quizzes
**Features**:
- Quiz metadata display (title, question count, creation date)
- Quiz selection and launching
- Delete quiz functionality
- Empty state handling

**Key Functions**:
- `fetchQuizzes()`: Load user's quiz list
- `deleteQuiz()`: Remove quiz with confirmation
- `launchQuiz()`: Open quiz in drawer interface
- `handleQuizSelection()`: Quiz interaction management

**State Management**:
- Quiz list with CRUD operations
- Loading and error states
- Selected quiz state

**Integration**:
- Communicates with QuizDrawer for quiz taking
- Backend API integration for quiz management

### `QuizDrawer.tsx`
**Purpose**: Interactive quiz taking interface
**Features**:
- Slide-out drawer for quiz interaction
- Question progression and navigation
- Answer selection and validation
- Results display and scoring
- Progress tracking

**Key Functions**:
- `openQuiz()`: Initialize quiz session
- `nextQuestion()`: Navigate to next question
- `submitAnswer()`: Process user's answer selection
- `calculateScore()`: Compute final quiz results
- `resetQuiz()`: Clear quiz state

**State Management**:
- Current question index
- User answers and scoring
- Quiz completion status
- Results and feedback

**UI Features**:
- Animated transitions between questions
- Progress bar visualization
- Score feedback
- Results summary

### `QuizQuestions.tsx`
**Purpose**: Individual question display and interaction
**Features**:
- Multiple choice question rendering
- Answer selection handling
- Question navigation controls
- Visual feedback for selected answers

**Key Functions**:
- `renderQuestion()`: Display question content
- `handleAnswerSelection()`: Process answer choice
- `validateAnswer()`: Check answer correctness
- `renderAnswerOptions()`: Display multiple choice options

**Props Interface**:
```typescript
interface QuizQuestionProps {
  question: Question
  questionIndex: number
  totalQuestions: number
  selectedAnswer?: string
  onAnswerSelect: (answer: string) => void
  onNext: () => void
  onPrevious: () => void
  showResults?: boolean
}
```

## Upload Components (`/UploadDropzone/`)

### `index.tsx` - Main Dropzone Component
**Purpose**: Orchestrates file upload UI components
**Features**:
- Combines DropArea and FileList components
- Manages upload state and coordination
- Handles file validation and processing

**Key Functions**:
- `handleFilesSelected()`: Process file selection
- `validateFiles()`: Check file constraints
- `initiateUpload()`: Start upload process
- `trackProgress()`: Monitor upload progress

**Integration**:
- Coordinates between DropArea and FileList
- Communicates with parent components
- Manages overall upload workflow

### `DropArea.tsx` - Drag-and-Drop Zone
**Purpose**: Visual drop zone for file selection
**Features**:
- Drag-and-drop interface with visual feedback
- File type validation
- Accessibility support
- Hover states and animations

**Key Functions**:
- `handleDragOver()`: Visual feedback during drag
- `handleDrop()`: Process dropped files
- `handleClick()`: Open file browser
- `validateDroppedFiles()`: Check file constraints

**State Management**:
- Drag state (dragOver, dragEnter, dragLeave)
- File validation states
- Error feedback

**Accessibility Features**:
- Keyboard navigation support
- Screen reader compatibility
- ARIA labels and descriptions

### `FileList.tsx` - Upload File Display
**Purpose**: Show files during upload process
**Features**:
- File preview with type-specific icons
- Upload progress indicators
- Remove files before upload
- File metadata display

**Key Functions**:
- `renderFileItem()`: Display individual file
- `showProgress()`: Upload progress visualization
- `removeFile()`: Remove file from upload queue
- `formatFileSize()`: Human-readable file sizes

**UI Elements**:
- File icons based on type
- Progress bars for upload status
- Remove buttons for each file
- File size and type information

### `utils.ts` - Upload Utilities
**Purpose**: Shared utility functions for upload components
**Functions**:

#### `formatFileSize(bytes: number): string`
- Convert bytes to human-readable format (KB, MB, GB)
- Handles edge cases and rounding

#### `getFileIcon(filename: string): string`
- Return appropriate icon based on file extension
- Supports PDF, DOCX, image files
- Default icon for unknown types

#### `validateFile(file: File): ValidationResult`
- Check file size against limits
- Validate file type against allowed formats
- Return validation status with error messages

#### `generateFilePreview(file: File): string | null`
- Generate preview URLs for image files
- Handle unsupported file types gracefully

## Component Interaction Patterns

### 1. Parent-Child Communication
```typescript
// Parent passes data and callbacks to children
<FilesList
  files={files}
  onFileToggle={handleFileToggle}
  onFileDelete={handleFileDelete}
  isLoading={isLoading}
/>
```

### 2. State Management Pattern
```typescript
// Custom hooks encapsulate complex state logic
const { files, loading, error, deleteFile, toggleFile } = useFiles()

// Components focus on UI rendering
return (
  <div>
    {loading ? <LoadingSpinner /> : <FileTable files={files} />}
    {error && <ErrorMessage message={error} />}
  </div>
)
```

### 3. Event Handling Pattern
```typescript
// Optimistic updates with error recovery
const handleDelete = async (fileId: string) => {
  // Optimistic update
  setFiles(files => files.filter(f => f.id !== fileId))
  
  try {
    await deleteFile(fileId)
    // Success - no additional action needed
  } catch (error) {
    // Revert optimistic update
    setFiles(originalFiles)
    showError('Delete failed')
  }
}
```

## Styling Approach

### 1. Tailwind CSS Classes
```typescript
// Consistent styling patterns
const buttonClasses = "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
const cardClasses = "bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
```

### 2. Conditional Styling
```typescript
// Dynamic classes based on state
const statusClasses = {
  processing: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800", 
  error: "bg-red-100 text-red-800"
}
```

### 3. Responsive Design
```typescript
// Mobile-first responsive patterns
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
```

## Performance Optimizations

### 1. React.memo Usage
```typescript
// Prevent unnecessary re-renders
const FileItem = React.memo(({ file, onToggle, onDelete }) => {
  // Component implementation
})
```

### 2. Callback Memoization
```typescript
// Stable callback references
const handleFileToggle = useCallback((fileId: string) => {
  toggleFile(fileId)
}, [toggleFile])
```

### 3. Lazy Loading
```typescript
// Dynamic imports for large components
const QuizDrawer = lazy(() => import('./QuizDrawer'))
```

## Error Handling

### 1. Error Boundaries
```typescript
// Graceful error recovery
<ErrorBoundary fallback={<ErrorFallback />}>
  <FilesList />
</ErrorBoundary>
```

### 2. User Feedback
```typescript
// Toast notifications for operations
const { toast } = useToast()

const handleError = (error: string) => {
  toast({
    title: "Error",
    description: error,
    variant: "destructive"
  })
}
```

## Accessibility Features

### 1. ARIA Labels
```typescript
// Screen reader support
<button
  aria-label={`Delete ${file.name}`}
  onClick={() => onDelete(file.id)}
>
  <TrashIcon />
</button>
```

### 2. Keyboard Navigation
```typescript
// Keyboard event handling
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    handleClick()
  }
}
```

## Areas for Improvement

### 1. Component Size Reduction
**Problem**: FilesList.tsx is 430+ lines
**Solution**: Split into smaller components:
- `FilesHeader` - Table header and actions
- `FilesTable` - Data table container
- `FileRow` - Individual file row
- `FileActions` - Action buttons per file

### 2. State Management Optimization
**Problem**: Props drilling in some components
**Solution**: Consider React Context for shared state

### 3. Performance Enhancements
**Problem**: Large file lists may cause performance issues
**Solution**: Implement virtual scrolling or pagination

### 4. Testing Infrastructure
**Problem**: Limited component testing
**Solution**: Add comprehensive unit and integration tests

This component architecture provides a solid foundation for the StudiaHub-v2 user interface, with clear separation of concerns and reusable patterns. The main focus for improvement should be breaking down large components and optimizing state management patterns.