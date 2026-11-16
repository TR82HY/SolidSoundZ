'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import ActionPopover from './ActionPopover'

type Playlist = { id: string, title: string, _count: { tracks: number } }

function isPlaylist(value: unknown): value is Playlist {
  return !!value && typeof value === 'object'
    && 'id' in value && typeof value.id === 'string'
    && 'title' in value && typeof value.title === 'string'
    && '_count' in value && !!value._count && typeof value._count === 'object'
    && 'tracks' in value._count && typeof value._count.tracks === 'number' && Number.isSafeInteger(value._count.tracks) && value._count.tracks >= 0
}

export default function AddToPlaylistButton({ trackId, size = 'sm' }: { trackId: string, size?: 'sm' | 'lg' }) {
  const [open, setOpen] = useState(false)
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null)
  const [error, setError] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [revision, setRevision] = useState(0)
  const [signedOut, setSignedOut] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const pending = useRef(false)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setLoading(true); setError(''); setStatus(''); setSignedOut(false); setPlaylists(null); setAdded(new Set())
    const load = async () => {
      try {
        const response = await fetch('/api/playlists', { cache: 'no-store', signal: controller.signal })
        if (response.status === 401) {
          if (!controller.signal.aborted) setSignedOut(true)
          return
        }
        if (!response.ok) throw new Error('Could not load your playlists. Please retry.')
        const data: unknown = await response.json()
        if (!data || typeof data !== 'object' || !('playlists' in data) || !Array.isArray(data.playlists) || !data.playlists.every(isPlaylist)) throw new Error('The playlist response was incomplete. Please retry.')
        if (!controller.signal.aborted) setPlaylists(data.playlists)
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not load your playlists. Please retry.')
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [open, revision])

  const addTo = async (playlistId: string) => {
    if (pending.current || added.has(playlistId)) return
    pending.current = true
    setBusy(playlistId); setError(''); setStatus('')
    try {
      const response = await fetch(`/api/playlists/${playlistId}/tracks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trackId }) })
      if (response.status === 401) { setSignedOut(true); throw new Error('Sign in again to add this track.') }
      if (!response.ok) throw new Error('Could not add this track. Please retry.')
      const data: unknown = await response.json()
      if (!data || typeof data !== 'object' || !('ok' in data) || data.ok !== true) throw new Error('The addition could not be confirmed. Refresh your playlists to check.')
      setAdded(current => new Set(current).add(playlistId))
      setStatus('Track saved to your playlist.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not add this track. Please retry.')
    } finally { pending.current = false; setBusy(null) }
  }

  const create = async () => {
    if (pending.current) return
    if (!newTitle.trim()) { setError('Enter a name for your playlist.'); return }
    pending.current = true
    setBusy('create'); setError(''); setStatus('')
    try {
      const response = await fetch('/api/playlists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTitle.trim(), trackId }) })
      if (response.status === 401) { setSignedOut(true); throw new Error('Sign in again to create a playlist.') }
      if (!response.ok) throw new Error('Could not create the playlist. Your name has been kept so you can retry.')
      const data: unknown = await response.json()
      const playlist = data && typeof data === 'object' && 'playlist' in data ? data.playlist : null
      if (!isPlaylist(playlist) || playlist._count.tracks !== 1) throw new Error('The new playlist could not be confirmed. Refresh your playlists before creating another.')
      const saved = playlist
      setPlaylists(current => [saved, ...(current ?? [])])
      setAdded(current => new Set(current).add(saved.id))
      setNewTitle(''); setStatus('Playlist created with this track.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not create the playlist. Your name has been kept.')
    } finally { pending.current = false; setBusy(null) }
  }

  return <ActionPopover label="+ Playlist" title="Add to playlist" description="Save this track to a collection, or start a new playlist with it." open={open} onOpenChange={setOpen} size={size}>
    {loading && <p role="status" className="text-sm text-[#bbb]">Loading your playlists...</p>}
    {error && <p role="alert" className="mb-3 text-sm text-[#ff9d89]">{error}</p>}
    {signedOut && <p className="mb-3 text-sm text-[#bbb]"><Link href="/sign-in" className="font-bold text-[#d8ff16] underline">Sign in</Link> to create playlists and save tracks.</p>}
    {!loading && <button type="button" disabled={busy !== null} onClick={() => setRevision(value => value + 1)} className="mb-3 min-h-9 text-xs font-bold text-[#ccc] underline disabled:opacity-40">{playlists ? 'Refresh playlists' : 'Retry playlists'}</button>}
    {!signedOut && playlists && <>
      <div className="max-h-52 space-y-1 overflow-y-auto">
        {playlists.map(playlist => <button type="button" key={playlist.id} onClick={() => addTo(playlist.id)} disabled={busy !== null || added.has(playlist.id)}
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded px-2 py-2 text-left text-sm hover:bg-[#262e25] disabled:opacity-50">
          <span className="min-w-0 break-words">{playlist.title}</span>
          <span className="shrink-0 text-xs text-[#aeb8ab]">{busy === playlist.id ? 'Adding...' : added.has(playlist.id) ? 'Added' : `${playlist._count.tracks} tracks`}</span>
        </button>)}
        {!playlists.length && <p className="py-2 text-sm text-[#bbb]">No playlists yet. Create your first one below.</p>}
      </div>
      <form onSubmit={event => { event.preventDefault(); void create() }} className="mt-3 space-y-2 border-t border-[#394039] pt-3">
        <label className="block text-xs font-bold text-[#ccc]">New playlist name
          <input value={newTitle} onChange={event => setNewTitle(event.target.value)} required disabled={busy !== null} maxLength={120} placeholder="For example, Late-night favorites"
            className="mt-1 min-h-10 w-full rounded border border-[#586055] bg-[#090d09] px-2 py-2 text-sm text-white placeholder:text-[#899185] disabled:opacity-50" />
        </label>
        <button type="submit" disabled={busy !== null || !newTitle.trim()} className="min-h-10 rounded bg-[#d8ff16] px-3 py-2 text-sm font-bold text-black disabled:opacity-50">{busy === 'create' ? 'Creating...' : 'Create & add track'}</button>
      </form>
    </>}
    {status && <p role="status" className="mt-3 text-sm text-[#d8ff16]">{status}</p>}
  </ActionPopover>
}
