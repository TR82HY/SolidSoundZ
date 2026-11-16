'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { baseName, computePeaks, decodeFile, fmt, publishTrack } from '@/lib/audio'
import { GENRES } from '@/lib/genres'
import Waveform from './Waveform'

const input = 'w-full bg-[#111] border border-[#444] focus:border-[#ccff00] rounded px-3 py-2 text-sm text-white outline-none'

export default function UploadForm() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [decoded, setDecoded] = useState<AudioBuffer | null>(null)
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [description, setDescription] = useState('')
  const [art, setArt] = useState<File | null>(null)
  const [artPreview, setArtPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const audioIn = useRef<HTMLInputElement>(null)
  const artIn = useRef<HTMLInputElement>(null)
  const peaks = useMemo(() => decoded ? computePeaks(decoded) : null, [decoded])

  useEffect(() => () => { if (artPreview) URL.revokeObjectURL(artPreview) }, [artPreview])

  const pickAudio = async (f?: File | null) => {
    if (!f?.type.startsWith('audio/')) return
    setFile(f); setTitle(t => t || baseName(f.name)); setError(''); setDecoded(null)
    setDecoded(await decodeFile(f).catch(() => null))
  }
  const pickArt = (f?: File | null) => {
    if (!f || !['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) { setError('Artwork must be JPG, PNG or WEBP'); return }
    if (f.size > 5 * 1024 * 1024) { setError('Artwork must be under 5 MB'); return }
    setArt(f); setArtPreview(URL.createObjectURL(f)); setError('')
  }

  const submit = async (published: boolean) => {
    if (!file || !title.trim()) return
    setBusy(true); setError('')
    const r = await publishTrack(file, { title: title.trim(), genre, description, art, published }, decoded ?? undefined)
    setBusy(false)
    if (!r.ok || !r.url) { setError(r.status === 401 ? 'Please sign in to upload.' : r.error || `Upload failed (${r.status})`); return }
    router.push(published ? r.url : '/you')
  }

  if (!file) {
    return (
      <div onClick={() => audioIn.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); pickAudio(e.dataTransfer.files[0]) }}
        className="rounded-2xl border-2 border-dashed border-[#ccff00]/60 hover:border-[#ccff00] p-16 text-center cursor-pointer">
        <p className="text-2xl font-bold">Drag and drop your track here</p>
        <p className="text-[#ccc] mt-2">or click to choose a file. WAV, FLAC, AIFF or MP3, up to 300 MB.</p>
        <p className="text-sm text-[#999] mt-4">Tip: master it first in the <a href="/studio" onClick={e => e.stopPropagation()} className="text-[#ccff00] underline">Studio</a> for a louder, cleaner release.</p>
        <input ref={audioIn} type="file" accept="audio/*" className="hidden" onChange={e => pickAudio(e.target.files?.[0])} />
      </div>
    )
  }

  return (
    <div className="grid gap-8 md:grid-cols-[260px_1fr]">
      <div>
        <button onClick={() => artIn.current?.click()} className="w-full aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-[#ccff00] via-[#4d5e00] to-[#111] flex items-center justify-center text-black font-bold border border-[#333]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {artPreview ? <img src={artPreview} alt="Artwork preview" className="w-full h-full object-cover" /> : 'Upload artwork'}
        </button>
        <input ref={artIn} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => pickArt(e.target.files?.[0])} />
        <p className="text-xs text-[#999] mt-2">Square image recommended (at least 800×800).</p>
      </div>
      <div className="space-y-4">
        <div className="rounded-lg bg-[#111] border border-[#333] p-3">
          <div className="flex justify-between text-sm"><span className="font-bold truncate">{file.name}</span><span className="text-[#aaa] font-mono">{decoded ? fmt(decoded.duration) : 'reading...'}</span></div>
          <div className="mt-2"><Waveform peaks={peaks} progress={0} height={48} /></div>
          <button onClick={() => { setFile(null); setDecoded(null) }} className="text-xs text-[#aaa] underline mt-1">Replace file</button>
        </div>
        <label className="block text-sm font-bold">Title *<input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} className={`${input} mt-1`} /></label>
        <label className="block text-sm font-bold">Genre
          <select value={genre} onChange={e => setGenre(e.target.value)} className={`${input} mt-1`}>
            <option value="">None</option>
            {GENRES.map(g => <option key={g}>{g}</option>)}
          </select>
        </label>
        <label className="block text-sm font-bold">Description<textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} rows={4} placeholder="Tell listeners about this track" className={`${input} mt-1`} /></label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex flex-wrap gap-3"><button onClick={() => submit(true)} disabled={busy || !title.trim()} className="px-6 py-2.5 rounded-full bg-[#ccff00] text-black font-bold disabled:opacity-40">{busy ? 'Uploading...' : 'Publish now'}</button><button onClick={() => submit(false)} disabled={busy || !title.trim()} className="px-6 py-2.5 rounded-full border border-[#ccff00] text-[#ccff00] font-bold disabled:opacity-40">Save as draft</button></div>
      </div>
    </div>
  )
}
