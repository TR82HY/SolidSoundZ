'use client'

import { useEffect, useRef, useState } from 'react'
import ActionPopover from './ActionPopover'

export default function ProfileShareButton({ artist, slug }: { artist: string, slug: string }) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const url = typeof location === 'undefined' ? '' : `${location.origin}/artist/${slug}`
  useEffect(() => { if (open) { setCopied(false); setError('') } }, [open])

  const share = async (copy = false) => {
    if (pending.current) return
    pending.current = true
    setBusy(true); setError(''); setCopied(false)
    const nativeShare = !copy && typeof navigator.share === 'function'
    try {
      if (nativeShare) await navigator.share({ title: artist, text: `Listen to ${artist} on SolidSoundZ`, url })
      else {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
        await navigator.clipboard.writeText(url)
        setCopied(true)
      }
    } catch (error) {
      if (!nativeShare || !(error instanceof Error && error.name === 'AbortError')) setError('Sharing was not allowed. Select the profile link below and copy it manually.')
    } finally { pending.current = false; setBusy(false) }
  }

  return <ActionPopover label="Share" title="Share artist profile" description={`Help listeners find ${artist} on SolidSoundZ.`} open={open} onOpenChange={setOpen} size="lg">
    <div className="flex flex-wrap gap-2">
      {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && <button onClick={() => share()} disabled={busy} className="min-h-10 rounded border border-[#586055] px-3 py-2 text-sm disabled:opacity-50">Share to apps</button>}
      <button onClick={() => share(true)} disabled={busy} className="min-h-10 rounded bg-[#d8ff16] px-3 py-2 text-sm font-bold text-black disabled:opacity-50">Copy profile link</button>
    </div>
    {copied && <p role="status" className="mt-3 text-sm text-[#d8ff16]">Profile link copied.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-[#ff9d89]">{error}</p>}
    <label className="mt-3 block text-xs text-[#b9c1b6]">Profile link
      <input readOnly value={url} onFocus={event => event.currentTarget.select()} className="mt-1 min-h-10 w-full rounded border border-[#586055] bg-[#090d09] px-2 py-2 text-sm text-white" />
    </label>
  </ActionPopover>
}