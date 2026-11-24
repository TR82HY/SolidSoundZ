'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { baseName, computePeaks, decodeFile, downloadBlob, encodeWav, fmt, FORMATS, publishTrack, renderExportBlob, validateWav, type FormatId, type WavCheck } from '@/lib/audio'
import { buildChain, DEFAULTS, EQ_BANDS, PRESETS, renderMaster, TARGETS, dbToLin, parseStudioSettings, type Chain, type Settings } from '@/lib/studioChain'
import { measureLoudness } from '@/lib/loudness'
import { stopAll, transportBtn, useTransport } from '@/lib/transport'
import { FormatSelect } from '../ui'
import Waveform from '../Waveform'
import Meters from './Meters'

type Graph = { ctx: AudioContext, chain: Chain, wet: GainNode, dry: GainNode, monitor: GainNode, left: AnalyserNode, right: AnalyserNode, spectrum: AnalyserNode }
type Analysis = { inLufs: number, inPeak: number, outLufs: number, outPeak: number }
type LibraryTrack = { id: string, title: string, duration: number, audioUrl: string, s3Key: string }

const STORE = 'ssz-studio-settings'
const AUDIO_EXTENSION = /\.(wav|wave|aif|aiff|flac|mp3|ogg|m4a|aac|webm)$/i
const EQ_HINTS = [
  'Boost for deeper bass; reduce if the low end feels heavy or boomy.',
  'Controls warmth. Reduce a little if the mix sounds muddy.',
  'Controls the body of vocals and instruments. Make small moves.',
  'Adds clarity and attack. Reduce if vocals or drums sound harsh.',
  'Adds high-end sparkle. Reduce if cymbals or vocals sound hissy.',
]
const PRESET_HINTS: Record<string, string> = {
  Transparent: 'Subtle changes. A good first try.',
  'Hip-Hop': 'Deeper bass with a little extra color.',
  Trap: 'Heavy low end and brighter highs.',
  EDM: 'Punchy bass and a wider stereo image.',
  Pop: 'Bright, gently colored and a little wider.',
  'Lo-Fi': 'Darker highs, warmer color and less width.',
  Rock: 'More bite, body and harmonic color.',
  'Vocal/Podcast': 'Less rumble and more vocal presence.',
}

function isLibraryTrack(value: unknown): value is LibraryTrack {
  return !!value && typeof value === 'object'
    && 'id' in value && typeof value.id === 'string'
    && 'title' in value && typeof value.title === 'string'
    && 'audioUrl' in value && typeof value.audioUrl === 'string'
    && 's3Key' in value && typeof value.s3Key === 'string'
    && 'duration' in value && typeof value.duration === 'number' && Number.isFinite(value.duration)
}

function previewLevels(bypass: boolean, levelMatch: boolean, analysis: Analysis | null) {
  const matched = levelMatch && analysis && analysis.inLufs > -69 && analysis.outLufs > -69
  return {
    dry: bypass ? matched ? dbToLin(Math.min(0, analysis.outLufs - analysis.inLufs)) : 1 : 0,
    wet: bypass ? 0 : matched ? dbToLin(Math.min(0, analysis.inLufs - analysis.outLufs)) : 1,
  }
}

function Slider({ label, hint, value, min, max, step = 0.1, unit = '', def, onChange, digits = 1 }: { label: string, hint: string, value: number, min: number, max: number, step?: number, unit?: string, def: number, onChange: (v: number) => void, digits?: number }) {
  const id = useId()
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-xs">
        <label htmlFor={id} className="text-[#ddd] font-bold">{label}</label>
        <span aria-hidden="true" className="font-mono text-[#ccff00]">{value > 0 && min < 0 ? '+' : ''}{value.toFixed(digits)}{unit}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={`${value.toFixed(digits)}${unit}`} aria-describedby={`${id}-hint`}
        onChange={e => onChange(Number(e.target.value))} onDoubleClick={() => onChange(def)} title="Double-click to reset"
        className="w-full accent-[#ccff00]" />
      <p id={`${id}-hint`} className="text-xs leading-relaxed text-[#aaa]">{hint}</p>
      <button type="button" onClick={() => onChange(def)} aria-label={`Reset ${label} to ${def}${unit}`} className="mt-1 min-h-8 text-xs text-[#ccc] underline underline-offset-2 disabled:opacity-40">Reset</button>
    </div>
  )
}

function Section({ title, description, children, right }: { title: string, description: string, children: React.ReactNode, right?: React.ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} aria-describedby={`${id}-help`} className="rounded-xl border border-[#333] bg-[#111] p-4">
      <div className="flex items-center justify-between gap-3 mb-2"><h2 id={id} className="text-sm font-black tracking-wider text-[#ccff00]">{title}</h2>{right}</div>
      <p id={`${id}-help`} className="mb-4 text-sm leading-relaxed text-[#bbb]">{description}</p>
      {children}
    </section>
  )
}

