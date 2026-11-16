'use client'
import { useEffect, useRef, useState } from 'react'
import ActionPopover from './ActionPopover'

type Props = { trackId: string, title: string, artist: string, size?: 'sm' | 'lg' }

export default function ShareMenu({ trackId, title, artist, size = 'sm' }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showEmbed, setShowEmbed] = useState(false)
  const pending = useRef(false)

  useEffect(() => {
    if (open) { setCopied(null); setError(''); setShowEmbed(false) }
  }, [open])

  const url = typeof location === 'undefined' ? '' : `${location.origin}/t/${trackId}`
  const text = `${title} by ${artist}`
  const safeTitle = text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const embed = typeof location === 'undefined' ? '' : `<iframe src="${location.origin}/embed/${trackId}" width="100%" height="166" style="border:0;border-radius:8px" allow="autoplay; encrypted-media" title="${safeTitle} on SolidSoundZ"></iframe>`

  const copy = async (what: 'link' | 'embed') => {
    if (pending.current) return
    pending.current = true
    setBusy(true); setError(''); setCopied(null); setShowEmbed(what === 'embed')
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(what === 'link' ? url : embed)
      setCopied(what)
    } catch {
      setError(`Copy was not allowed by this browser. Select the ${what === 'embed' ? 'embed code' : 'track link'} below and copy it manually.`)
    } finally { pending.current = false; setBusy(false) }
  }
  const share = async () => {
    if (pending.current) return
    pending.current = true
    setBusy(true); setError(''); setCopied(null)
    try { await navigator.share({ title: text, url }) }
    catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) setError('Sharing could not open. Use Copy link or one of the sharing links below.')
    } finally { pending.current = false; setBusy(false) }
  }
  const enc = encodeURIComponent

  const item = 'block min-h-10 w-full rounded px-3 py-2 text-left text-sm hover:bg-[#262e25] disabled:opacity-50'
  return <ActionPopover label="Share" title="Share track" description="Send this release to a friend or copy an embeddable player for your website." open={open} onOpenChange={setOpen} size={size}>
    <div className="space-y-1">
      {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && <button type="button" className={item} disabled={busy} onClick={share}>Share to apps</button>}
      <button type="button" className={item} disabled={busy} onClick={() => copy('link')}>Copy link</button>
      <a className={item} href={`https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`} target="_blank" rel="noopener noreferrer">Post on X</a>
      <a className={item} href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`} target="_blank" rel="noopener noreferrer">Share on Facebook</a>
      <a className={item} href={`https://wa.me/?text=${enc(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer">Send on WhatsApp</a>
      <a className={item} href={`https://www.reddit.com/submit?url=${enc(url)}&title=${enc(text)}`} target="_blank" rel="noopener noreferrer">Post on Reddit</a>
      <button type="button" className={`${item} border-t border-[#394039]`} disabled={busy} onClick={() => copy('embed')}>Copy embed code</button>
    </div>
    {copied && <p role="status" className="mt-2 text-sm text-[#d8ff16]">{copied === 'link' ? 'Link copied.' : 'Embed code copied.'}</p>}
    {error && <p role="alert" className="mt-2 text-sm text-[#ff9d89]">{error}</p>}
    <label className="mt-3 block text-xs text-[#b9c1b6]">{showEmbed ? 'Embed code' : 'Track link'}
      <textarea readOnly rows={showEmbed ? 4 : 2} value={showEmbed ? embed : url} onFocus={event => event.currentTarget.select()} className="mt-1 w-full resize-none rounded border border-[#586055] bg-[#090d09] px-2 py-2 text-xs text-white" />
    </label>
  </ActionPopover>
}
