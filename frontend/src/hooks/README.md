# Custom Hooks - State Management & API Integration

**Custom React hooks** that encapsulate state management, API interactions, and business logic for clean component separation.

## Hook Structure

```
hooks/
└── useFiles.ts    # File management state & API integration
```

## Hook Details

### 📁 useFiles.ts
**Purpose:** Complete file management state with API integration, optimistic updates, and error handling

#### Hook Interface
```typescript
export function useFiles() {
  return {
    files: FileListItem[],           // Current file list
    isLoading: boolean,              // Loading state for initial fetch
    error: string | null,            // Error message if any
    toggleFileEnabled: Function,     // Enable/disable file in context pool
    deleteFile: Function,            // Delete file from all systems
    refreshFiles: Function           // Manually refresh file list
  }
}
```

#### State Management
```typescript
const [files, setFiles] = useState<FileListItem[]>([])
const [isLoading, setIsLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
```

**State Patterns:**
- **Initialization:** Starts with loading state, empty files
- **Error States:** Clear error on new operations
- **Optimistic Updates:** Immediate UI feedback with rollback on failure

## Core Functions

### File Fetching
```typescript
const fetchFiles = useCallback(async () => {
  try {
    setIsLoading(true)
    setError(null)
    
    const response = await fetch(`${API_BASE}/files`)
    if (!response.ok) {
      throw new Error(`Failed to fetch files: ${response.status}`)
    }
    
    const data = await response.json()
    if (!data.ok) {
      throw new Error(data.error || 'Failed to fetch files')
    }
    
    setFiles(data.files || [])
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to fetch files')
    setFiles([])
  } finally {
    setIsLoading(false)
  }
}, [])
```

**Features:**
- **Error Handling:** Network errors, API errors, and data validation
- **Loading Management:** Clear loading states with proper cleanup
- **Data Validation:** Checks response structure and API success flag
- **Fallback Values:** Safe defaults for missing data

### Optimistic File Toggle
```typescript
const toggleFileEnabled = useCallback(async (fileId: string, enabled: boolean) => {
  try {
    // Immediate optimistic update
    setFiles(prev => prev.map(file => 
      file.id === fileId ? { ...file, isEnabled: enabled } : file
    ))

    const response = await fetch(`${API_BASE}/files/${fileId}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled: enabled })
    })
    
    if (!response.ok) {
      throw new Error(`Failed to toggle file: ${response.status}`)
    }
    
    const data = await response.json()
    if (!data.ok) {
      throw new Error(data.error || 'Failed to toggle file')
    }


    
  } catch (err) {
    // Rollback optimistic update on error
    setFiles(prev => prev.map(file => 
      file.id === fileId ? { ...file, isEnabled: !enabled } : file
    ))
    setError(err instanceof Error ? err.message : 'Failed to toggle file')
  }
}, [])
```

**Optimistic Update Pattern:**
1. **Immediate UI Update:** Change state instantly for responsiveness
2. **API Call:** Send request to backend
3. **Success Handling:** Log success, maintain UI state
4. **Error Rollback:** Revert UI changes if API fails
5. **Error Display:** Show user-friendly error message

### File Deletion
```typescript
const deleteFile = useCallback(async (fileId: string) => {
  try {
    const response = await fetch(`${API_BASE}/files/${fileId}`, { 
      method: 'DELETE' 
    })
    
    if (!response.ok) {
      throw new Error(`Failed to delete file: ${response.status}`)
    }
    
    const data = await response.json()
    if (!data.ok) {
      throw new Error(data.error || 'Failed to delete file')
    }
    
    // Remove from local state only after successful API call
    setFiles(prev => prev.filter(file => file.id !== fileId))
    
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to delete file')
  }
}, [])
```

**Deletion Pattern:**
- **No Optimistic Update:** Wait for API success before UI update
- **Complete Removal:** Backend handles S3, DynamoDB, and Pinecone deletion
- **Error Preservation:** Keep file in UI if deletion fails
- **State Cleanup:** Filter out deleted file from local state

### Manual Refresh
```typescript
const refreshFiles = useCallback(() => {
  // Use setTimeout to avoid setState during render
  setTimeout(() => {
    fetchFiles()
  }, 0)
}, [fetchFiles])
```

**Usage:** Called after file uploads complete to refresh the list

## Hook Lifecycle

### Initialization
```typescript
useEffect(() => {
  fetchFiles()
}, [fetchFiles])
```

**Effect Dependencies:**
- **fetchFiles:** Memoized with useCallback to prevent infinite loops
- **Empty Dependency:** Would cause infinite re-renders
- **Correct Dependency:** Stable function reference ensures single call

### State Updates Flow
```
Initial Load → setIsLoading(true) → API Call → Success/Error → setIsLoading(false)
     ↓
