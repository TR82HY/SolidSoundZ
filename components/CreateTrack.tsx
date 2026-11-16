'use client'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import Waveform from './Waveform'
import { computePeaks, decodeFile, fmt } from '@/lib/audio'
import AdminBadge from './AdminBadge'

type Generation = {
  id: string, prompt: string, lyrics: string | null, style: string | null, genre: string | null, mood: string | null, bpm: number | null, duration: number, weirdness: number, influence: number, instrumental: boolean,
  status: string, outputUrl: string | null, error: string | null, createdAt: string,
}

const GENRES = ['Hip-Hop', 'Trap', 'R&B', 'House', 'Techno', 'Ambient', 'Cinematic', 'Lo-Fi']
const MOODS = ['Dark', 'Euphoric', 'Focused', 'Melancholy', 'Aggressive', 'Warm']

function isGeneration(value: unknown): value is Generation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const row: Record<string, unknown> = Object.fromEntries(Object.entries(value))
  return ['id', 'prompt', 'status', 'createdAt'].every(key => typeof row[key] === 'string')
    && ['lyrics', 'style', 'genre', 'mood', 'outputUrl', 'error'].every(key => row[key] === null || typeof row[key] === 'string')
    && ['duration', 'weirdness', 'influence'].every(key => typeof row[key] === 'number' && Number.isFinite(row[key]))
    && (row.bpm === null || typeof row.bpm === 'number' && Number.isFinite(row.bpm))
    && typeof row.instrumental === 'boolean'
}