export default function Studio() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [file, setFile] = useState<File | null>(null)
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [s, setS] = useState<Settings>(DEFAULTS)
  const [preset, setPreset] = useState('Custom')
  const [target, setTarget] = useState(TARGETS[0].lufs)
  const [bypass, setBypass] = useState(false)
  const [levelMatch, setLevelMatch] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [format, setFormat] = useState<FormatId>('wav24')
  const [keepRate, setKeepRate] = useState(false)
  const [qc, setQc] = useState<WavCheck[] | null>(null)
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [startingPlayback, setStartingPlayback] = useState(false)
  const [settingsReady, setSettingsReady] = useState(false)
  const [storageWarning, setStorageWarning] = useState('')
  const [graph, setGraph] = useState<Graph | null>(null)
  const [libraryTracks, setLibraryTracks] = useState<LibraryTrack[]>([])
  const [libraryStatus, setLibraryStatus] = useState<'loading' | 'ready' | 'signed-out' | 'error'>('loading')
  const [libraryRevision, setLibraryRevision] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const fileIn = useRef<HTMLInputElement>(null)
  const graphRef = useRef<Graph | null>(null)
  const objectUrl = useRef<string | null>(null)
  const loadRequest = useRef<AbortController | null>(null)
  const jobRequest = useRef<AbortController | null>(null)
  const playRequest = useRef(0)
  const mounted = useRef(true)
  const originalAnalysis = useRef<{ buffer: AudioBuffer, value: Awaited<ReturnType<typeof measureLoudness>> } | null>(null)

  const peaks = useMemo(() => buffer ? computePeaks(buffer, 300) : null, [buffer])
  const duration = buffer?.duration ?? 0
  const locked = loading || busy !== null
  const canLevelMatch = !!analysis && analysis.inLufs > -69 && analysis.outLufs > -69
  const generationId = searchParams.get('generation')

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      loadRequest.current?.abort()
      jobRequest.current?.abort()
      playRequest.current++
      audioRef.current?.pause()
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
      if (graphRef.current) void graphRef.current.ctx.close().catch(error => console.error('Studio audio cleanup failed.', error))
    }
  }, [])
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE)
      if (saved) setS(parseStudioSettings(JSON.parse(saved)))
    } catch {
      setStorageWarning('Saved Studio settings could not be restored. Safe defaults are in use.')
    }
    setSettingsReady(true)
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLibraryStatus('loading')
    const load = async () => {
      try {
        const response = await fetch('/api/tracks', { cache: 'no-store', signal: controller.signal })
        if (response.status === 401) {
          if (!controller.signal.aborted) { setLibraryTracks([]); setLibraryStatus('signed-out') }
          return
        }
        if (!response.ok) throw new Error('Library unavailable')
        const data: unknown = await response.json()
        if (!data || typeof data !== 'object' || !('tracks' in data) || !Array.isArray(data.tracks) || !data.tracks.every(isLibraryTrack)) throw new Error('Invalid library response')
        if (!controller.signal.aborted) { setLibraryTracks(data.tracks); setLibraryStatus('ready') }
      } catch {
        if (!controller.signal.aborted) setLibraryStatus('error')
      }
    }
    void load()
    return () => controller.abort()
  }, [libraryRevision])
  useEffect(() => {
    if (!settingsReady) return
    try { localStorage.setItem(STORE, JSON.stringify(s)) }
    catch { setStorageWarning('This browser cannot save Studio settings. Your current session still works.') }
  }, [s, settingsReady])

  useEffect(() => { graph?.chain.set(s) }, [graph, s])
  useEffect(() => {
    if (!graph) return
    const levels = previewLevels(bypass, levelMatch, analysis)
    graph.chain.trim.gain.value = 1
    graph.wet.gain.setTargetAtTime(levels.wet, graph.ctx.currentTime, 0.008)
    graph.dry.gain.setTargetAtTime(levels.dry, graph.ctx.currentTime, 0.008)
  }, [graph, bypass, levelMatch, analysis])
  useEffect(() => { if (graph) graph.monitor.gain.setTargetAtTime(volume, graph.ctx.currentTime, 0.008) }, [graph, volume])

  useEffect(() => {
    if (!playing) return
    let id = 0
    const tick = () => { if (audioRef.current) setTime(audioRef.current.currentTime); id = requestAnimationFrame(tick) }
    tick()
    return () => cancelAnimationFrame(id)
  }, [playing])

  const pausePreview = useCallback(() => {
    playRequest.current++
    audioRef.current?.pause()
    setPlaying(false)
    setStartingPlayback(false)
  }, [])

  const startLoad = useCallback((read: (signal: AbortSignal) => Promise<File>, label: string) => {
    if (jobRequest.current) {
      setError('Wait for the current Studio operation before replacing the track.')
      return () => {}
    }
    loadRequest.current?.abort()
    const controller = new AbortController()
    loadRequest.current = controller
    const current = () => mounted.current && loadRequest.current === controller && !controller.signal.aborted
    pausePreview()
    setLoading(true); setError(''); setStatus(label); setAnalysis(null)
    const decode = async () => {
      try {
        const nextFile = await read(controller.signal)
        if (!current()) return
        if (!nextFile.size) throw new Error('That file is empty. Choose an audio file with sound in it.')
        if (!nextFile.type.startsWith('audio/') && !AUDIO_EXTENSION.test(nextFile.name)) throw new Error('Choose an audio file such as WAV, AIFF, FLAC or MP3.')
        let decoded: AudioBuffer
        try { decoded = await decodeFile(nextFile) }
        catch { throw new Error('Could not decode this audio. Try WAV, AIFF, FLAC or MP3. Any previously loaded track has been kept.') }
        if (!current()) return
        if (decoded.numberOfChannels > 2) throw new Error('Load a mono or stereo mix. Surround audio is not supported by this stereo mastering chain.')
        const nextUrl = URL.createObjectURL(nextFile)
        const previousUrl = objectUrl.current
        objectUrl.current = nextUrl
        originalAnalysis.current = null
        setFile(nextFile); setBuffer(decoded); setUrl(nextUrl)
        setTitle(baseName(nextFile.name)); setTime(0); setBypass(false)
        setStatus(`Loaded ${nextFile.name}. Preview or analyze it before exporting.`)
        if (previousUrl) URL.revokeObjectURL(previousUrl)
      } catch (error) {
        if (current()) { setError(error instanceof Error ? error.message : 'Could not load this audio.'); setStatus('') }
      } finally {
        if (loadRequest.current === controller) {
          loadRequest.current = null
          if (mounted.current) setLoading(false)
        }
      }
    }
    void decode()
    return () => {
      controller.abort()
      if (loadRequest.current === controller) {
        loadRequest.current = null
        if (mounted.current) { setLoading(false); setStatus('') }
      }
    }
  }, [pausePreview])

  const load = (nextFile?: File | null) => {
    if (nextFile) startLoad(async () => nextFile, `Loading ${nextFile.name}...`)
  }

  const loadLibraryTrack = (id: string) => {
    if (!id) return
    const track = libraryTracks.find(t => t.id === id)
    if (!track) { setError('That library track is no longer available. Refresh the library and try again.'); return }
    if (track.s3Key.startsWith('soundcloud/')) { setError('Add the original audio file before using this SoundCloud track in Studio.'); return }
    startLoad(async signal => {
      const response = await fetch(track.audioUrl, { signal })
      if (!response.ok) throw new Error('The original audio is unavailable. Upload your original file or try again.')
      const blob = await response.blob()
      return new File([blob], `${track.title}.audio`, { type: blob.type.startsWith('audio/') ? blob.type : 'audio/mpeg' })
    }, `Loading ${track.title}...`)
  }

  useEffect(() => {
    if (!generationId) return
    return startLoad(async signal => {
      const response = await fetch(`/api/generate/${encodeURIComponent(generationId)}/audio`, { signal })
      if (!response.ok) throw new Error(response.status === 401 ? 'Sign in to load this generated track.' : 'This generated track is not ready to load. Please try again.')
      const blob = await response.blob()
      return new File([blob], 'SolidSoundZ-generation.audio', { type: blob.type.startsWith('audio/') ? blob.type : 'audio/mpeg' })
    }, 'Loading generated audio...')
  }, [generationId, startLoad])

  const ensureGraph = () => {
    if (graphRef.current || !audioRef.current) return graphRef.current
    const ctx = new AudioContext()
    try {
      const chain = buildChain(ctx)
      const wet = ctx.createGain(), dry = ctx.createGain(), mix = ctx.createGain(), monitor = ctx.createGain()
      const split = ctx.createChannelSplitter(2)
      const left = ctx.createAnalyser(), right = ctx.createAnalyser(), spectrum = ctx.createAnalyser()
      left.fftSize = right.fftSize = 2048; spectrum.fftSize = 8192; spectrum.smoothingTimeConstant = 0.75
      chain.output.connect(wet).connect(mix)
      dry.connect(mix)
      mix.connect(split); split.connect(left, 0); split.connect(right, 1)
      mix.connect(spectrum)
      mix.connect(monitor).connect(ctx.destination)
      chain.set(s)
      const levels = previewLevels(bypass, levelMatch, analysis)
      wet.gain.value = levels.wet
      dry.gain.value = levels.dry
      monitor.gain.value = volume
      // A media element can only be attached once, so finish fallible setup first.
      const src = ctx.createMediaElementSource(audioRef.current)
      src.connect(chain.input); src.connect(dry)
      const g = { ctx, chain, wet, dry, monitor, left, right, spectrum }
      graphRef.current = g
      setGraph(g)
      return g
    } catch (error) {
      void ctx.close().catch(cleanupError => console.error('Studio audio cleanup failed.', cleanupError))
      throw error
    }
  }

  const toggle = async () => {
    const a = audioRef.current
    if (!a || !buffer || loadRequest.current || jobRequest.current) return
    if (!a.paused) { pausePreview(); return }
    stopAll()
    const request = ++playRequest.current
    setStartingPlayback(true); setError('')
    try {
      const g = ensureGraph()
      await g?.ctx.resume()
      if (mounted.current && request === playRequest.current) await a.play()
    } catch {
      if (mounted.current && request === playRequest.current) setError('Preview could not start. Try Play again or reload the audio file.')
    } finally {
      if (mounted.current && request === playRequest.current) setStartingPlayback(false)
    }
  }
  const seek = (t: number) => {
    const a = audioRef.current
    if (!a || !buffer || loading) return
    a.currentTime = Math.max(0, Math.min(t, duration))
    setTime(a.currentTime)
  }
  const stop = () => { pausePreview(); seek(0) }
  useTransport(rootRef, { toggle, stop: pausePreview })

  const invalidateAnalysis = () => { setAnalysis(null); setStatus(''); setPreset('Custom') }
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => { if (jobRequest.current || loadRequest.current) return; setS(p => ({ ...p, [k]: v })); invalidateAnalysis() }
  const setBand = (i: number, v: number) => { if (jobRequest.current || loadRequest.current) return; setS(p => ({ ...p, eq: p.eq.map((x, j) => j === i ? v : x) })); invalidateAnalysis() }
  const inputAnalysis = async (source: AudioBuffer) => {
    if (source.duration < 0.4) throw new Error('Loudness analysis needs at least 0.4 seconds of audio. You can still preview or export this clip.')
    if (originalAnalysis.current?.buffer === source) return originalAnalysis.current.value
    let preview = source
    if (source.numberOfChannels === 1) {
      preview = new AudioBuffer({ numberOfChannels: 2, length: source.length, sampleRate: source.sampleRate })
      preview.copyToChannel(source.getChannelData(0), 0)
      preview.copyToChannel(source.getChannelData(0), 1)
    }
    const value = await measureLoudness(preview)
    if (mounted.current) originalAnalysis.current = { buffer: source, value }
    return value
  }
  const runJob = async (label: string, action: (signal: AbortSignal) => Promise<void>) => {
    if (jobRequest.current || loadRequest.current) return
    const controller = new AbortController()
    jobRequest.current = controller
    pausePreview()
    setBusy(label); setError(''); setStatus('')
    try { await action(controller.signal) }
    catch (error) {
      if (mounted.current && !controller.signal.aborted) setError(error instanceof Error ? error.message : 'The Studio operation failed. Please try again.')
    } finally {
      if (jobRequest.current === controller) jobRequest.current = null
      if (mounted.current) setBusy(null)
    }
  }

  const analyze = async (settings = s) => {
    if (!buffer) throw new Error('Load an audio file before analyzing.')
    const [inp, rendered] = await Promise.all([inputAnalysis(buffer), renderMaster(buffer, settings)])
    const out = await measureLoudness(rendered)
    if (![inp.lufs, inp.peakDb, out.lufs, out.peakDb].every(Number.isFinite)) throw new Error('Audio analysis returned invalid measurements. Try another file.')
    const a = { inLufs: inp.lufs, inPeak: inp.peakDb, outLufs: out.lufs, outPeak: out.peakDb }
    if (mounted.current) setAnalysis(a)
    return a
  }

  // The limiter is non-linear, so match loudness in two passes.
  const matchLoudness = async (base = s, presetName = 'Custom') => {
    if (!buffer) return
    await runJob('Matching loudness...', async signal => {
      const input = await inputAnalysis(buffer)
      if (input.lufs <= -69) throw new Error('This audio is silent or below the measurable loudness range. Loudness matching was not applied.')
      let next = { ...base }
      for (let pass = 0; pass < 2; pass++) {
        const out = await measureLoudness(await renderMaster(buffer, next))
        if (signal.aborted) return
        if (out.lufs <= -69) throw new Error('The processed audio has no measurable loudness. Check your settings before matching.')
        next = { ...next, outputGain: Math.max(-12, Math.min(24, next.outputGain + (target - out.lufs))) }
      }
      if (signal.aborted) return
      const result = await analyze(next)
      if (signal.aborted) return
      setS(next); setPreset(presetName)
      setStatus(Math.abs(result.outLufs - target) <= 1
        ? `Master measured ${result.outLufs.toFixed(1)} LUFS against the ${target} LUFS target.`
        : `Target not reached: measured ${result.outLufs.toFixed(1)} LUFS against ${target} LUFS. Gain and limiter limits can prevent an exact match.`)
    })
  }

  const autoMaster = async (name: string) => {
    const next = { ...DEFAULTS, ...PRESETS[name], ceiling: s.ceiling }
    await matchLoudness(next, name)
  }

  const exportMaster = async () => {
    if (!buffer || !file) return
    await runJob('Rendering master...', async signal => {
      const rendered = await renderMaster(buffer, s)
      if (signal.aborted) return
      const f = FORMATS.find(x => x.id === format)!
      const { blob, out } = await renderExportBlob(rendered, format, keepRate)
      if (signal.aborted) return
      if (format !== 'mp3') {
        const checks = await validateWav(blob, {
          channelCount: out.numberOfChannels,
          frameCount: out.length,
          format: format === 'wav32' ? 'float32' : format === 'wav24' ? 'pcm24' : 'pcm16',
          peakCeiling: dbToLin(s.ceiling),
          sampleRate: out.sampleRate,
        })
        setQc(checks)
        if (!checks.every(c => c.pass)) {
          setError('The export checker found an issue. Review the results below — the download was blocked.')
          return
        }
      } else {
        setQc(null)
      }
      downloadBlob(blob, `${baseName(file.name)}-SSZ-master.${f.ext}`)
      if (!signal.aborted) setStatus('Master rendered and checked. Your browser download has started.')
    })
  }

  const masterAndPublish = async () => {
    if (!buffer || !file) return
    await runJob('Rendering and publishing...', async signal => {
      const rendered = await renderMaster(buffer, s)
      if (signal.aborted) return
      const wav = new File([encodeWav(rendered, 24)], `${baseName(file.name)}-master.wav`, { type: 'audio/wav' })
      const r = await publishTrack(wav, { title: title.trim() || baseName(file.name) }, rendered)
      if (signal.aborted) return
      if (!r.ok || !r.url) { setError(r.status === 401 ? 'Sign in to publish.' : r.error || `Publish failed (${r.status})`); return }
      router.push(r.url)
    })
  }

  const lufsLabel = (v: number) => v <= -69 ? '—' : `${v.toFixed(1)} LUFS`
  const peakLabel = (v: number) => v <= -179 ? 'No signal' : `${v.toFixed(1)} dBFS sample peak`

  return (
    <div ref={rootRef} data-local-transport className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Mix &amp; Master <span className="text-[#ccff00]">Studio</span></h1>
          <p className="text-sm text-[#aaa]">Preview your processing in the browser, then export a master. A/B matching and monitor volume affect listening, not the exported level.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {libraryTracks.length > 0 && <label className="max-w-full text-xs text-[#bbb]"><span className="mb-1 block">Load from your library</span><select aria-label="Load from library" defaultValue="" disabled={!!busy || !settingsReady} onChange={e => { loadLibraryTrack(e.target.value); e.target.value = '' }} className="max-w-full sm:max-w-56 bg-[#222] border border-[#555] rounded-full px-3 py-2 text-sm font-bold text-white disabled:opacity-40">
            <option value="">Load from Library</option>
            {libraryTracks.map(t => <option key={t.id} value={t.id} disabled={t.s3Key.startsWith('soundcloud/')}>{t.title}{t.s3Key.startsWith('soundcloud/') ? ' (original audio required)' : ''}</option>)}
          </select></label>}
          <button onClick={() => fileIn.current?.click()} disabled={!!busy || !settingsReady} className="px-4 py-2 rounded-full border border-[#ccff00] text-[#ccff00] font-bold text-sm disabled:opacity-40">{loading ? 'Choose another file' : file ? 'Load another track' : 'Load a track'}</button>
        </div>
        <input ref={fileIn} type="file" aria-label="Choose audio file" accept="audio/*,.wav,.wave,.aif,.aiff,.flac,.mp3,.ogg,.m4a,.aac,.webm" disabled={!!busy || !settingsReady} className="hidden" onChange={e => { load(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      {(busy || status) && <p role="status" className="border-l-2 border-[#d8ff16] bg-[#111511] px-3 py-2 text-sm text-[#dce2d9]">{busy || status}</p>}
      {error && <div role="alert" className="border-l-2 border-[#ff5a36] bg-[#20120e] px-3 py-2 text-sm text-[#ff9d89]">
        {error} {error.startsWith('Sign in') && <Link href="/sign-in" target="_blank" rel="noopener noreferrer" className="font-bold underline">Sign in in a new tab, then retry.</Link>}
      </div>}
      {storageWarning && <p role="status" className="text-xs text-[#ffcf79]">{storageWarning}</p>}
      {libraryStatus === 'error' && <p role="alert" className="text-sm text-[#ff9d89]">Could not load your library. <button onClick={() => setLibraryRevision(value => value + 1)} className="font-bold underline">Retry library</button></p>}
      {libraryStatus === 'signed-out' && <p className="text-xs text-[#aaa]">Local preview and downloads work without an account. <Link href="/sign-in" target="_blank" rel="noopener noreferrer" className="text-[#d8ff16] underline">Sign in</Link> to load your library or publish. <button onClick={() => setLibraryRevision(value => value + 1)} className="underline">Refresh library</button></p>}
      {libraryTracks.some(track => track.s3Key.startsWith('soundcloud/')) && <p className="text-xs text-[#aaa]">SoundCloud imports need original audio for processing. <Link href="/move" target="_blank" rel="noopener noreferrer" className="text-[#d8ff16] underline">Finish your transfer</Link>, then <button onClick={() => setLibraryRevision(value => value + 1)} className="underline">refresh the library</button>.</p>}

      <details open className="rounded-xl border border-[#465329] bg-[#14190f] p-4">
        <summary className="cursor-pointer font-bold text-[#e1f4ac]">New to mastering? Start here</summary>
        <p className="mt-3 text-sm text-[#ccc]">Mastering adjusts the tone, dynamics and final level of a finished mix. Your original file is not overwritten.</p>
        <ol className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <li><strong className="block text-[#e1f4ac]">1. Load your mix</strong><span className="text-[#bbb]">Choose a mono or stereo audio file. Play it at a comfortable monitor volume.</span></li>
          <li><strong className="block text-[#e1f4ac]">2. Try Transparent</strong><span className="text-[#bbb]">Start with the Transparent style and the -14 LUFS target. Presets apply processing and match loudness.</span></li>
          <li><strong className="block text-[#e1f4ac]">3. Compare, then fine-tune</strong><span className="text-[#bbb]">Switch A (original) and B (master). After changing a control, choose Analyze to refresh level-matched comparison.</span></li>
          <li><strong className="block text-[#e1f4ac]">4. Download your master</strong><span className="text-[#bbb]">WAV 24-bit / 48k is a good starting choice. Publishing is a separate, public action.</span></li>
        </ol>
        <p className="mt-3 border-t border-[#465329] pt-3 text-xs leading-relaxed text-[#bbb]">Quick terms: Hz = frequency (low numbers are bass); dB = level change; ms = time in milliseconds; LUFS = average loudness (more negative is quieter); dBFS = digital peak level (0 is the maximum). Each sound control has its own hint and Reset button.</p>
      </details>

      {!file ? (
        <button type="button" disabled={!!busy || !settingsReady} onClick={() => fileIn.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); load(e.dataTransfer.files[0]) }}
          className="w-full rounded-2xl border-2 border-dashed border-[#ccff00]/60 hover:border-[#ccff00] p-8 sm:p-16 text-center cursor-pointer disabled:opacity-40">
          <span className="block text-2xl font-bold">{loading ? 'Decoding your audio...' : 'Drop your mix here'}</span>
          <span className="block text-[#ccc] mt-2">Mono or stereo WAV, AIFF, FLAC or MP3. Click or use the keyboard to choose a file. Selecting another file replaces the pending load.</span>
        </button>
      ) : (
        <>
          <section className="rounded-xl border border-[#333] bg-[#111] p-4 space-y-3" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); load(e.dataTransfer.files[0]) }}>
            <div className="flex justify-between gap-3 text-sm"><span className="min-w-0 flex-1 font-bold truncate">{file.name}</span><span className="shrink-0 font-mono text-[#aaa]">{fmt(time)} / {fmt(duration)}</span></div>
            {buffer && <p className="text-xs font-mono text-[#999]">{buffer.numberOfChannels} channel{buffer.numberOfChannels === 1 ? '' : 's'} / {(buffer.sampleRate / 1000).toFixed(1)} kHz decoded / {(file.size / 1024 / 1024).toFixed(1)} MB / stereo export</p>}
            <div role="slider" aria-label="Preview position" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={Math.min(time, duration)} aria-valuetext={`${fmt(time)} of ${fmt(duration)}`} aria-disabled={locked} tabIndex={locked ? -1 : 0}
              className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d8ff16]"
              onKeyDown={event => {
                if (locked) return
                const step = event.shiftKey ? 10 : 1
                if (['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                  event.preventDefault()
                  seek(event.key === 'Home' ? 0 : event.key === 'End' ? duration : time + (event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -step : step))
                }
              }}>
              <Waveform peaks={peaks} height={90} active progress={duration ? time / duration : 0} onSeek={locked ? undefined : f => seek(f * duration)} />
            </div>
            <p className="text-[11px] text-[#999]">Click or drag to seek. Arrow keys move 1 second; Shift + arrow moves 10 seconds.</p>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => seek(time - 10)} disabled={locked} aria-label="Back 10 seconds" className={`${transportBtn} bg-[#333] text-white border border-[#666]`}>Back 10s</button>
              <button onClick={toggle} disabled={!buffer || locked || startingPlayback} className={`${transportBtn} px-6 bg-[#ccff00] text-black`}>{startingPlayback ? 'Starting...' : playing ? 'Pause' : 'Play'}</button>
              <button onClick={stop} className={`${transportBtn} bg-[#333] text-white border border-[#666]`}>Stop</button>
              <button onClick={() => seek(time + 10)} disabled={locked} aria-label="Forward 10 seconds" className={`${transportBtn} bg-[#333] text-white border border-[#666]`}>Forward 10s</button>
              <div className="flex rounded-lg overflow-hidden border border-[#555] ml-2">
                <button onClick={() => setBypass(true)} disabled={locked} aria-pressed={bypass} aria-describedby="studio-ab-help" className={`px-4 py-2 text-sm font-black ${bypass ? 'bg-white text-black' : 'bg-[#222] text-[#aaa]'}`}>A · Original</button>
                <button onClick={() => setBypass(false)} disabled={locked} aria-pressed={!bypass} aria-describedby="studio-ab-help" className={`px-4 py-2 text-sm font-black ${!bypass ? 'bg-[#ccff00] text-black' : 'bg-[#222] text-[#aaa]'}`}>B · Master</button>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#ccc]">
                <input type="checkbox" checked={levelMatch && canLevelMatch} disabled={!canLevelMatch || locked} aria-describedby="studio-ab-help" onChange={e => setLevelMatch(e.target.checked)} className="accent-[#ccff00]" /> Level-matched A/B
              </label>
              <label className="ml-auto flex flex-wrap items-center gap-2 text-xs text-[#ccc]">Monitor volume
                <input type="range" min={0} max={1} step={0.01} value={volume} aria-valuetext={`${Math.round(volume * 100)}%`} aria-describedby="studio-monitor-help" onChange={e => setVolume(Number(e.target.value))} className="w-24 accent-[#ccff00]" />
                <span aria-hidden="true" className="font-mono">{Math.round(volume * 100)}%</span>
              </label>
            </div>
            <p id="studio-ab-help" className="text-xs leading-relaxed text-[#aaa]">A plays your untouched mix; B plays the processed master. Level matching turns down the louder preview for a fair comparison instead of making either one louder.</p>
            <p id="studio-monitor-help" className="text-xs leading-relaxed text-[#aaa]">Monitor volume changes listening level only, not the download. Stop pauses and returns to the beginning.</p>
            {!canLevelMatch && <p className="text-xs text-[#999]">Analyze the current settings to enable level-matched A/B. Monitoring does not change the export.</p>}
            <Meters left={graph?.left ?? null} right={graph?.right ?? null} spectrum={graph?.spectrum ?? null} running={playing} />
            {url && <audio ref={audioRef} src={url} preload="auto" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />}
          </section>

          <fieldset disabled={locked} className="min-w-0 space-y-5 border-0 p-0 disabled:opacity-70">
          <legend className="sr-only">Master processing and export</legend>
          <Section title="ONE-CLICK AUTO MASTER" description="Choose a style to set the sound controls and match average loudness in one step. Start with Transparent for subtle processing, then make small adjustments below.">
            <label className="block text-sm font-bold text-[#ddd]">Loudness target
              <select value={target} aria-describedby="studio-target-help" onChange={e => setTarget(Number(e.target.value))} className="mt-1 block max-w-full bg-[#222] border border-[#555] rounded-lg px-3 py-2 text-sm font-bold">
                {TARGETS.map(t => <option key={t.lufs} value={t.lufs}>{t.label}</option>)}
              </select>
            </label>
            <p id="studio-target-help" className="mt-2 text-xs leading-relaxed text-[#aaa]">LUFS estimates average loudness. -14 LUFS is a useful starting point, not a delivery requirement. Louder targets can reduce punch; choose the sound you prefer.</p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.keys(PRESETS).map((p, index) => (
                <button key={p} onClick={() => autoMaster(p)} disabled={!buffer || !!busy} aria-label={`${p} auto-master`} aria-pressed={preset === p} aria-describedby={`studio-preset-${index}`}
                  className={`px-3 py-3 rounded-lg text-left text-sm border disabled:opacity-40 ${preset === p ? 'bg-[#ccff00] text-black border-[#ccff00]' : 'bg-[#222] text-white border-[#555] hover:bg-[#333]'}`}>
                  <span className="block font-bold">{p}</span><span id={`studio-preset-${index}`} className={`mt-1 block text-xs leading-relaxed ${preset === p ? 'text-black/80' : 'text-[#bbb]'}`}>{PRESET_HINTS[p]}</span>
                </button>
              ))}
            </div>
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="EQUALIZER" description="Shape the balance of bass, mids and treble. Positive dB boosts a range; negative dB reduces it. Try small changes of 1-2 dB first."
              right={<button onClick={() => { setS(p => ({ ...p, eq: [0, 0, 0, 0, 0], lowCut: 20 })); invalidateAnalysis() }} className="shrink-0 text-xs text-[#ccc] underline">Reset EQ</button>}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-3">
                <Slider label="Low Cut" hint="Removes very low rumble. Start around 20-30 Hz; higher values can thin out bass." value={s.lowCut} min={20} max={200} step={1} unit=" Hz" digits={0} def={20} onChange={v => set('lowCut', v)} />
                {EQ_BANDS.map((b, i) => (
                  <Slider key={b.f} label={`${b.label} (${b.f >= 1000 ? `${b.f / 1000}k` : b.f} Hz)`} hint={EQ_HINTS[i]} value={s.eq[i]} min={-12} max={12} unit=" dB" def={0} onChange={v => setBand(i, v)} />
                ))}
              </div>
            </Section>

            <Section title="DYNAMICS" description="Compression controls loud moments and evens out the mix. Gentle settings can add control; too much can flatten the punch.">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-3">
                <Slider label="Threshold" hint="Compression starts above this level. Lower it to control more of the loud parts." value={s.compThreshold} min={-48} max={0} unit=" dB" def={DEFAULTS.compThreshold} onChange={v => set('compThreshold', v)} />
                <Slider label="Ratio" hint="How strongly loud moments are compressed. Try 2:1 for gentle control; higher ratios sound firmer." value={s.compRatio} min={1} max={20} unit=":1" def={DEFAULTS.compRatio} onChange={v => set('compRatio', v)} />
                <Slider label="Knee" hint="Softens the transition into compression. Higher values make it more gradual." value={s.compKnee} min={0} max={30} step={1} unit=" dB" digits={0} def={DEFAULTS.compKnee} onChange={v => set('compKnee', v)} />
                <Slider label="Attack" hint="How quickly compression reacts. Shorter times tame hits; longer times let punch through." value={s.compAttack} min={0.5} max={100} step={0.5} unit=" ms" def={DEFAULTS.compAttack} onChange={v => set('compAttack', v)} />
                <Slider label="Release" hint="How quickly compression lets go. If the mix pumps or breathes, try a longer time." value={s.compRelease} min={20} max={1000} step={5} unit=" ms" digits={0} def={DEFAULTS.compRelease} onChange={v => set('compRelease', v)} />
                <Slider label="Makeup Gain" hint="Raises or lowers the level after compression. This is not the final loudness target." value={s.makeup} min={-12} max={12} unit=" dB" def={0} onChange={v => set('makeup', v)} />
              </div>
            </Section>

            <Section title="COLOR & WIDTH" description="Add character or change the stereo spread. These are optional: leave them at their starting values for a cleaner sound.">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-3">
                <Slider label="Mega Bass" hint="Boosts deep bass near 55 Hz. Start with a small amount to avoid boom." value={s.megaBass} min={0} max={12} unit=" dB" def={0} onChange={v => set('megaBass', v)} />
                <Slider label="Saturation" hint="Adds harmonic color and grit. Start low; more can sound distorted." value={s.drive} min={0} max={100} step={1} unit="%" digits={0} def={0} onChange={v => set('drive', v)} />
                <Slider label="Saturation Mix" hint="Blends colored and clean sound. Only changes the result when Saturation is above 0%." value={s.satMix} min={0} max={100} step={1} unit="%" digits={0} def={100} onChange={v => set('satMix', v)} />
                <Slider label="Stereo Width" hint="100% keeps the spread; 0% is mono. Above 100% widens stereo material. Check the phase meter." value={s.width} min={0} max={200} step={1} unit="%" digits={0} def={100} onChange={v => set('width', v)} />
                <Slider label="Input Gain" hint="Changes the level entering all processing. Reduce it if the chain sounds overdriven." value={s.inputGain} min={-12} max={12} unit=" dB" def={0} onChange={v => set('inputGain', v)} />
              </div>
            </Section>

            <Section title="LOUDNESS & LIMITER" description="Set the exported level and control peaks. Analyze measures the current settings without changing them; Match loudness adjusts output gain toward your chosen target.">
              <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                <Slider label="Output Gain" hint="Changes the level before the limiter and in your export. Use Monitor volume for listening only." value={s.outputGain} min={-12} max={24} unit=" dB" def={0} onChange={v => set('outputGain', v)} />
                <Slider label="Peak Ceiling" hint="Caps sample peaks after processing. -1 dBFS is a useful starting point, not a true-peak guarantee." value={s.ceiling} min={-3} max={0} step={0.1} unit=" dBFS" def={-1} onChange={v => set('ceiling', v)} />
                <Slider label="Limiter Release" hint="How quickly the limiter lets go after a loud peak. Shorter times can sound tighter; longer times sound smoother. Orbit Master uses 80 ms." value={s.limiterRelease} min={10} max={250} step={1} unit=" ms" digits={0} def={80} onChange={v => set('limiterRelease', v)} />
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={() => matchLoudness()} disabled={!buffer || !!busy} className="px-3 py-2 rounded-lg bg-[#ccff00] text-black text-sm font-bold disabled:opacity-40">Match loudness to target</button>
                <button onClick={() => runJob('Analyzing...', async () => { await analyze(); if (mounted.current) setStatus('Analysis updated for the current processing settings.') })} disabled={!buffer || !!busy} className="px-3 py-2 rounded-lg bg-[#222] border border-[#555] text-sm font-bold disabled:opacity-40">Analyze</button>
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs text-[#ccc]">
                <input type="checkbox" checked={s.lookahead} onChange={e => set('lookahead', e.target.checked)} className="accent-[#ccff00]" /> Lookahead limiter (5 ms render-time safety pass)
              </label>
              {analysis && (
                <div role="group" aria-label="Loudness analysis" className="grid grid-cols-2 gap-3 mt-3 text-sm">
                  <div className="rounded bg-[#0a0a0a] border border-[#333] p-2"><div className="text-xs text-[#aaa]">{buffer?.numberOfChannels === 1 ? 'Original (stereo preview)' : 'Original'}</div><div className="font-mono">{lufsLabel(analysis.inLufs)}</div><div className="font-mono text-xs text-[#aaa]">{peakLabel(analysis.inPeak)}</div></div>
                  <div className="rounded bg-[#0a0a0a] border border-[#ccff00]/50 p-2"><div className="text-xs text-[#aaa]">Master</div><div className="font-mono text-[#ccff00]">{lufsLabel(analysis.outLufs)}</div><div className="font-mono text-xs text-[#aaa]">{peakLabel(analysis.outPeak)}</div></div>
                </div>
              )}
              <p className="mt-3 text-xs text-[#999]">Integrated loudness is an estimate; sample peaks are not true-peak certification. Processing changes clear the previous analysis.</p>
            </Section>
          </div>

          <Section title="EXPORT & RELEASE" description="Download a processed copy to your device, or publish a public track to SolidSoundZ. Both use the processing settings, not the A/B choice or monitor volume.">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-0 max-w-full"><span className="mb-1 block text-xs font-bold text-[#ddd]">Download format</span><FormatSelect value={format} onChange={setFormat} /></label>
              <button onClick={exportMaster} disabled={!buffer || !!busy} aria-describedby="studio-format-help" className="px-4 py-2 rounded-lg bg-white text-black text-sm font-bold disabled:opacity-40">Download master</button>
              <label className="flex items-center gap-2 text-xs text-[#ccc]"><input type="checkbox" checked={keepRate} onChange={e => setKeepRate(e.target.checked)} aria-describedby="studio-format-help" className="accent-[#ccff00]" /> Keep original sample rate</label>
              <label className="min-w-0 basis-44 flex-1"><span className="mb-1 block text-xs font-bold text-[#ddd]">Release title</span><input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Name your track" className="w-full bg-[#0a0a0a] border border-[#555] rounded-lg px-3 py-2 text-sm" /></label>
              <button onClick={masterAndPublish} disabled={!buffer || !!busy} aria-describedby="studio-publish-help" className="px-4 py-2 rounded-lg bg-[#ccff00] text-black text-sm font-bold disabled:opacity-40">Master &amp; Publish</button>
            </div>
            <p id="studio-format-help" className="mt-3 text-xs leading-relaxed text-[#aaa]">Not sure which format? Start with WAV 24-bit / 48k for a high-quality master. MP3 makes a smaller listening copy. A higher export sample rate does not restore detail missing from the source. Keep original sample rate skips resampling — the export stays at your mix's own rate instead of 44.1k / 48k / 96k.</p>
            {qc && (
              <div className="mt-3 rounded border border-[#333] bg-[#0a0a0a] p-3" role="group" aria-label="Export checker results">
                <h3 className="text-[11px] uppercase tracking-wider text-[#aaa]">Export checker</h3>
                <ul className="mt-2 space-y-1 text-xs">
                  {qc.map(c => (
                    <li key={c.label} className={c.pass ? 'text-[#ccff00]' : 'text-[#ff5a36]'}>
                      {c.pass ? 'PASS' : 'FAIL'} · {c.label}: {c.detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p id="studio-publish-help" className="mt-2 text-xs leading-relaxed text-[#aaa]">Download stays on your device. Master &amp; Publish creates a public WAV track on your signed-in account; the download format only applies to Download master.</p>
            <div className="mt-4 border-t border-[#333] pt-3">
              <button onClick={() => { setS({ ...DEFAULTS, eq: [...DEFAULTS.eq] }); invalidateAnalysis() }} aria-describedby="studio-reset-help" className="text-sm text-[#ccc] underline">Reset processing</button>
              <p id="studio-reset-help" className="mt-1 text-xs text-[#999]">Restores all sound controls to their starting values. Keeps your loaded file.</p>
            </div>
          </Section>
          </fieldset>
        </>
      )}
    </div>
  )
}
