'use client'
import { useState } from 'react'

export default function ItemDemo() {
  const [creating, setCreating] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [result, setResult] = useState<{ ok: boolean, item?: { id: string, name: string, createdAt: string } } | null>(null)
  const [id, setId] = useState('')
  const base = process.env.NEXT_PUBLIC_API_BASE || 'https://oyehv715ef.execute-api.us-east-1.amazonaws.com'

  const createItem = async () => {
    setCreating(true)
    try {
      const res = await fetch(`${base}/items`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'demo' }) })
      const json = await res.json()
      setResult(json)
      setId(json?.item?.id || '')
    } finally { setCreating(false) }
  }

  const getItem = async () => {
    if (!id) return
    setFetching(true)
    try {
      const res = await fetch(`${base}/items/${id}`)
      const json = await res.json()
      setResult(json)
    } finally { setFetching(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={createItem} disabled={creating} className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50">{creating ? 'Creating…' : 'Create Item'}</button>
        <input value={id} onChange={e=>setId(e.target.value)} placeholder="Item ID" className="px-2 py-2 border rounded bg-white text-black" />
        <button onClick={getItem} disabled={!id || fetching} className="px-3 py-2 rounded bg-gray-700 text-white disabled:opacity-50">{fetching ? 'Fetching…' : 'Get Item'}</button>
      </div>
      <pre className="text-left bg-gray-100 dark:bg-neutral-900 p-3 rounded overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
    </div>
  )
}
