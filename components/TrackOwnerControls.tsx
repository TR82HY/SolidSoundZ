'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { GENRES } from '@/lib/genres'
import { MUSIC_PLATFORMS, parseMusicLink } from '@/lib/musicLinks'

type Props = { trackId: string, title: string, description: string | null, genre: string | null, downloadable: boolean, published: boolean, appleMusicUrl?: string | null, spotifyUrl?: string | null }

export default function TrackOwnerControls({ trackId, title, description, genre, downloadable, published, appleMusicUrl, spotifyUrl }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const initialForm = () => ({ title, description: description ?? '', genre: genre ?? '', downloadable, appleMusicUrl: appleMusicUrl ?? '', spotifyUrl: spotifyUrl ?? '' })
  const [form, setForm] = useState(initialForm)
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])

  const mutate = async (method: 'PATCH' | 'DELETE', body?: object, done?: () => void) => {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setBusy(true); setError(''); setSaved(false)
    try {
      const response = await fetch(`/api/tracks/${trackId}`, { method, signal: controller.signal,
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      })
      const data: unknown = await response.json()
      if (!response.ok) throw new Error(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'The track could not be updated. Please retry.')
      if (!data || typeof data !== 'object' || !('ok' in data) || data.ok !== true) throw new Error('The change could not be confirmed. Reload this track before trying again.')
      if (!controller.signal.aborted) done?.()
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'The request failed. Your changes are still here.')
    } finally {
      if (pending.current === controller) pending.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }
  const save = () => {
    try {
      const links = { appleMusicUrl: parseMusicLink(form.appleMusicUrl, 'appleMusic'), spotifyUrl: parseMusicLink(form.spotifyUrl, 'spotify') }
      void mutate('PATCH', { ...form, ...links }, () => { setEditing(false); setSaved(true); router.refresh() })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Check the music service links.')
    }
  }

  const remove = () => {
    if (pending.current) return
    if (!confirm(`Delete "${title}"? This can't be undone.`)) return
    void mutate('DELETE', undefined, () => router.push('/you'))
  }
  const setRelease = () => void mutate('PATCH', { published: !published }, () => published ? router.push('/you') : router.refresh())

  if (!editing) {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => { setForm(initialForm()); setError(''); setSaved(false); setEditing(true) }} disabled={busy} className="min-h-11 px-4 py-2 text-sm rounded border border-[#555] text-[#ddd] hover:border-[#999] font-bold disabled:opacity-40">Edit track</button>
          <button onClick={setRelease} disabled={busy} className="min-h-11 px-4 py-2 text-sm rounded border border-[#d8ff16] text-[#d8ff16] hover:bg-[#d8ff16] hover:text-black font-bold disabled:opacity-40">{published ? 'Unrelease' : 'Release'}</button>
          <button onClick={remove} disabled={busy} className="min-h-11 px-4 py-2 text-sm rounded border border-red-900 text-red-400 hover:border-red-500 font-bold disabled:opacity-40">Delete</button>
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-[#ffb9a8]">{error}</p>}
        {saved && <p role="status" className="mt-2 text-sm text-[#d8ff16]">Track changes saved.</p>}
      </div>
    )
  }

  return (
    <form onSubmit={event => { event.preventDefault(); save() }} className="w-full max-w-3xl rounded-lg border border-[#444] bg-[#141414] p-4">
      <fieldset disabled={busy} className="min-w-0 space-y-3">
      <legend className="sr-only">Edit track and music platform links</legend>
      <label className="block text-sm font-bold">Title
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required maxLength={120} className="mt-1 w-full bg-[#0a0a0a] border border-[#444] rounded px-3 py-2 text-sm" />
      </label>
      <div className="space-y-3 border-t border-[#444] pt-3">
        <h3 className="text-lg text-[#d8ff16]">Music platform links</h3>
        <p id={`music-links-help-${trackId}`} className="text-xs leading-relaxed text-[#aaa]">Paste each service&apos;s exact song link. Leave a field blank to show a labeled Search button using this track&apos;s title and artist. These links never change your audio.</p>
        {(['appleMusicUrl', 'spotifyUrl'] as const).map(field => {
          const platform = field === 'appleMusicUrl' ? 'appleMusic' : 'spotify'
          return <label key={field} className="block text-sm font-bold">{MUSIC_PLATFORMS[platform].name} song URL (optional)
            <input type="url" value={form[field]} onChange={event => setForm(current => ({ ...current, [field]: event.target.value }))} maxLength={2000}
              placeholder={MUSIC_PLATFORMS[platform].placeholder} aria-describedby={`music-links-help-${trackId}`} autoComplete="off" spellCheck={false}
              className="mt-1 min-h-11 w-full rounded border border-[#444] bg-[#0a0a0a] px-3 py-2 text-sm font-normal placeholder:text-[#888]" />
          </label>
        })}
      </div>
      <label className="block text-sm font-bold">Genre
        <select value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))} className="mt-1 w-full bg-[#0a0a0a] border border-[#444] rounded px-3 py-2 text-sm">
          <option value="">None</option>
          {GENRES.map(g => <option key={g}>{g}</option>)}
        </select>
      </label>
      <label className="block text-sm font-bold">Description
        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} maxLength={2000} rows={3} className="mt-1 w-full bg-[#0a0a0a] border border-[#444] rounded px-3 py-2 text-sm" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.downloadable} onChange={e => setForm(f => ({ ...f, downloadable: e.target.checked }))} className="accent-[#ccff00]" />
        Let listeners download this track
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !form.title.trim()} className="min-h-11 px-4 py-2 rounded bg-[#ccff00] text-black text-sm font-bold disabled:opacity-40">{busy ? 'Saving...' : 'Save'}</button>
        <button type="button" onClick={() => { setEditing(false); setError('') }} className="min-h-11 px-4 py-2 rounded border border-[#555] text-sm font-bold">Cancel</button>
      </div>
      </fieldset>
      {error && <p role="alert" className="mt-3 text-sm text-[#ffb9a8]">{error}</p>}
    </form>
  )
}
