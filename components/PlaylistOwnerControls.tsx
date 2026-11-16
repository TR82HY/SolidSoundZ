'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function PlaylistOwnerControls({ playlistId, title, description }: { playlistId: string, title: string, description: string | null }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ title, description: description ?? '' })

  const save = async () => {
    setBusy(true)
    const res = await fetch(`/api/playlists/${playlistId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setBusy(false)
    if (res.ok) { setEditing(false); router.refresh() }
  }

  const remove = async () => {
    if (!confirm(`Delete the playlist "${title}"? This can't be undone.`)) return
    const res = await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE' })
    if (res.ok) router.push('/you')
  }

  if (!editing) {
    return (
      <div className="flex gap-2">
        <button onClick={() => setEditing(true)} className="px-4 py-2 text-sm rounded border border-[#555] text-[#ddd] hover:border-[#999] font-bold">Edit playlist</button>
        <button onClick={remove} className="px-4 py-2 text-sm rounded border border-red-900 text-red-400 hover:border-red-500 font-bold">Delete playlist</button>
      </div>
    )
  }

  return (
    <div className="max-w-xl rounded-lg border border-[#444] bg-[#141414] p-4 space-y-3">
      <label className="block text-sm font-bold">Title
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} maxLength={120} className="mt-1 w-full bg-[#0a0a0a] border border-[#444] rounded px-3 py-2 text-sm" />
      </label>
      <label className="block text-sm font-bold">Description
        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} maxLength={2000} rows={3} className="mt-1 w-full bg-[#0a0a0a] border border-[#444] rounded px-3 py-2 text-sm" />
      </label>
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="px-4 py-2 rounded bg-[#ccff00] text-black text-sm font-bold disabled:opacity-40">Save</button>
        <button onClick={() => setEditing(false)} className="px-4 py-2 rounded border border-[#555] text-sm font-bold">Cancel</button>
      </div>
    </div>
  )
}
