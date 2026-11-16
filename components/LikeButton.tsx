'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { usePlayer } from './player/PlayerProvider'
import { compact } from '@/lib/format'

export default function LikeButton({ trackId, liked: initialLiked, likes: initialLikes, baseline = 0, size = 'sm' }: { trackId: string, liked: boolean, likes: number, baseline?: number, size?: 'sm' | 'lg' }) {
  const [liked, setLiked] = useState(initialLiked)
  const [likes, setLikes] = useState(initialLikes)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const errorId = useId()
  const player = usePlayer()

  useEffect(() => {
    if (!pending.current) { setLiked(initialLiked); setLikes(initialLikes) }
  }, [trackId, initialLiked, initialLikes])

  const toggle = async () => {
    if (pending.current) return
    pending.current = true
    setBusy(true); setError('')
    setLiked(!liked); setLikes(Math.max(0, likes + (liked ? -1 : 1)))
    try {
      const res = await fetch(`/api/tracks/${trackId}/like`, { method: 'POST' })
      if (!res.ok) throw new Error('Like request failed')
      const data: unknown = await res.json()
      if (!data || typeof data !== 'object' || !('liked' in data) || typeof data.liked !== 'boolean'
        || !('likes' in data) || typeof data.likes !== 'number' || !Number.isSafeInteger(data.likes) || data.likes < 0) throw new Error('Invalid like response')
      setLiked(data.liked); setLikes(data.likes)
      if (player.current?.id === trackId) player.setLiked(trackId, data.liked, data.likes)
    } catch {
      setLiked(liked); setLikes(likes)
      setError('Could not confirm your like. Refresh to check its status before retrying.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return (
    <div className="inline-flex max-w-full flex-col items-start gap-1">
      <button onClick={toggle} disabled={busy} aria-busy={busy} aria-pressed={liked} aria-describedby={error ? errorId : undefined} title={liked ? 'Remove your like' : 'Save a like for this track'}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded border font-bold disabled:opacity-50 ${size === 'lg' ? 'min-h-11 px-4 py-2 text-sm' : 'min-h-9 px-2.5 py-1 text-xs'} ${liked ? 'border-[#ccff00] text-[#ccff00] bg-[#ccff00]/10' : 'border-[#555] text-[#ddd] hover:border-[#999]'}`}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className={size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}><path d="M12 21s-7-4.35-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.65-9.5 9-9.5 9z" /></svg>
        <span>{liked ? 'Liked' : 'Like'}</span><span>{compact(likes + baseline)}</span>
      </button>
      {error && <p id={errorId} role="alert" className="max-w-60 text-xs leading-relaxed text-[#ff9d89]">{error}</p>}
    </div>
  )
}