File Toggle → Optimistic Update → API Call → Success Log / Error Rollback
     ↓
File Delete → API Call → Success Filter / Error Preserve
     ↓
Manual Refresh → fetchFiles() → Full Reload Cycle
```

## Error Handling Strategies

### Network Error Handling
```typescript
try {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
} catch (err) {
  if (err instanceof TypeError) {
    setError('Network connection failed')
  } else {
    setError(err.message)
  }
}
```

### API Error Handling
```typescript
const data = await response.json()
if (!data.ok) {
  throw new Error(data.error || 'Unknown API error')
}
```

### Type-Safe Error Messages
```typescript
setError(err instanceof Error ? err.message : 'Unknown error occurred')
```

## Performance Optimizations

### Memoized Callbacks
```typescript
const toggleFileEnabled = useCallback(async (fileId: string, enabled: boolean) => {
  // Function body
}, []) // Empty dependency array - function never changes
```

**Benefits:**
- **Prevents Re-renders:** Stable function reference
- **Child Optimization:** Components can use React.memo effectively
- **Performance:** Reduces unnecessary effect triggers

### State Updates Optimization
```typescript
// Good: Functional update for dependent state changes
setFiles(prev => prev.map(file => 
  file.id === fileId ? { ...file, isEnabled: enabled } : file
))

// Avoid: Direct state dependency
setFiles(files.map(file => 
  file.id === fileId ? { ...file, isEnabled: enabled } : file
))
```

### Debounced Operations
```typescript
// Prevent rapid successive API calls
const refreshFiles = useCallback(() => {
  setTimeout(() => {
    fetchFiles()
  }, 0)
}, [fetchFiles])
```

## Integration Patterns

### Component Usage
```typescript
function FilesSection() {
  const { files, isLoading, error, toggleFileEnabled, deleteFile, refreshFiles } = useFiles()
  
  if (error) {
    return <ErrorDisplay error={error} />
  }
  
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

### Event Handler Integration
```typescript
// Direct hook integration with components
<FilesList
  files={files}
  onToggleEnabled={toggleFileEnabled}  // Hook function passed directly
  onDeleteFile={deleteFile}            // Hook function passed directly
  isLoading={isLoading}                // Hook state passed directly
/>
```

### Upload Integration
```typescript
// Upload component triggers refresh when complete
<UploadDropzone onUploadComplete={refreshFiles} />

// Hook provides fresh data after uploads
const refreshFiles = useCallback(() => {
  setTimeout(() => fetchFiles(), 0)
}, [fetchFiles])
```

## Testing Strategies

### Mock API Responses
```typescript
// Mock successful response
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      ok: true,
      files: [mockFileData]
    })
  })
)
```

### Hook Testing with React Testing Library
```typescript
import { renderHook, act } from '@testing-library/react'

test('useFiles loads files on mount', async () => {
  const { result } = renderHook(() => useFiles())
  
  expect(result.current.isLoading).toBe(true)
  
  await act(async () => {
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.files).toHaveLength(1)
    })
  })
})
```

### Error Scenario Testing
```typescript
test('useFiles handles API errors gracefully', async () => {
  global.fetch = jest.fn(() => Promise.reject(new Error('Network error')))
  
  const { result } = renderHook(() => useFiles())
  
  await waitFor(() => {
    expect(result.current.error).toBe('Network error')
    expect(result.current.files).toEqual([])
  })
})
```

## Hook Extension Patterns

### Additional Hook Properties
Future enhancements could include:
```typescript
export function useFiles() {
  // Current implementation...
  
  // Potential additions:
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [searchQuery, setSearchQuery] = useState('')
  
  const sortedFiles = useMemo(() => {
    return files
      .filter(file => file.fileName.includes(searchQuery))
      .sort((a, b) => /* sorting logic */)
  }, [files, sortField, sortDirection, searchQuery])
  
  return {
    // Current return values...
    sortField,
    sortDirection,
    searchQuery,
    sortedFiles,
    onSort: setSortField,
    onSearch: setSearchQuery
  }
}
```

---

*This hook encapsulates all file management complexity, providing a clean API for components to consume.*
