# UI Components - Interface & User Interactions

**React components** that provide the user interface for document upload, management, and knowledge base interaction.

**Note:** The main dashboard functionality (file upload and management) is located in `/dashboard/page.tsx`, while the landing page with marketing content is in `/page.tsx`.

## Component Structure

```
components/
├── FilesList.tsx       # File management interface
├── ItemDemo.tsx        # API testing component  
└── UploadDropzone/     # File upload system
    ├── index.tsx       # Main upload component
    ├── DropArea.tsx    # Drag & drop interface
    ├── FileList.tsx    # Upload progress list
    └── utils.ts        # Upload utilities & API calls
```

## Component Details

### 📋 FilesList.tsx
**Purpose:** Main file management interface with sorting, toggling, and deletion

#### Key Features
- **Sortable Columns:** Name, date, size with visual indicators
- **Context Pool Toggle:** Enable/disable files for AI processing
- **File Deletion:** Complete removal from all systems
- **Real-time Status:** Live updates during operations
- **Responsive Design:** Mobile-optimized layout

#### Component Architecture
```typescript
export default function FilesList({
  files,
  onToggleEnabled,
  onDeleteFile,
  isLoading,
  sortField,
  sortDirection,
  onSort
}: FileListProps)
```

#### Sub-components
**`FileRow`** - Individual file display with actions
```typescript
function FileRow({ file, onToggleEnabled, onDelete }: FileRowProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border">
      {/* File icon & name */}
      {/* Context pool toggle */}  
      {/* Delete button with loading state */}
    </div>
  )
}
```

**`SortButton`** - Column header sorting controls
```typescript
function SortButton({ field, currentField, direction, onSort, children }) {
  return (
    <Button onClick={() => onSort(field)}>
      {children}
      {isActive && <ChevronIcon />}
    </Button>
  )
}
```

#### State Management
- **Internal Sorting:** Manages sort field and direction when no external sort provided
- **File Stats:** Calculates total files, active files, total size
- **Loading States:** Individual file operations with loading indicators

#### Styling Patterns
- **Dark Theme:** Neutral-900 backgrounds with hover states
- **Status Indicators:** Color-coded file states (enabled/disabled)
- **Interactive Elements:** Hover effects and transition animations
- **Mobile Responsive:** Stacked layout on small screens

### 📤 UploadDropzone/
**Purpose:** Complete file upload system with drag & drop, progress tracking, and batch processing

#### Main Component (index.tsx)
```typescript
export default function UploadDropzone({
  onFilesAdded,
  onChange,
  onUploadComplete,
  accept,
  maxTotalBytes,
  caption
}: UploadDropzoneProps)
```

**State Management:**
```typescript
const [isDragging, setIsDragging] = useState(false)
const [selectedFiles, setSelectedFiles] = useState<File[]>([])
const [isSubmitting, setIsSubmitting] = useState(false)
const [fileProgressByKey, setFileProgressByKey] = useState<Record<string, ProgressState>>({})
```

**Key Features:**
- **File Validation:** Type and size checking
- **Deduplication:** Prevents duplicate file selection
- **Progress Tracking:** Real-time upload and processing status
- **Error Handling:** User-friendly error messages
- **Batch Processing:** Multiple files with concurrent uploads

#### Sub-components

**`DropArea.tsx`** - Drag & drop interface
```typescript
export function DropArea({
  isDragging,
  setIsDragging,
  onFiles,
  onOpenPicker,
  caption,
  selectedCount,
  totalBytes,
  limitMB
}) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    onFiles(e.dataTransfer.files)
  }
}
```

**Features:**
- **Visual Feedback:** Border and background changes during drag
- **File Drop Handling:** Processes dropped files
- **Click to Browse:** Alternative file selection method
- **Status Display:** Shows selected file count and total size

**`FileList.tsx`** - Upload progress display
```typescript
export function FileList({
  files,
  makeKey,
  formatBytes,
  progressMap,
  onRemove
}) {
  return (
    <div className="space-y-2">
      {files.map(file => (
        <FileItem key={makeKey(file)} file={file} progress={progressMap[makeKey(file)]} />
      ))}
    </div>
  )
}
```

**Features:**
- **Progress Bars:** Visual upload and processing progress
- **Status Indicators:** Different states (idle, processing, done, error)
- **File Removal:** Remove files before upload
- **File Metadata:** Size, type, and name display

#### Upload Process Flow

**`utils.ts`** - Upload orchestration and API integration
```typescript
export async function uploadToBackend(
  files: File[],
  updateProgress: (key: string, progress: number, status?: FileStatus) => void,
  onFileDone?: (localKey: string) => void
)
```

