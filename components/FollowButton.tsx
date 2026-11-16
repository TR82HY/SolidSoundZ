'use client'
import { useState } from 'react'
import { compact } from '@/lib/format'

export default function FollowButton({ slug, following: initial, followers: initialCount, self = false }: { slug: string, following: boolean, followers: number, self?: boolean }) {
  const [following, setFollowing] = useState(initial)
  const [followers, setFollowers] = useState(initialCount)
  const [busy, setBusy] = useState(false)

  if (self) return <span className="text-sm text-[#aaa]">Your profile</span>

  const toggle = async () => {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/artists/${encodeURIComponent(slug)}/follow`, { method: 'POST' })
      const d = await res.json()
      if (res.ok) { setFollowing(d.following); setFollowers(d.followers) }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={toggle} disabled={busy} className={`px-5 py-2 rounded font-bold text-sm ${following ? 'bg-[#222] text-white border border-[#555]' : 'bg-[#ccff00] text-black'}`}>
        {following ? 'Following' : 'Follow'}
      </button>
      <span className="text-sm text-[#ccc]"><b className="text-white">{compact(followers)}</b> followers</span>
    </div>
  )
}
