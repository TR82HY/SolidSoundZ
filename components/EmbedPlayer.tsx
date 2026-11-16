'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { TrackCardData } from '@/lib/queries'
import { fmt } from '@/lib/audio'
import { compact } from '@/lib/format'
import Waveform from './Waveform'
import BrandLogo from './BrandLogo'
import SoundCloudWidget, { type SoundCloudControls } from './player/SoundCloudWidget'

const PLAY_THRESHOLD = 30

// Standalone player for iframes on other websites; links open the full site in a new tab.
export default function EmbedPlayer({ t, siteUrl }: { t: TrackCardData, siteUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const soundCloudRef = useRef<SoundCloudControls | null>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(t.duration)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const retryPlayback = useRef(false)
  const listened = useRef({ secs: 0, last: 0, reported: false })
  const usesSoundCloudWidget = Boolean(t.soundCloudPlayback && t.scUrl)
  const setSoundCloudController = useCallback((controller: SoundCloudControls | null) => { soundCloudRef.current = controller; if (controller && retryPlayback.current) { retryPlayback.current = false; controller.play() } }, [])
  const onSoundCloudPlay = useCallback(() => { setPlaying(true); setError('') }, [])
  const onSoundCloudPause = useCallback(() => setPlaying(false), [])
  const onSoundCloudProgress = useCallback((seconds: number) => setTime(seconds), [])
  const onSoundCloudDuration = useCallback((seconds: number) => setDuration(seconds), [])

  useEffect(() => {
    if (!playing || usesSoundCloudWidget) return
    let id = 0
    const tick = () => { if (audioRef.current) setTime(audioRef.current.currentTime); id = requestAnimationFrame(tick) }
    tick()
    return () => cancelAnimationFrame(id)
  }, [playing, usesSoundCloudWidget])

  const onTimeUpdate = () => {
    const a = audioRef.current, l = listened.current
    if (!a) return
    const delta = a.currentTime - l.last
    if (delta > 0 && delta < 1.5) l.secs += delta
    l.last = a.currentTime
    if (!l.reported && l.secs >= Math.min(PLAY_THRESHOLD, (a.duration || t.duration || 60) * 0.5)) {
      l.reported = true
      fetch(`/api/tracks/${t.id}/play`, { method: 'POST' }).catch(() => {})
    }
  }

  const toggle = () => {
    if (usesSoundCloudWidget) {
      if (error) { setError(''); retryPlayback.current = true; setRetry(value => value + 1); return }
      if (playing) soundCloudRef.current?.pause()
      else soundCloudRef.current?.play()
      return
    }
    const audio = audioRef.current
    if (audio) {
      if (audio.paused) { setError(''); void audio.play().catch(() => setError('Audio could not start. Retry or open the release.')) }
      else audio.pause()
    }
  }
  const seek = (f: number) => {
    if (!duration) return
    const nextTime = Math.min(1, Math.max(0, f)) * duration
    if (usesSoundCloudWidget) {
      soundCloudRef.current?.seek(nextTime)
      setTime(nextTime)
      return
    }
    const a = audioRef.current
    if (!a) return
    a.currentTime = nextTime
    listened.current.last = a.currentTime
    setTime(a.currentTime)
  }
  const trackUrl = `${siteUrl}/t/${t.id}`

  return (
    <div className="fixed inset-0 flex bg-[#0f0f0f] text-white overflow-hidden select-none">
      <a href={trackUrl} target="_blank" rel="noopener noreferrer" className="h-full aspect-square flex-shrink-0 bg-gradient-to-br from-[#ccff00] via-[#4d5e00] to-[#111] flex items-center justify-center text-black font-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {t.artUrl ? <img src={t.artUrl} alt={t.title} className="h-full w-full object-cover" /> : 'SSZ'}
      </a>
      <div className="flex-1 min-w-0 flex flex-col p-3 gap-2">
        <div className="flex items-start gap-3">
          <button onClick={toggle} aria-label={error ? 'Retry playback' : playing ? 'Pause' : 'Play'} className="w-11 h-11 rounded-full bg-[#ccff00] text-black flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">{playing ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}</svg>
          </button>
          <div className="min-w-0 flex-1">
            <a href={`${siteUrl}/artist/${t.artistSlug}`} target="_blank" rel="noopener noreferrer" className="block text-xs text-[#aaa] hover:text-white truncate">{t.artist}</a>
            <a href={trackUrl} target="_blank" rel="noopener noreferrer" className="block text-sm font-bold hover:text-[#ccff00] truncate">{t.title}</a>
          </div>
          <a href={siteUrl} target="_blank" rel="noopener noreferrer" aria-label="Open SolidSoundZ" className="shrink-0 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d8ff16]">
            <BrandLogo variant="mark" className="h-7 w-7" />
          </a>
        </div>
        <div className="flex-1 min-h-0 flex items-center">
          {error ? <p role="alert" className="text-xs text-[#ffb9a8]">{error}</p> : <Waveform peaks={t.peaks} seed={t.id} progress={duration ? time / duration : 0} onSeek={seek} active={playing} height={48} seekLabel={`Playback position for ${t.title}`} duration={duration} />}
        </div>
        <div className="flex items-center justify-between text-[11px] text-[#999] font-mono">
          <span>{fmt(time)} / {fmt(duration)}</span>
          <span>▶ {compact(t.plays + t.scPlays)}</span>
          <a href={trackUrl} target="_blank" rel="noopener noreferrer" className="font-sans font-bold text-[#ccff00] hover:underline">Listen on SolidSoundZ</a>
        </div>
      </div>
      <audio ref={audioRef} src={usesSoundCloudWidget ? undefined : t.audioUrl} preload="metadata" onPlay={() => { setPlaying(true); setError('') }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => setError('Audio is unavailable. Retry or open the release.')}
        onLoadedMetadata={() => { if (audioRef.current?.duration) setDuration(audioRef.current.duration) }} onTimeUpdate={onTimeUpdate} />
      <SoundCloudWidget key={`${t.id}:${retry}`} url={usesSoundCloudWidget ? t.scUrl ?? null : null} volume={1} autoPlay={false}
        onController={setSoundCloudController} onPlay={onSoundCloudPlay} onPause={onSoundCloudPause}
        onProgress={onSoundCloudProgress} onDuration={onSoundCloudDuration} onEnded={onSoundCloudPause} onError={setError} />
    </div>
  )
}
