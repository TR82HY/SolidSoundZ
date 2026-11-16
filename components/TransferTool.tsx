'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { baseName, publishTrack } from '@/lib/audio'
import { Panel } from './ui'

type Row = {
  id: string
  importedTrackId?: string
  url?: string
  title: string
  artist?: string
  artwork?: string | null
  file?: File
  scPlays: number
  trackUrl?: string
  status: 'idle' | 'uploading' | 'done' | 'error' | 'signin'
  message?: string
}

const tokens = (s: string) => new Set(s.toLowerCase().replace(/\.[a-z0-9]+$/, '').split(/[^a-z0-9]+/).filter(t => t.length > 1))
function similarity(a: string, b: string) {
  const A = tokens(a), B = tokens(b)
  if (!A.size || !B.size) return 0
  let hit = 0
  A.forEach(t => { if (B.has(t)) hit++ })
  return hit / Math.max(A.size, B.size)
}

export default function TransferTool({ pending = [] }: { pending?: { id: string, title: string, scUrl: string | null, artHref: string | null, scPlays: number }[] }) {
  const router = useRouter()
  const [links, setLinks] = useState('')
  const [rows, setRows] = useState<Row[]>(() => pending.map(track => ({ id: track.id, importedTrackId: track.id, url: track.scUrl ?? undefined, title: track.title, artwork: track.artHref, scPlays: track.scPlays, status: 'idle' })))
  const [fetching, setFetching] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const patch = (id: string, p: Partial<Row>) => setRows(r => r.map(x => x.id === id ? { ...x, ...p } : x))

  const fetchInfo = async () => {
    const urls = Array.from(new Set(links.split(/\s+/).map(s => s.trim()).filter(s => /^https:\/\/(www\.|m\.|on\.)?soundcloud\.com\//i.test(s))))
    if (!urls.length) return
    setFetching(true)
    const fresh = await Promise.all(urls.filter(u => !rows.some(r => r.url === u)).map(async (url): Promise<Row> => {
      try {
        const res = await fetch(`/api/soundcloud/oembed?url=${encodeURIComponent(url)}`)
        const d = await res.json()
        if (!res.ok) return { id: crypto.randomUUID(), url, title: url.split('/').pop() || url, scPlays: 0, status: 'error', message: d.error }
        return { id: crypto.randomUUID(), url, title: d.title, artist: d.artist, artwork: d.artwork, scPlays: 0, status: 'idle' }
      } catch {
        return { id: crypto.randomUUID(), url, title: url, scPlays: 0, status: 'error', message: 'could not reach SoundCloud' }
      }
    }))
    setRows(r => [...r, ...fresh])
    setLinks('')
    setFetching(false)
  }

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const audio = Array.from(files).filter(f => f.type.startsWith('audio/'))
    setRows(current => {
      const next = [...current]
      for (const f of audio) {
        let best = -1, bestScore = 0.3
        next.forEach((r, i) => {
          if (r.file) return
          const s = similarity(f.name, r.title)
          if (s > bestScore) { bestScore = s; best = i }
        })
        if (best >= 0) next[best] = { ...next[best], file: f, status: next[best].status === 'error' ? 'idle' : next[best].status }
        else next.push({ id: crypto.randomUUID(), title: baseName(f.name), file: f, scPlays: 0, status: 'idle' })
      }
      return next
    })
  }

  const importAll = async () => {
    setImporting(true)
    let imported = 0
    for (const r of rows) {
      if (!r.file || r.status === 'done') continue
      patch(r.id, { status: 'uploading', message: undefined })
      try {
        const res = await publishTrack(r.file, { title: r.title, scUrl: r.url, scPlays: r.scPlays, artFromUrl: r.artwork, importedTrackId: r.importedTrackId })
        if (res.status === 401) { patch(r.id, { status: 'signin' }); continue }
        if (res.ok) { imported++; patch(r.id, { status: 'done', trackUrl: res.url }) }
        else patch(r.id, { status: 'error', message: res.error || `upload failed (${res.status})` })
      } catch {
        patch(r.id, { status: 'error', message: 'network error' })
      }
    }
    setImporting(false)
    if (imported) router.refresh()
  }

  const ready = rows.filter(r => r.file && r.status !== 'done').length
  const needsSignIn = rows.some(r => r.status === 'signin')
  const files = rows.map(r => r.file).filter((f): f is File => !!f)

  return (
    <Panel title="MOVE FROM SOUNDCLOUD">
      <p className="text-white font-semibold">Match your original audio files to your SoundCloud tracks.</p>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-[#333] bg-[#1a1a1a] p-3">
          <div className="text-[#ccff00] font-bold text-sm">1. Get your files</div>
          <p className="text-sm text-[#ccc] mt-1">Get your original audio files. SoundCloud does not provide the original audio through account connection.</p>
        </div>
        <div className="rounded-lg border border-[#333] bg-[#1a1a1a] p-3">
          <div className="text-[#ccff00] font-bold text-sm">2. Paste your links</div>
          <p className="text-sm text-[#ccc] mt-1">Connecting SoundCloud brings in your track titles and public stats. You can also paste individual track links below.</p>
        </div>
        <div className="rounded-lg border border-[#333] bg-[#1a1a1a] p-3">
          <div className="text-[#ccff00] font-bold text-sm">3. Drop files and import</div>
          <p className="text-sm text-[#ccc] mt-1">We match files by name. Review the matches before publishing your tracks.</p>
        </div>
      </div>

      <div className="mt-4">
        <textarea value={links} onChange={e => setLinks(e.target.value)} rows={3} placeholder={'https://soundcloud.com/your-name/track-one\nhttps://soundcloud.com/your-name/track-two'}
          className="w-full bg-[#0a0a0a] border border-[#555] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#777] font-mono" />
        <button onClick={fetchInfo} disabled={fetching || !links.trim()} className="mt-2 px-4 py-2 rounded bg-white text-black text-sm font-bold disabled:opacity-40">{fetching ? 'Fetching...' : 'Fetch track info'}</button>
      </div>

      <div onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
        className="mt-4 border-2 border-dashed border-[#ccff00]/60 rounded-xl p-6 text-center cursor-pointer hover:border-[#ccff00]">
        <p className="text-white font-semibold">Drop all your downloaded SoundCloud files here</p>
        <p className="text-sm text-[#ccc] mt-1">Select as many as you like</p>
        <input ref={fileRef} type="file" accept="audio/*" multiple className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
      </div>

      {rows.length > 0 && (
        <div className="mt-4 space-y-2">
          {rows.map(r => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[#444] bg-[#1a1a1a] p-3">
              {r.artwork
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={r.artwork} alt="" className="w-12 h-12 rounded object-cover" />
                : <div className="w-12 h-12 rounded bg-[#333] flex items-center justify-center text-[#ccff00] font-bold">♪</div>}
              <div className="flex-1 min-w-[180px]">
                <input value={r.title} onChange={e => patch(r.id, { title: e.target.value })} className="w-full bg-transparent text-white font-bold text-sm border-b border-transparent focus:border-[#555] outline-none" />
                <div className="text-xs text-[#aaa]">{r.artist ? `${r.artist} • ` : ''}{r.url ? 'from SoundCloud' : 'local file'}</div>
              </div>
              <select value={r.file ? files.indexOf(r.file) : -1} onChange={e => patch(r.id, { file: files[Number(e.target.value)] })}
                className="bg-[#222] border border-[#555] text-white rounded px-2 py-1 text-xs max-w-[220px]">
                <option value={-1}>{r.file ? '' : 'No file matched'}</option>
                {files.map((f, i) => <option key={i} value={i}>{f.name}</option>)}
              </select>
              <label className="text-xs text-[#aaa]">
                SoundCloud plays
                <input type="number" min={0} value={r.scPlays || ''} onChange={e => patch(r.id, { scPlays: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} placeholder="0"
                  className="block w-28 mt-1 bg-[#0a0a0a] border border-[#555] rounded px-2 py-1 text-sm text-white" />
              </label>
              <span className={`text-xs font-bold w-28 ${r.status === 'done' ? 'text-[#ccff00]' : r.status === 'error' ? 'text-red-400' : 'text-[#ccc]'}`}>
                {r.status === 'done' && r.trackUrl ? <a href={r.trackUrl} target="_blank" rel="noopener noreferrer" className="underline">Imported, view</a> : r.status === 'uploading' ? 'Importing...' : r.status === 'signin' ? 'Sign in needed' : r.status === 'error' ? (r.message || 'Error') : r.file ? 'Ready' : 'Needs file'}
              </span>
              {!r.importedTrackId && <button onClick={() => setRows(x => x.filter(y => y.id !== r.id))} className="text-xs text-[#999] hover:text-white">Remove</button>}
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button onClick={importAll} disabled={!ready || importing} className="px-5 py-2 bg-[#ccff00] text-black font-bold rounded disabled:opacity-40">{importing ? 'Importing...' : `Import ${ready} track${ready === 1 ? '' : 's'} to SolidSoundZ`}</button>
            {needsSignIn && (
              <><span className="text-sm text-[#ccc]">Connect SoundCloud to finish the move:</span><a href="/api/soundcloud/connect" className="px-4 py-2 rounded border border-[#ccff00] text-[#ccff00] text-sm font-bold">Connect SoundCloud</a></>
            )}
          </div>
        </div>
      )}
    </Panel>
  )
}
