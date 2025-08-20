# Frontend - Next.js Application & React Components

**Modern React frontend** built with Next.js 15, providing an intuitive interface for document upload, management, and knowledge base interaction.

## Architecture Overview

```
Next.js App Router → React Components → Custom Hooks → Backend API
                                  ↓
                            Tailwind CSS + Radix UI
```

## Project Structure

```
frontend/src/
├── app/                        # Next.js App Router
│   ├── components/            # Page-specific components
│   │   ├── FilesList.tsx     # File management interface
│   │   ├── ItemDemo.tsx      # API testing component
│   │   └── UploadDropzone/   # File upload system
│   ├── layout.tsx            # Root layout with fonts & theme
│   ├── page.tsx              # Main application page
│   └── globals.css           # Global styles & design system
├── components/ui/             # Reusable UI components (Radix UI)
├── hooks/                     # Custom React hooks
│   └── useFiles.ts           # File management state
├── lib/                       # Utility functions
│   └── utils.ts              # Class name utilities (cn)
└── types/                     # TypeScript definitions
    └── file.ts               # File-related interfaces
```

## Tech Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| **Next.js** | React Framework | 15.4.6 |
| **React** | UI Library | 19.1.0 |
| **TypeScript** | Type Safety | 5.x |
| **Tailwind CSS** | Styling Framework | 4.x |
| **Radix UI** | Component Primitives | Various |
| **Lucide React** | Icon Library | 0.539.0 |

## Key Components

### 🏠 app/page.tsx
**Purpose:** Main application page with file management interface

```typescript
export default function Home() {
  return (
    <main className="min-h-screen p-8 space-y-10">
      <header>
        <h1>AI-Powered Learning Hub</h1>
      </header>
      <FilesSection />
    </main>
  )
}
```

**Structure:**
- Clean layout with header and main content area
- Uses `FilesSection` component for file operations
- Integrates with `useFiles` hook for state management

### 📋 FilesSection Component
**Purpose:** Orchestrates file upload and management

```typescript
function FilesSection() {
  const { files, isLoading, error, toggleFileEnabled, deleteFile, refreshFiles } = useFiles()
  
  return (
    <>
      <UploadDropzone onUploadComplete={refreshFiles} />
      <FilesList
        files={files}
        onToggleEnabled={toggleFileEnabled}
        onDeleteFile={deleteFile}
        isLoading={isLoading}
      />
    </>
  )
}
```

### 🎨 Design System

#### Dark Theme Configuration
- **Primary Colors:** Indigo-400 (#606eee) for accents
- **Background:** Dark neutral colors (neutral-900)
- **Typography:** Geist Sans & Geist Mono fonts
- **Components:** Consistent spacing and border radius

#### Responsive Design
- **Mobile-first:** Tailwind CSS breakpoints
- **Flexible Layouts:** CSS Grid and Flexbox
- **Touch-friendly:** Large tap targets and spacing

## Component Architecture

### 📁 components/FilesList.tsx
**Purpose:** Display and manage uploaded files  
*See [`components/README.md`](src/app/components/README.md) for details*

**Key Features:**
- Sortable file list (name, date, size)
- Context pool toggle switches
- Real-time status updates
- File deletion with confirmation
- Responsive design with mobile support

### 📤 components/UploadDropzone/
**Purpose:** File upload interface with drag & drop  
*See [`components/README.md`](src/app/components/README.md) for details*

**Key Features:**
- Drag & drop file selection
- File type validation
- Progress tracking with visual feedback
- Batch upload processing
- Real-time status polling

### ⚛️ hooks/useFiles.ts
**Purpose:** File management state and API integration  
*See [`hooks/README.md`](src/hooks/README.md) for details*

**State Management:**
- File list with loading/error states
- Optimistic updates for better UX
- API integration with error handling
- Real-time refresh capabilities

## State Management Patterns

### Custom Hooks Pattern
```typescript
export function useFiles() {
  const [files, setFiles] = useState<FileListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Optimistic updates
  const toggleFileEnabled = useCallback(async (fileId: string, enabled: boolean) => {
    setFiles(prev => prev.map(file => 
      file.id === fileId ? { ...file, isEnabled: enabled } : file
    ))
    // API call with rollback on error
  }, [])

  return { files, isLoading, error, toggleFileEnabled, deleteFile, refreshFiles }
}
```

### Error Handling Pattern
```typescript
try {
  const response = await fetch(`${API_BASE}/files`)
  if (!response.ok) {
    throw new Error(`Failed to fetch files: ${response.status}`)
  }
  const data = await response.json()
  setFiles(data.files || [])
} catch (err) {
  setError(err instanceof Error ? err.message : 'Failed to fetch files')
  setFiles([])
}
```

## API Integration

### Base Configuration
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://oyehv715ef.execute-api.us-east-1.amazonaws.com'
```

### Request Patterns
**GET Requests:**
```typescript
const response = await fetch(`${API_BASE}/files`)
const data = await response.json()
```

**POST/PATCH Requests:**
```typescript
const response = await fetch(`${API_BASE}/files/${fileId}/toggle`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ isEnabled: enabled })
})
```

## UI Component Library

### Radix UI Integration
```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
```

### Component Customization
- **Consistent Styling:** All components follow design system
- **Accessible:** Radix UI provides ARIA compliance
- **Themeable:** CSS variables for color customization
- **Responsive:** Mobile-first design patterns

## Type Definitions

### File Interfaces
```typescript
export interface FileRecord {
  id: string
  key: string
  createdAt: string
  updatedAt?: string
  fileName?: string
  fileSize?: number
  contentType?: string
  isEnabled?: boolean
}

