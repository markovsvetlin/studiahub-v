import ItemDemo from '../components/ItemDemo'
import FileUploadDemo from '../components/FileUploadDemo'

export default function TestPage() {
  return (
    <main className="min-h-screen p-8 space-y-10">
      <h1 className="text-2xl font-bold">Test</h1>
      <section>
        <h2 className="text-xl font-semibold mb-2">DB checker</h2>
        <ItemDemo />
      </section>
      <section>
        <h2 className="text-xl font-semibold mb-2">File uploader</h2>
        <FileUploadDemo />
      </section>
    </main>
  )
}


