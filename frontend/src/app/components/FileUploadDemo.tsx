'use client'
import { useState } from 'react'

export default function FileUploadDemo() {
  const [file, setFile] = useState<File | null>(null)
  const [key, setKey] = useState('upload-' + Date.now() + '.pdf')
  const [result, setResult] = useState<{ ok: boolean, preview?: string } | null>(null)
  const base = process.env.NEXT_PUBLIC_API_BASE || ''

  const upload = async () => {
    if (!file) return
    const arrayBuf = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuf).toString('base64')
    const res = await fetch(`${base}/files`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key, content: base64, encoding: 'base64', contentType: file.type || 'application/octet-stream' }) })
    const json = await res.json()
    setResult(json)
  }

  const fetchBack = async () => {
    const res = await fetch(`${base}/files/${encodeURIComponent(key)}`)
    const text = await res.text()
    setResult({ ok: true, preview: text.slice(0, 200) })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input type="file" onChange={e=>setFile(e.target.files?.[0] || null)} />
        <input value={key} onChange={e=>setKey(e.target.value)} className="px-2 py-1 border rounded bg-white text-black" />
        <button onClick={upload} disabled={!file} className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50">Upload</button>
        <button onClick={fetchBack} disabled={!key} className="px-3 py-2 rounded bg-gray-700 text-white disabled:opacity-50">Fetch</button>
      </div>
      <pre className="text-left bg-gray-100 dark:bg-neutral-900 p-3 rounded overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
    </div>
  )
}
