'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { TrackCardData } from '@/lib/queries'
import RelativeTime from './RelativeTime'

export default function DraftList({ tracks }: { tracks: TrackCardData[] }) {
  const router = useRouter(); const [busy, setBusy] = useState(''); const [pickerFor, setPickerFor] = useState('')
  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy(id)
    try { const response = await fetch(`/api/tracks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (response.ok) { router.refresh(); setPickerFor('') } }
    finally { setBusy('') }
  }
  const minSchedule = new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16)
  return <div className="divide-y divide-[#394139] border-y border-[#394139]">{tracks.map(track => (
    <div key={track.id} className="py-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-white">{track.title}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#ff8b72]">{track.scheduledFor ? <>Releases <RelativeTime value={track.scheduledFor} future /></> : 'Private draft'}</p>
        </div>
        <button onClick={() => setPickerFor(id => id === track.id ? '' : track.id)} disabled={busy === track.id} className="border border-[#586055] px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-[#aeb8ab] hover:border-[#d8ff16] hover:text-[#d8ff16] disabled:opacity-40">{track.scheduledFor ? 'Reschedule' : 'Schedule'}</button>
        <button onClick={() => patch(track.id, { published: true })} disabled={busy === track.id} className="bg-[#d8ff16] px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-black disabled:opacity-40">{busy === track.id ? 'Releasing...' : 'Release now'}</button>
      </div>
      {pickerFor === track.id && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input type="datetime-local" min={minSchedule} defaultValue={track.scheduledFor?.slice(0, 16)} id={`schedule-${track.id}`}
            className="bg-[#0a0d0a] border border-[#555] rounded px-2 py-1.5 text-sm text-white" />
          <button onClick={() => { const value = (document.getElementById(`schedule-${track.id}`) as HTMLInputElement).value; if (value) patch(track.id, { scheduledFor: new Date(value).toISOString() }) }}
            disabled={busy === track.id} className="border border-[#d8ff16] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#d8ff16] hover:bg-[#d8ff16] hover:text-black disabled:opacity-40">Confirm</button>
          {track.scheduledFor && <button onClick={() => patch(track.id, { scheduledFor: null })} disabled={busy === track.id} className="text-xs text-[#999] hover:text-white">Cancel schedule</button>}
        </div>
      )}
    </div>
  ))}</div>
}