**Upload Steps:**
1. **Generate Presigned URL** (5% progress)
2. **Direct S3 Upload** (20% progress)  
3. **Confirm Upload** (30% progress)
4. **Start Status Polling** (30-100% progress)

**Status Polling:**
```typescript
async function pollFileStatus(
  baseUrl: string,
  backendKey: string,
  localKey: string,
  updateProgress: Function
) {
  // Poll backend every 800ms for processing status
  // Update progress bar in real-time  
  // Complete when status = 'ready' or progress = 100
}
```

### 🧪 ItemDemo.tsx
**Purpose:** API testing and demonstration component

```typescript
export default function ItemDemo() {
  const [creating, setCreating] = useState(false)
  const [result, setResult] = useState(null)
  
  const createItem = async () => {
    const res = await fetch(`${base}/items`, { 
      method: 'POST',
      body: JSON.stringify({ name: 'demo' })
    })
    setResult(await res.json())
  }
}
```

**Features:**
- **API Testing:** Create and fetch items for backend validation
- **Response Display:** Shows API responses in formatted JSON
- **Loading States:** Button states during API calls
- **Error Handling:** Displays API errors to developers

## Utility Functions

### File Type Detection
```typescript
function getFileIcon(contentType: string, className?: string) {
  const isImage = contentType.startsWith('image/')
  return isImage 
    ? <ImageIcon className={cn("text-blue-400", className)} />
    : <FileText className={cn("text-emerald-400", className)} />
}
```

### Date Formatting
```typescript
function formatDate(dateString: string): string {
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
  
  if (diffInHours < 1) return `${Math.floor(diffInHours * 60)}m ago`
  if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`
  if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`
  return date.toLocaleDateString()
}
```

### File Size Formatting  
```typescript
function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 B'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}
```

## Component Patterns

### Optimistic Updates
```typescript
const toggleFileEnabled = async (fileId: string, enabled: boolean) => {
  // Immediate UI update
  setFiles(prev => prev.map(file => 
    file.id === fileId ? { ...file, isEnabled: enabled } : file
  ))
  
  try {
    await updateAPI(fileId, enabled)
  } catch (error) {
    // Rollback on error
    setFiles(prev => prev.map(file => 
      file.id === fileId ? { ...file, isEnabled: !enabled } : file
    ))
  }
}
```

### Loading States
```typescript
const [isDeleting, setIsDeleting] = useState(false)

const handleDelete = async () => {
  setIsDeleting(true)
  try {
    await onDelete(file.id)
  } finally {
    setIsDeleting(false)
  }
}

// UI reflects loading state
{isDeleting ? (
  <Loader2 className="w-4 h-4 animate-spin" />
) : (
  <Trash2 className="w-4 h-4" />
)}
```

### Error Boundaries
```typescript
if (error) {
  return (
    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
      Error loading files: {error}
    </div>
  )
}
```

## Design System Integration

### Color Scheme
- **Primary:** Indigo-400 for interactive elements
- **Success:** Emerald-400 for positive actions
- **Warning:** Yellow-400 for caution states
- **Error:** Red-400 for destructive actions
- **Neutral:** Gray scale for backgrounds and text

### Icon Usage
```typescript
import { 
  FileText,     // Documents
  Image,        // Images  
  Database,     // Context pool
  Trash2,       // Delete actions
  Loader2,      // Loading states
  Calendar,     // Timestamps
  HardDrive     // Storage
} from 'lucide-react'
```

### Responsive Breakpoints
- **Mobile:** Stack elements vertically
- **Tablet:** Reduce spacing and font sizes
- **Desktop:** Full feature layout with hover states

## Accessibility Features

### Keyboard Navigation
- **Tab Order:** Logical focus progression
- **Enter/Space:** Activate buttons and toggles
- **Arrow Keys:** Navigate sortable columns
- **Escape:** Cancel drag operations

### Screen Reader Support
- **Aria Labels:** Descriptive button and input labels
- **Live Regions:** Status updates announced
- **Semantic HTML:** Proper heading hierarchy
- **Alt Text:** Image and icon descriptions

### Visual Indicators
- **Focus Rings:** Visible focus states for keyboard users
- **Color Contrast:** WCAG AA compliant color ratios
- **Motion Reduction:** Respect `prefers-reduced-motion`
- **High Contrast:** Enhanced visibility options

---

*These components create an intuitive and accessible interface for the AI document processing platform.*