export interface FileListItem extends FileRecord {
  fileName: string
  fileSize: number
  contentType: string
  isEnabled: boolean
}
```

### Component Props
```typescript
export interface FileListProps {
  files: FileListItem[]
  onToggleEnabled: (fileId: string, enabled: boolean) => void
  onDeleteFile: (fileId: string) => void
  isLoading?: boolean
  sortField?: SortField
  sortDirection?: SortDirection
  onSort?: (field: SortField) => void
}
```

## Development Workflow

### Commands
```bash
# Development
npm run dev          # Start Next.js dev server (port 3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint code checking
```

### File Watching
- **Hot Reload:** Automatic page refresh on changes
- **Fast Refresh:** Component state preservation during development
- **Type Checking:** Real-time TypeScript validation

### Environment Configuration
```env
# frontend/.env.local
NEXT_PUBLIC_API_BASE=http://localhost:4000
```

## Performance Optimizations

### React Optimizations
- **useCallback:** Memoized event handlers
- **useMemo:** Expensive computations cached
- **Component Separation:** Small, focused components
- **Lazy Loading:** Dynamic imports where beneficial

### Next.js Features
- **App Router:** Efficient routing and layouts
- **Static Generation:** Build-time optimization
- **Image Optimization:** Automatic image processing
- **Font Optimization:** Built-in font loading

### User Experience
- **Optimistic Updates:** Immediate UI feedback
- **Loading States:** Visual feedback during operations
- **Error Boundaries:** Graceful error handling
- **Progressive Enhancement:** Works without JavaScript

## Styling Approach

### Tailwind CSS Configuration
- **Dark Theme:** Default dark mode styling
- **Custom Colors:** Brand-specific color palette
- **Responsive Design:** Mobile-first breakpoints
- **Component Variants:** Class variance authority (CVA)

### Global Styles
```css
/* Custom scrollbar styling */
*::-webkit-scrollbar {
  width: 10px;
}
*::-webkit-scrollbar-thumb {
  background-color: #2a2a2a;
  border-radius: 9999px;
}

/* CSS variables for theming */
:root {
  --primary: #606eee;
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
}
```

## Testing Strategy

### Component Testing
- **Unit Tests:** Individual component functionality
- **Integration Tests:** Component interaction
- **Accessibility Tests:** ARIA compliance validation
- **Visual Regression:** UI consistency checks

### API Integration Testing
- **Mock API:** Development and testing
- **Error Scenarios:** Network failure handling
- **Loading States:** Async operation testing
- **Real API:** End-to-end validation

---

*The frontend provides an intuitive interface for the sophisticated AI document processing backend.*