'use client'
import UploadDropzone from '../components/UploadDropzone'
import FilesList from '../components/FilesList'
import { useFiles } from '@/hooks/useFiles'
import { useUser } from '@clerk/nextjs'

export default function Dashboard() {
  return (
    <main className="min-h-screen p-8 space-y-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI-Powered Learning Hub</h1>
      </header>

      <section className="space-y-8 flex flex-col items-center">
        <FilesSection />
      </section>
    </main>
  )
}

function FilesSection() {
  const { user } = useUser()
  const { files, isLoading, error, toggleFileEnabled, deleteFile, refreshFiles } = useFiles(user?.id)

  if (!user) {
    return (
      <div className="max-w-4xl w-full p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-center">
        Please sign in to upload and manage files
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl w-full p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-center">
        Error loading files: {error}
      </div>
    )
  }

  return (
    <>
      <UploadDropzone userId={user.id} onUploadComplete={refreshFiles} />
      <FilesList
        files={files}
        onToggleEnabled={toggleFileEnabled}
        onDeleteFile={deleteFile}
        isLoading={isLoading}
      />
    </>
  )
}
