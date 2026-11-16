'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function CreatePlaylistButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const create = async () => {
    if (!title.trim()) return
    setBusy(true)
    const res = await fetch('/api/playlists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim() }) })
    const d = await res.json()
    setBusy(false)
    if (res.ok) { setOpen(false); setTitle(''); router.push(`/playlist/${d.playlist.id}`) }
  }

  if (!open) return <button onClick={() => setOpen(true)} className="px-3 py-1.5 rounded-full bg-[#ccff00] text-black text-xs font-bold">New playlist</button>

  return (
    <div className="flex gap-2">
      <input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') create() }} placeholder="Playlist name" maxLength={120}
        className="bg-[#0a0a0a] border border-[#444] rounded px-3 py-1.5 text-sm" autoFocus />
      <button onClick={create} disabled={busy} className="px-3 py-1.5 rounded bg-[#ccff00] text-black text-xs font-bold disabled:opacity-40">Create</button>
      <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded border border-[#555] text-xs font-bold">Cancel</button>
    </div>
  )
}