export default function CreateTrack() {
  const [prompt, setPrompt] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [style, setStyle] = useState('')
  const [genre, setGenre] = useState('Hip-Hop')
  const [mood, setMood] = useState('Dark')
  const [bpm, setBpm] = useState(120)
  const [duration, setDuration] = useState(30)
  const [weirdness, setWeirdness] = useState(50)
  const [influence, setInfluence] = useState(50)
  const [instrumental, setInstrumental] = useState(true)
  const [generation, setGeneration] = useState<Generation | null>(null)
  const [drafts, setDrafts] = useState<Generation[]>([])
  const [plan, setPlan] = useState('free')
  const [isAdmin, setIsAdmin] = useState(false)
  const [accessStatus, setAccessStatus] = useState<'loading' | 'ready' | 'signed-out' | 'error'>('loading')
  const [accessError, setAccessError] = useState('')
  const [limit, setLimit] = useState(10)
  const [remaining, setRemaining] = useState(0)
  const [peaks, setPeaks] = useState<number[] | null>(null)
  const [previewTime, setPreviewTime] = useState(0)
  const previewRef = useRef<HTMLAudioElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const accessRequest = useRef<AbortController | null>(null)
  const mutationPending = useRef(false)

  const loadDrafts = useCallback(async () => {
    accessRequest.current?.abort()
    const controller = new AbortController()
    accessRequest.current = controller
    setAccessStatus('loading'); setAccessError('')
    try {
      const response = await fetch('/api/generate', { cache: 'no-store', signal: controller.signal })
      if (response.status === 401) {
        if (!controller.signal.aborted) { setDrafts([]); setPlan('free'); setIsAdmin(false); setRemaining(0); setAccessStatus('signed-out') }
        return
      }
      if (!response.ok) throw new Error('Could not check your Creator access. Please retry.')
      const data: unknown = await response.json()
      if (!data || typeof data !== 'object' || !('generations' in data) || !Array.isArray(data.generations) || !data.generations.every(isGeneration)
        || !('plan' in data) || (data.plan !== 'free' && data.plan !== 'pro')
        || !('isAdmin' in data) || typeof data.isAdmin !== 'boolean'
        || !('remaining' in data) || typeof data.remaining !== 'number' || !Number.isSafeInteger(data.remaining) || data.remaining < 0
        || !('limit' in data) || typeof data.limit !== 'number' || !Number.isSafeInteger(data.limit) || data.limit < 0
        || data.remaining > data.limit) throw new Error('Your Creator access response was incomplete. Please retry.')
      if (controller.signal.aborted) return
      setDrafts(data.generations); setPlan(data.plan); setIsAdmin(data.isAdmin); setRemaining(data.remaining); setLimit(data.limit); setAccessStatus('ready')
    } catch (error) {
      if (!controller.signal.aborted) { setAccessStatus('error'); setAccessError(error instanceof Error ? error.message : 'Could not check Creator access. Please retry.') }
    } finally { if (accessRequest.current === controller) accessRequest.current = null }
  }, [])

  useEffect(() => {
    void loadDrafts()
    const refreshAccess = () => void loadDrafts()
    window.addEventListener('ssz:account-updated', refreshAccess)
    return () => { accessRequest.current?.abort(); window.removeEventListener('ssz:account-updated', refreshAccess) }
  }, [loadDrafts])
  useEffect(() => {
    if (!generation || !['queued', 'processing'].includes(generation.status)) return
    const id = window.setInterval(async () => {
      const response = await fetch(`/api/generate?id=${generation.id}`)
      const next = await response.json().catch(() => null)
      if (response.ok && next) {
        setGeneration(next)
        if (!['queued', 'processing'].includes(next.status)) void loadDrafts()
      }
    }, 3000)
    return () => window.clearInterval(id)
  }, [generation])
  useEffect(() => {
    if (generation?.status !== 'succeeded') { setPeaks(null); setPreviewTime(0); return }
    let active = true
    fetch(`/api/generate/${generation.id}/audio`).then(async response => {
      if (!response.ok) throw new Error('audio unavailable')
      const buffer = await decodeFile(await response.blob())
      if (active) setPeaks(computePeaks(buffer, 220))
    }).catch(() => { if (active) setPeaks(null) })
    return () => { active = false }
  }, [generation?.id, generation?.status])

  const generate = async () => {
    if (mutationPending.current || accessStatus !== 'ready') return
    mutationPending.current = true
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, lyrics, style, genre, mood, bpm, duration, weirdness, influence, instrumental }) })
      const data: unknown = await response.json()
      if (!response.ok) throw new Error(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'Could not start generation')
      if (!isGeneration(data)) throw new Error('The generation request could not be confirmed. Refresh your drafts before trying again.')
      setGeneration(data); void loadDrafts()
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not start generation. Please retry.') }
    finally { mutationPending.current = false; setBusy(false) }
  }

  const upgrade = async () => {
    if (mutationPending.current || accessStatus !== 'ready' || isAdmin) return
    mutationPending.current = true
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: 'monthly' }) })
      const data: unknown = await response.json()
      if (!response.ok) throw new Error(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'Pro checkout could not open.')
      if (!data || typeof data !== 'object' || !('url' in data) || typeof data.url !== 'string') throw new Error('The checkout response was incomplete. Please retry.')
      window.location.assign(data.url)
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not open checkout. Please retry.') }
    finally { mutationPending.current = false; setBusy(false) }
  }

  const active = generation && ['queued', 'processing'].includes(generation.status)
  const audioUrl = generation ? `/api/generate/${generation.id}/audio` : null

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="border border-[#586055] bg-[#111511] p-5 sm:p-7">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#d8ff16]">AI creation beta</p>
        <h1 className="mt-2 text-5xl leading-[0.9]">Start with a sound.</h1>
        <p className="mt-3 max-w-2xl text-sm text-[#c7cec5]">Create an instrumental sketch, then open it in Studio to shape the master before you publish.</p>
        <div className="mt-5 flex flex-wrap items-center gap-3 border-l-4 border-l-[#d8ff16] bg-[#0a0d0a] px-4 py-3 text-sm">
          {isAdmin && accessStatus === 'ready' ? <AdminBadge /> : <span className="font-bold uppercase tracking-[0.08em] text-[#d8ff16]">Creator access</span>}
          <span className="text-[#c7cec5]">{accessStatus === 'loading' ? 'Checking your access...' : accessStatus === 'signed-out' ? 'Sign in to check your Creator access.' : accessStatus === 'error' ? 'Access could not be verified.' : `${isAdmin ? 'Pro included for the site owner. No subscription needed. ' : ''}${plan === 'pro' ? `${remaining} of ${limit} previews available this month.` : `${limit} previews are included with Pro every month.`}`}</span>
          {accessStatus === 'ready' && plan !== 'pro' && <button type="button" onClick={upgrade} disabled={busy} className="ml-auto border border-[#d8ff16] px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-[#d8ff16] hover:bg-[#d8ff16] hover:text-black disabled:opacity-40">Unlock Pro</button>}
          {accessStatus === 'signed-out' && <Link href="/sign-in" className="text-sm font-bold text-[#d8ff16] underline">Sign in</Link>}
          {accessStatus === 'error' && <button type="button" onClick={() => void loadDrafts()} className="min-h-9 text-sm font-bold text-[#d8ff16] underline">Retry access check</button>}
        </div>
        {accessError && <p role="alert" className="mt-3 text-sm text-[#ffb9a8]">{accessError}</p>}
        {isAdmin && accessStatus === 'ready' && <p className="mt-2 text-xs text-[#aaa]">Admin access does not change the existing generation allowance. Hosting and external AI-provider charges still apply.</p>}

        <label className="mt-7 block text-sm font-bold uppercase tracking-[0.08em] text-[#dce2d9]">Describe the track
          <textarea value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={500} rows={5}
            placeholder="Heavy late-night trap beat, distorted 808s, sparse bells, cinematic pressure" className="mt-2 w-full resize-none border border-[#4c554b] bg-[#090b09] p-4 text-base normal-case tracking-normal text-white outline-none focus:border-[#d8ff16]" />
        </label>

        <label className="mt-6 block text-sm font-bold uppercase tracking-[0.08em] text-[#dce2d9]">Style direction
          <input value={style} onChange={event => setStyle(event.target.value)} maxLength={300} placeholder="Raw drums, blown-out bass, cold synths, tight arrangement" className="mt-2 w-full border border-[#4c554b] bg-[#090b09] px-4 py-3 text-base normal-case tracking-normal text-white outline-none focus:border-[#d8ff16]" />
        </label>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <label className="block text-sm font-bold uppercase tracking-[0.08em] text-[#dce2d9]">Genre
            <select value={genre} onChange={event => setGenre(event.target.value)} className="mt-2 w-full border border-[#4c554b] bg-[#090b09] px-3 py-3 text-white outline-none focus:border-[#d8ff16]">
              {GENRES.map(option => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="block text-sm font-bold uppercase tracking-[0.08em] text-[#dce2d9]">Tempo
            <input type="number" min={50} max={200} value={bpm} onChange={event => setBpm(Number(event.target.value))} className="mt-2 w-full border border-[#4c554b] bg-[#090b09] px-3 py-3 text-white outline-none focus:border-[#d8ff16]" />
          </label>
        </div>

        <fieldset className="mt-6">
          <legend className="text-sm font-bold uppercase tracking-[0.08em] text-[#dce2d9]">Mood</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {MOODS.map(option => <button key={option} type="button" onClick={() => setMood(option)} className={`border px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] ${mood === option ? 'border-[#d8ff16] bg-[#d8ff16] text-black' : 'border-[#4c554b] text-[#d5ddd2] hover:border-[#d8ff16]'}`}>{option}</button>)}
          </div>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="text-sm font-bold uppercase tracking-[0.08em] text-[#dce2d9]">Voice</legend>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setInstrumental(true)} className={`border px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] ${instrumental ? 'border-[#d8ff16] bg-[#d8ff16] text-black' : 'border-[#4c554b] text-[#d5ddd2]'}`}>Instrumental</button>
            <button type="button" onClick={() => setInstrumental(false)} className={`border px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] ${!instrumental ? 'border-[#d8ff16] bg-[#d8ff16] text-black' : 'border-[#4c554b] text-[#d5ddd2]'}`}>Lyrics + vocals</button>
          </div>
          {!instrumental && <label className="mt-3 block text-sm font-bold uppercase tracking-[0.08em] text-[#dce2d9]">Lyrics
            <textarea value={lyrics} onChange={event => setLyrics(event.target.value)} maxLength={4000} rows={7} placeholder="[Verse]\nWrite the words you want the vocal model to perform..." className="mt-2 w-full resize-y border border-[#4c554b] bg-[#090b09] p-4 text-base normal-case tracking-normal text-white outline-none focus:border-[#d8ff16]" />
          </label>}
          {!instrumental && <p className="mt-2 text-xs text-[#aeb8ab]">Lyrics need a vocal-capable model selected in `REPLICATE_MODEL`. The default model creates instrumentals.</p>}
        </fieldset>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-bold uppercase tracking-[0.08em] text-[#dce2d9]">Weirdness <span className="float-right font-mono text-[#d8ff16]">{weirdness}</span>
            <input type="range" min={0} max={100} value={weirdness} onChange={event => setWeirdness(Number(event.target.value))} className="mt-3 w-full accent-[#d8ff16]" />
            <span className="mt-1 block text-xs normal-case tracking-normal text-[#9ea59f]">More unexpected sound design and arrangements.</span>
          </label>
          <label className="block text-sm font-bold uppercase tracking-[0.08em] text-[#dce2d9]">Influence <span className="float-right font-mono text-[#d8ff16]">{influence}</span>
            <input type="range" min={0} max={100} value={influence} onChange={event => setInfluence(Number(event.target.value))} className="mt-3 w-full accent-[#d8ff16]" />
            <span className="mt-1 block text-xs normal-case tracking-normal text-[#9ea59f]">How closely the result follows your direction.</span>
          </label>
        </div>

        <fieldset className="mt-6">
          <legend className="text-sm font-bold uppercase tracking-[0.08em] text-[#dce2d9]">Preview length</legend>
          <div className="mt-2 flex gap-2">
            {[10, 20, 30].map(seconds => <button key={seconds} type="button" onClick={() => setDuration(seconds)} className={`border px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] ${duration === seconds ? 'border-[#ff5a36] bg-[#ff5a36] text-black' : 'border-[#4c554b] text-[#d5ddd2] hover:border-[#ff5a36]'}`}>{seconds}s</button>)}
          </div>
        </fieldset>

        {error && <p role="alert" className="mt-5 border-l-2 border-[#ff5a36] pl-3 text-sm text-[#ff9d89]">{error}</p>}
        <button type="button" onClick={plan === 'pro' ? generate : upgrade} disabled={busy || active || accessStatus !== 'ready' || (plan === 'pro' && prompt.trim().length < 8)} className="mt-7 bg-[#d8ff16] px-6 py-4 text-sm font-bold uppercase tracking-[0.12em] text-black hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">
          {busy ? 'Working...' : active ? 'Generating...' : accessStatus !== 'ready' ? 'Check access to continue' : plan === 'pro' ? 'Generate preview' : 'Unlock Creator with Pro'}
        </button>

        {generation && <div className="mt-7 border-t border-[#465045] pt-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#d8ff16]">Draft {generation.status}</p>
          {generation.status === 'succeeded' && audioUrl && <>
            {peaks && <div className="mt-4">
              <Waveform peaks={peaks} active progress={generation.duration ? previewTime / generation.duration : 0} height={72} seekLabel="Generated track position" duration={generation.duration}
                onSeek={fraction => { const audio = previewRef.current; if (audio) audio.currentTime = fraction * (audio.duration || generation.duration) }} />
              <div className="mt-1 flex justify-between font-mono text-[10px] text-[#9ea59f]"><span>{fmt(previewTime)}</span><span>{fmt(generation.duration)}</span></div>
            </div>}
            <audio ref={previewRef} className="mt-3 w-full" controls src={audioUrl} onTimeUpdate={event => setPreviewTime(event.currentTarget.currentTime)} onEnded={() => setPreviewTime(0)} />
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={`/studio?generation=${generation.id}`} className="bg-white px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-black hover:bg-[#d8ff16]">Open in Studio</Link>
              <a href={audioUrl} download className="border border-[#d8ff16] px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-[#d8ff16] hover:bg-[#d8ff16] hover:text-black">Download</a>
            </div>
          </>}
          {generation.status === 'failed' && <p className="mt-2 text-sm text-[#ff9d89]">{generation.error || 'Generation failed. Adjust the prompt and try again.'}</p>}
          {active && <p className="mt-2 text-sm text-[#c7cec5]">Your draft is saved. This usually takes a minute or two.</p>}
        </div>}
      </section>

      <aside className="border-t border-[#586055] pt-5 lg:border-l lg:border-t-0 lg:pl-5">
        <h2 className="text-2xl text-[#d8ff16]">Your drafts</h2>
        <div className="mt-4 space-y-2">
          {drafts.map(draft => <button key={draft.id} type="button" onClick={() => setGeneration(draft)} className="w-full border border-[#3e473d] bg-[#111511] p-3 text-left hover:border-[#d8ff16]">
            <span className="block truncate text-sm font-bold">{draft.prompt}</span>
            <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-[#aeb8ab]">{draft.status} {draft.genre && `- ${draft.genre}`}</span>
          </button>)}
          {!drafts.length && <p className="text-sm text-[#9ea59f]">Your saved generation drafts will appear here.</p>}
        </div>
      </aside>
    </div>
  )
}