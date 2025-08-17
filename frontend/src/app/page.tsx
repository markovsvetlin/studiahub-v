import UploadDropzone from './components/UploadDropzone'

export default function Home() {
  return (
    <main className="min-h-screen p-8 space-y-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI-Powered Learning Hub</h1>
      </header>

      <section className="space-y-3 flex justify-center">
   
        <UploadDropzone />
      </section>
    </main>
  )
}
