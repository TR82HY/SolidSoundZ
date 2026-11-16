'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { compact } from '@/lib/format'

export default function RepostButton({ trackId, reposted: initial, reposts: initialCount, baseline = 0, size = 'sm' }: { trackId: string, reposted: boolean, reposts: number, baseline?: number, size?: 'sm' | 'lg' }) {
  const [reposted, setReposted] = useState(initial)
  const [reposts, setReposts] = useState(initialCount)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const errorId = useId()

  useEffect(() => {
    if (!pending.current) { setReposted(initial); setReposts(initialCount) }
  }, [trackId, initial, initialCount])

  const toggle = async () => {
    if (pending.current) return
    pending.current = true
    setBusy(true); setError('')
    setReposted(!reposted); setReposts(Math.max(0, reposts + (reposted ? -1 : 1)))
    try {
      const res = await fetch(`/api/tracks/${trackId}/repost`, { method: 'POST' })
      if (!res.ok) throw new Error('Repost request failed')
      const data: unknown = await res.json()
      if (!data || typeof data !== 'object' || !('reposted' in data) || typeof data.reposted !== 'boolean'
        || !('reposts' in data) || typeof data.reposts !== 'number' || !Number.isSafeInteger(data.reposts) || data.reposts < 0) throw new Error('Invalid repost response')
      setReposted(data.reposted); setReposts(data.reposts)
    } catch {
      setReposted(reposted); setReposts(reposts)
      setError('Could not confirm your repost. Refresh to check its status before retrying.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return (
    <div className="inline-flex max-w-full flex-col items-start gap-1">
      <button onClick={toggle} disabled={busy} aria-busy={busy} aria-pressed={reposted} aria-describedby={error ? errorId : undefined} title={reposted ? 'Remove repost' : 'Repost to your followers'}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded border font-bold disabled:opacity-50 ${size === 'lg' ? 'min-h-11 px-4 py-2 text-sm' : 'min-h-9 px-2.5 py-1 text-xs'} ${reposted ? 'border-[#00e0c6] text-[#00e0c6] bg-[#00e0c6]/10' : 'border-[#555] text-[#ddd] hover:border-[#999]'}`}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className={size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 7h13l-3-3m3 3l-3 3M20 17H7l3 3m-3-3l3-3" /></svg>
        <span>{reposted ? 'Reposted' : 'Repost'}</span><span>{compact(reposts + baseline)}</span>
      </button>
      {error && <p id={errorId} role="alert" className="max-w-60 text-xs leading-relaxed text-[#ff9d89]">{error}</p>}
    </div>
  )
}
