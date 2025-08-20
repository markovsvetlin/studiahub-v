'use client'
import UploadDropzone from './components/UploadDropzone'
import FilesList from './components/FilesList'
import { useFiles } from '@/hooks/useFiles'

export default function Home() {
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
  const { files, isLoading, error, toggleFileEnabled, deleteFile, refreshFiles } = useFiles()

  if (error) {
    return (
      <div className="max-w-4xl w-full p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-center">
        Error loading files: {error}
      </div>
    )
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
