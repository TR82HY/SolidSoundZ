'use client'
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import type { TrackCardData } from '@/lib/queries'
import { fmt } from '@/lib/audio'
import { compact } from '@/lib/format'
import { usePlayer, usePlayerTime } from './player/PlayerProvider'
import { Artwork, PlayButton } from './TrackCard'
import Waveform from './Waveform'
import LikeButton from './LikeButton'
import ShareMenu from './ShareMenu'
import RepostButton from './RepostButton'
import AddToPlaylistButton from './AddToPlaylistButton'
import SupportArtistButton from './SupportArtistButton'
import TrackOwnerControls from './TrackOwnerControls'
import { TrackList } from './TrackCard'
import RelativeTime from './RelativeTime'
import MusicPlatformLinks from './MusicPlatformLinks'
import SoundCloudStats from './SoundCloudStats'

type Comment = { id: string, userId: string | null, name: string, text: string, timestampMs: number, createdAt: string, user: { handle: string, slug: string } | null }

function isComment(value: unknown): value is Comment {
  return !!value && typeof value === 'object'
    && 'id' in value && typeof value.id === 'string'
    && 'userId' in value && (value.userId === null || typeof value.userId === 'string')
    && 'name' in value && typeof value.name === 'string'
    && 'text' in value && typeof value.text === 'string'
    && 'timestampMs' in value && typeof value.timestampMs === 'number' && Number.isSafeInteger(value.timestampMs) && value.timestampMs >= 0
    && 'createdAt' in value && typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt))
    && 'user' in value && (value.user === null || !!value.user && typeof value.user === 'object'
      && 'handle' in value.user && typeof value.user.handle === 'string' && 'slug' in value.user && typeof value.user.slug === 'string')
}

type Props = {
  t: TrackCardData, description: string | null, scUrl: string | null, comments: Comment[],
  isOwner: boolean, related: TrackCardData[],
}

