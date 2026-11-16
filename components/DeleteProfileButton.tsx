'use client'
import { useId, useRef, useState } from 'react'
import { usePlayer } from './player/PlayerProvider'

export default function DeleteProfileButton({ profileId, handle, trackCount, playlistCount, needsPassword, blocked }: {
  profileId: string, handle: string, trackCount: number, playlistCount: number, needsPassword: boolean, blocked: string | null,
}) {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const player = usePlayer()
  const id = useId()
  const valid = confirmation === handle && confirmed && (!needsPassword || !!password)
  const remove = async () => {
    if (pending.current) return
    if (!valid) { setError('Confirm the artist name and deletion notice before continuing.'); return }
    pending.current = true
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/artists/me', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, confirmation, confirmed, password }),
      })
      const data: unknown = await response.json()
      if (!response.ok) throw new Error(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'The deletion could not be confirmed. Reload settings before trying again.')
      if (!data || typeof data !== 'object' || !('ok' in data) || data.ok !== true) throw new Error('The deletion response was incomplete. Reload settings to check your profile.')
      player.clearQueue()
      try { localStorage.removeItem('ssz-queue'); localStorage.removeItem('ssz-name') }
      catch { console.warn('Deleted profile browser preferences could not be cleared.') }
      window.location.assign('/settings?deleted=1')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The deletion could not be confirmed. Reload settings before retrying.')
      pending.current = false; setBusy(false)
    }
  }
  return <section id="delete-profile" aria-labelledby={`${id}-heading`} className="scroll-mt-48 rounded-xl border border-[#8c4f41] bg-[#1a110e] p-4 sm:p-6">
    <h2 id={`${id}-heading`} className="text-2xl text-[#ffb9a8]">Delete profile</h2>
    <p className="mt-2 text-sm leading-relaxed text-[#d4c3bd]">Permanently remove <strong>{handle}</strong> from SolidSoundZ, including its {trackCount} track entries, {playlistCount} playlists, Studio projects, comments and saved logins. Automatic SoundCloud sync stops.</p>
    <p id={`${id}-warning`} className="mt-2 text-sm leading-relaxed text-[#d4c3bd]">This cannot be undone from the site. Your SoundCloud and Apple Music accounts and original releases are not deleted. Reconnecting later starts a new SolidSoundZ profile; it does not recover this profile&apos;s activity.</p>
    {blocked ? <p role="status" className="mt-4 text-sm text-[#ffcf79]">{blocked}</p> : !open
      ? <button type="button" onClick={() => setOpen(true)} aria-expanded={false} className="mt-4 min-h-11 rounded border border-[#d38673] px-4 py-2 text-sm font-bold text-[#ffb9a8]">Delete this profile...</button>
      : <form onSubmit={event => { event.preventDefault(); void remove() }} className="mt-5 space-y-3">
        <fieldset disabled={busy} className="min-w-0 space-y-4">
          <legend className="sr-only">Confirm permanent profile deletion</legend>
          <label className="block text-sm font-bold text-[#eee]">Type your artist name exactly: <span className="break-words">{handle}</span>
            <input value={confirmation} onChange={event => setConfirmation(event.target.value)} required autoComplete="off" spellCheck={false} aria-describedby={`${id}-warning`} className="mt-1 min-h-11 w-full rounded border border-[#8c4f41] bg-[#090d09] px-3 py-2 text-sm text-white" />
          </label>
          {needsPassword && <label className="block text-sm font-bold text-[#eee]">Current password
            <input type="password" value={password} onChange={event => setPassword(event.target.value)} required maxLength={1024} autoComplete="current-password" className="mt-1 min-h-11 w-full rounded border border-[#8c4f41] bg-[#090d09] px-3 py-2 text-sm text-white" />
          </label>}
          <label className="flex items-start gap-2 text-sm text-[#d4c3bd]">
            <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required className="mt-1 accent-[#ffb9a8]" />
            I understand this permanently deletes this SolidSoundZ profile and its catalog.
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={!valid || busy} aria-busy={busy} className="min-h-11 rounded bg-[#c93624] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Deleting profile...' : 'Permanently delete profile'}</button>
            <button type="button" onClick={() => { setOpen(false); setConfirmation(''); setPassword(''); setConfirmed(false); setError('') }} className="min-h-11 px-3 py-2 text-sm text-[#ddd] underline">Cancel</button>
          </div>
        </fieldset>
        {error && <p role="alert" className="text-sm text-[#ffb9a8]">{error}</p>}
      </form>}
  </section>
}
