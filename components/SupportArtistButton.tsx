'use client'
import { useState } from 'react'

export default function SupportArtistButton({ trackId }: { trackId: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const support = async () => { setBusy(true); setError(''); try { const response = await fetch('/api/contributions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trackId, amount: 5 }) }); const data = await response.json().catch(() => ({})); if (!response.ok || !data.url) { setError(data.error || 'Support unavailable'); return }; location.assign(data.url) } finally { setBusy(false) } }
  return <div><button onClick={support} disabled={busy} className="border border-[#ff5a36] px-4 py-2 text-sm font-bold text-[#ff8b72] hover:bg-[#ff5a36] hover:text-black disabled:opacity-40">{busy ? 'Opening...' : 'Support artist $5'}</button>{error && <p className="mt-1 text-xs text-[#ff9d89]">{error}</p>}</div>
}