export default function TrackView({ t, description, scUrl, comments: initial, isOwner, related }: Props) {
  const player = usePlayer()
  const { time, duration } = usePlayerTime()
  const [comments, setComments] = useState(initial)
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [nameWarning, setNameWarning] = useState('')
  const pending = useRef(false)
  const formId = useId()
  useEffect(() => {
    try { setName(localStorage.getItem('ssz-name') ?? '') }
    catch { setNameWarning('This browser cannot remember your display name. You can still comment.') }
  }, [])
  const isCurrent = player.current?.id === t.id
  const playing = isCurrent && player.playing
  const d = isCurrent ? duration || t.duration : t.duration
  const now = isCurrent ? time : 0

  const post = async () => {
    if (pending.current) return
    if (!text.trim()) { setError('Write a comment before posting.'); return }
    pending.current = true
    setPosting(true); setError(''); setStatus('')
    try { localStorage.setItem('ssz-name', name) }
    catch { setNameWarning('This browser cannot remember your display name. You can still comment.') }
    try {
      const response = await fetch(`/api/tracks/${t.id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text.trim(), name, t: now }) })
      if (!response.ok) throw new Error('Comment request failed')
      const comment: unknown = await response.json()
      if (!isComment(comment)) throw new Error('Invalid comment response')
      setComments(current => current.some(item => item.id === comment.id) ? current : [...current, comment].sort((a, b) => a.timestampMs - b.timestampMs))
      setText(''); setStatus(`Comment posted at ${fmt(comment.timestampMs / 1000)}.`)
    } catch {
      setError('Your comment could not be confirmed. Your text is still here; check the comments before retrying.')
    } finally { pending.current = false; setPosting(false) }
  }

  const jump = (secs: number) => isCurrent ? player.seek(secs) : player.play(t, [t], secs)

  return (
    <div className="space-y-8">
      <section className="rounded-2xl p-4 sm:p-6 bg-gradient-to-br from-[#1f2600] via-[#121212] to-[#0a0a0a] border border-[#333] flex flex-col-reverse md:flex-row gap-6">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start gap-4">
            <PlayButton size="lg" title={t.title} playing={playing} onClick={() => playing ? player.pause() : player.play(t, [t])} />
            <div className="min-w-0">
              <Link href={`/artist/${t.artistSlug}`} className="inline-block max-w-full break-words bg-black/60 px-2 py-0.5 text-[#ccc] hover:text-white">{t.artist}</Link>
              <h1 className="mt-1 inline-block max-w-full break-words bg-black/60 px-2 py-1 text-2xl sm:text-3xl font-bold">{t.title}</h1>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#aaa]">
                <RelativeTime value={t.createdAt} />
                {t.genre && <Link href={`/search?genre=${encodeURIComponent(t.genre)}`} className="px-2 py-0.5 rounded-full bg-[#222] text-[#ddd]">#{t.genre}</Link>}
              </div>
            </div>
          </div>
          <div className="mt-auto pt-8">
            <Waveform peaks={t.peaks} waveformUrl={t.waveformUrl} seed={t.id} height={100} active={isCurrent} progress={d ? now / d : 0}
              seekLabel={`Playback position for ${t.title}`} duration={d}
              markers={comments.map(c => c.timestampMs / 1000 / (d || 1))} onSeek={f => jump(f * d)} />
            <div className="flex justify-between font-mono text-xs text-[#aaa] mt-1"><span>{fmt(now)}</span><span>{fmt(d)}</span></div>
            <p className="mt-2 text-xs text-[#999]">Drag or use arrow keys to seek. Hold Shift for 10-second steps.</p>
          </div>
        </div>
        <Artwork url={t.artUrl} title={t.title} size="lg" />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <LikeButton trackId={t.id} liked={t.liked} likes={t.likes} baseline={t.scLikes} size="lg" />
        <RepostButton trackId={t.id} reposted={t.reposted} reposts={t.reposts} baseline={t.scReposts} size="lg" />
        <AddToPlaylistButton trackId={t.id} size="lg" />
        <ShareMenu trackId={t.id} title={t.title} artist={t.artist} size="lg" />
        <MusicPlatformLinks appleMusicUrl={t.appleMusicUrl} spotifyUrl={t.spotifyUrl} title={t.title} artist={t.artist} size="lg" />
        <SupportArtistButton trackId={t.id} />
        {t.downloadable && <a href={`/api/tracks/${t.id}/download`} className="px-4 py-2 text-sm rounded border border-[#555] text-[#ddd] hover:border-[#999] font-bold">Download</a>}
        <div className="ml-auto flex max-w-full flex-wrap gap-x-4 gap-y-2 text-sm text-[#ccc]">
          <span><b className="text-white">{compact(t.plays)}</b> SolidSoundZ plays</span>
          <span><b className="text-white">{compact(comments.length)}</b> comments here</span>
        </div>
        <SoundCloudStats track={t} detailed />
      </div>

      {isOwner && <TrackOwnerControls trackId={t.id} title={t.title} description={description} genre={t.genre} downloadable={t.downloadable} published={t.published} appleMusicUrl={t.appleMusicUrl} spotifyUrl={t.spotifyUrl} />}

      {description && <p className="whitespace-pre-line break-words text-[#ddd] max-w-3xl">{description}</p>}

      <section id="comments" aria-labelledby={`${formId}-heading`} className="max-w-3xl scroll-mt-48">
        <h2 id={`${formId}-heading`} className="text-2xl text-[#d8ff16]">Join the conversation</h2>
        <p className="mt-1 text-sm text-[#aaa]">Comments are public and attached to a moment in the track.</p>
        <form onSubmit={event => { event.preventDefault(); void post() }} className="mt-4 space-y-3 rounded-xl border border-[#394039] bg-[#111511] p-4">
          <div>
            <label htmlFor={`${formId}-name`} className="block text-xs font-bold text-[#ccc]">Display name (optional)</label>
            <input id={`${formId}-name`} value={name} onChange={e => setName(e.target.value)} disabled={posting} autoComplete="nickname" aria-describedby={`${formId}-name-help`} placeholder="Listener" maxLength={40} className="mt-1 min-h-11 w-full rounded border border-[#555] bg-[#090d09] px-3 py-2 text-sm placeholder:text-[#888] sm:max-w-xs disabled:opacity-50" />
            <p id={`${formId}-name-help`} className="mt-1 text-xs text-[#999]">Signed-in comments use your artist name.</p>
          </div>
          <div>
            <label htmlFor={`${formId}-text`} className="block text-xs font-bold text-[#ccc]">Your comment</label>
            <textarea id={`${formId}-text`} value={text} onChange={e => setText(e.target.value)} required disabled={posting} rows={3} maxLength={300} aria-describedby={`${formId}-comment-help`}
              placeholder="What stands out to you?" className="mt-1 w-full resize-y rounded border border-[#555] bg-[#090d09] px-3 py-2 text-sm placeholder:text-[#888] disabled:opacity-50" />
            <p id={`${formId}-comment-help`} className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-[#aaa]"><span>Posting at {fmt(now)}. Seek first to choose another moment.</span><span>{text.length}/300</span></p>
          </div>
          {nameWarning && <p role="status" className="text-xs text-[#ffcf79]">{nameWarning}</p>}
          {error && <p role="alert" className="text-sm text-[#ff9d89]">{error}</p>}
          {status && <p role="status" className="text-sm text-[#d8ff16]">{status}</p>}
          <button type="submit" disabled={posting || !text.trim()} aria-busy={posting} className="min-h-11 rounded bg-white px-4 py-2 text-sm font-bold text-black disabled:opacity-50">{posting ? 'Posting...' : 'Post comment'}</button>
        </form>
        <div className="mt-4 divide-y divide-[#222]">
          {comments.map(c => (
            <div key={c.id} className="py-3 flex gap-3">
              <span className="w-9 h-9 rounded-full bg-[#222] flex items-center justify-center font-bold text-[#ccff00] flex-shrink-0">{c.name.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0">
                <div className="break-words text-sm">{c.user ? <Link href={`/artist/${c.user.slug}`} className="font-bold hover:text-[#d8ff16]">{c.user.handle}</Link> : <b>{c.name}</b>} <span className="text-[#888]">at</span> <button onClick={() => jump(c.timestampMs / 1000)} aria-label={`Seek to ${fmt(c.timestampMs / 1000)} for this comment`} className="font-mono text-[#ccff00] hover:underline">{fmt(c.timestampMs / 1000)}</button></div>
                <p className="text-sm text-[#ddd] break-words">{c.text}</p>
                <p className="mt-1 text-xs text-[#999]"><RelativeTime value={c.createdAt} /></p>
              </div>
            </div>
          ))}
          {!comments.length && <p className="py-4 text-sm text-[#888]">No comments yet. Be the first!</p>}
        </div>
      </section>

      {related.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-1">Related tracks</h2>
          <TrackList tracks={related} />
        </section>
      )}
    </div>
  )
}
