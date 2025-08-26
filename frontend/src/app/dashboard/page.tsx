'use client'
import UploadDropzone from '../components/UploadDropzone'
import FilesList from '../components/FilesList'
import UsageCard from '@/components/usage/UsageCard'
import { UsageProvider } from '@/contexts/UsageContext'
import { useFiles } from '@/hooks/useFiles'
import { useUsage } from '@/hooks/useUsage'
import { useUser } from '@clerk/nextjs'

export default function Dashboard() {
  return (
    <main className="min-h-screen p-8 space-y-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI-Powered Learning Hub</h1>
      </header>

      <section className="space-y-8">
        <MainContent />
      </section>
    </main>
  )
}

function MainContent() {
  const { user } = useUser()
  const { usage, isLoading: usageLoading, error: usageError, refreshUsage } = useUsage(user?.id)
  const { files, isLoading, error, toggleFileEnabled, deleteFile, refreshFiles } = useFiles(user?.id)

  const handleUploadComplete = () => {
    refreshFiles()
    refreshUsage() // Refresh usage after file upload
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-center">
        Please sign in to upload and manage files
      </div>
    )
  }

  return (
    <UsageProvider refreshUsage={refreshUsage}>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Left side - Usage Card */}
          <div className="lg:w-80 w-full flex-shrink-0">
            <UsageCard usage={usage} isLoading={usageLoading} error={usageError} />
          </div>
          
          {/* Center - Main Content */}
          <div className="flex-1 flex flex-col items-center space-y-8 max-w-4xl mx-auto">
            {error ? (
              <div className="w-full p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-center">
                Error loading files: {error}
              </div>
            ) : (
              <>
                <UploadDropzone userId={user.id} onUploadComplete={handleUploadComplete} />
                <FilesList
                  files={files}
                  onToggleEnabled={toggleFileEnabled}
                  onDeleteFile={deleteFile}
                  isLoading={isLoading}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </UsageProvider>
  )
}

