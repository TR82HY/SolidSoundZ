'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { isPlayerTrack, parseSavedQueue, playerSourceKey, type PlayerTrack, type QueueSelection } from '@/lib/player'
import { stopAll, useSpaceToToggle, useTransport } from '@/lib/transport'
import SoundCloudWidget, { type SoundCloudControls } from './SoundCloudWidget'

export type { PlayerTrack } from '@/lib/player'
type Player = {
  current: PlayerTrack | null, queue: PlayerTrack[], playing: boolean, loading: boolean, error: string, notice: string, volume: number,
  play: (track: PlayerTrack, queue?: PlayerTrack[], at?: number) => void,
  toggle: () => void, pause: () => void, stop: () => void, seek: (time: number) => void,
  next: () => void, prev: () => void, retry: () => void, setVolume: (volume: number) => void,
  setLiked: (id: string, liked: boolean, likes: number) => void,
  removeFromQueue: (id: string) => void, clearQueue: () => void,
}
const PlayerCtx = createContext<Player | null>(null)
const TimeCtx = createContext({ time: 0, duration: 0 })
export const usePlayer = () => useContext(PlayerCtx)!
export const usePlayerTime = () => useContext(TimeCtx)

export default function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelection] = useState<QueueSelection>({ queue: [], index: -1 })
  const selectionRef = useRef(selection)
  const audioRef = useRef<HTMLAudioElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const soundCloudRef = useRef<SoundCloudControls | null>(null)
  const wantsToPlay = useRef(false)
  const playRequest = useRef(0)
  const nextRequest = useRef<AbortController | null>(null)
  const retryKind = useRef<'playback' | 'next'>('playback')
  const pendingSeek = useRef<number | null>(null)
  const timeRef = useRef(0)
  const durationRef = useRef(0)
  const mounted = useRef(true)
  const listened = useRef({ id: '', secs: 0, last: 0, reported: false })
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.9)
  const [ready, setReady] = useState(false)
  const [retryVersion, setRetryVersion] = useState(0)
  const { queue, index } = selection
  const current = queue[index] ?? null
  const sourceKey = playerSourceKey(current)
  const usesSoundCloud = !!current?.soundCloudPlayback
  const currentTrack = useCallback(() => selectionRef.current.queue[selectionRef.current.index] ?? null, [])

  const commit = useCallback((value: QueueSelection) => {
    selectionRef.current = value
    setSelection(value)
  }, [])
  const updateTime = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return
    timeRef.current = seconds
    setTime(seconds)
  }, [])
  const updateDuration = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return
    durationRef.current = seconds
    setDuration(seconds)
  }, [])
  const storageWarning = useCallback(() => {
    console.warn('Playback preferences could not be saved or restored.')
    setNotice('This browser could not restore or save playback preferences. Playback still works.')
  }, [])

  useEffect(() => {
    mounted.current = true
    try {
      const saved = localStorage.getItem('ssz-queue')
      if (saved) {
        const restored = parseSavedQueue(JSON.parse(saved))
        pendingSeek.current = restored.time
        commit({ queue: restored.queue, index: restored.index })
      }
    } catch { storageWarning() }
    try {
      const saved = localStorage.getItem('ssz-volume')
      if (saved !== null) {
        const value = Number(saved)
        if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Invalid saved volume.')
        setVolumeState(value)
      }
    } catch { storageWarning() }
    setReady(true)
    return () => {
      mounted.current = false
      wantsToPlay.current = false
      playRequest.current++
      nextRequest.current?.abort()
    }
  }, [commit, storageWarning])

  useEffect(() => {
    if (!ready) return
    const save = () => {
      try { localStorage.setItem('ssz-queue', JSON.stringify({ ...selectionRef.current, time: timeRef.current })) }
      catch { storageWarning() }
    }
    save()
    const timer = setInterval(save, 5000)
    window.addEventListener('pagehide', save)
    return () => { clearInterval(timer); window.removeEventListener('pagehide', save) }
  }, [selection, ready, playing, storageWarning])
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
    soundCloudRef.current?.setVolume(volume)
  }, [volume, sourceKey])

  const pause = useCallback(() => {
    wantsToPlay.current = false
    playRequest.current++
    nextRequest.current?.abort(); nextRequest.current = null
    audioRef.current?.pause()
    soundCloudRef.current?.pause()
    setPlaying(false); setLoading(false)
  }, [])
  const fail = useCallback((message: string) => {
    if (!mounted.current) return
    pause()
    setError(message)
  }, [pause])
  const startNative = useCallback((audio: HTMLAudioElement) => {
    const request = ++playRequest.current
    setLoading(true)
    void audio.play().then(() => {
      if (!wantsToPlay.current || audioRef.current !== audio) audio.pause()
    }).catch(error => {
      if (!mounted.current || request !== playRequest.current || !wantsToPlay.current || audioRef.current !== audio) return
      fail(error instanceof Error && error.name === 'NotAllowedError'
        ? 'Your browser paused playback. Press Play to start listening.'
        : 'This audio could not start. Retry, or choose another track.')
    })
  }, [fail])

  // Metadata updates must not recreate or restart a transport.
  useEffect(() => {
    const track = currentTrack()
    setPlaying(false); setError('')
    retryKind.current = 'playback'
    durationRef.current = track?.duration ?? 0
    setDuration(durationRef.current)
    updateTime(pendingSeek.current ?? 0)
    listened.current = { id: track?.id ?? '', secs: 0, last: pendingSeek.current ?? 0, reported: false }
    setLoading(!!track && wantsToPlay.current)
    const audio = audioRef.current
    if (!track) { audio?.removeAttribute('src'); audio?.load(); return }
    if (track.soundCloudPlayback) {
      audio?.load()
      if (!track.scUrl || track.scAccess && track.scAccess !== 'playable') fail('This SoundCloud source is not available for full playback. Open the original or choose another track.')
    } else if (audio) {
      audio.load()
      if (wantsToPlay.current) startNative(audio)
    }
    return () => { audio?.pause() }
  }, [sourceKey, retryVersion, currentTrack, fail, startNative, updateTime])

  useEffect(() => {
    if (!playing || usesSoundCloud) return
    let frame = 0
    const tick = () => { if (audioRef.current) updateTime(audioRef.current.currentTime); frame = requestAnimationFrame(tick) }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, usesSoundCloud, updateTime])

  const recordProgress = useCallback((seconds: number) => {
    const track = currentTrack(), progress = listened.current
    if (!track || !wantsToPlay.current || progress.id !== track.id || !Number.isFinite(seconds)) return
    const delta = seconds - progress.last
    if (delta > 0 && delta < 1.5) progress.secs += delta
    progress.last = seconds
    const threshold = Math.min(30, (durationRef.current || track.duration || 60) * 0.5)
    if (!progress.reported && progress.secs >= threshold) {
      progress.reported = true
      void fetch(`/api/tracks/${track.id}/play`, { method: 'POST' }).then(response => {
        if (!response.ok) throw new Error(`Play reporting HTTP ${response.status}`)
      }).catch(error => console.warn('Listening activity could not be recorded.', error instanceof Error ? error.message : 'Network error'))
    }
  }, [currentTrack])

  const seek = useCallback((seconds: number) => {
    const track = currentTrack()
    if (!track || !Number.isFinite(seconds)) return
    const nextTime = Math.max(0, Math.min(seconds, durationRef.current || track.duration || 0))
    listened.current.last = nextTime
    pendingSeek.current = nextTime
    updateTime(nextTime)
    if (track.soundCloudPlayback && soundCloudRef.current) {
      soundCloudRef.current.seek(nextTime)
      pendingSeek.current = null
    } else if (!track.soundCloudPlayback && audioRef.current && audioRef.current.readyState >= 1) {
      audioRef.current.currentTime = nextTime
      pendingSeek.current = null
    }
  }, [currentTrack, updateTime])
  const play = useCallback((track: PlayerTrack, list?: PlayerTrack[], at?: number) => {
    if (!isPlayerTrack(track)) { fail('This track has incomplete playback information. Refresh the page and try again.'); return }
    const sameSource = playerSourceKey(currentTrack()) === playerSourceKey(track)
    const nextQueue = Array.from(new Map((list?.length ? list : sameSource ? selectionRef.current.queue : [track]).map(item => [item.id, item])).values())
    if (!nextQueue.some(item => item.id === track.id)) nextQueue.unshift(track)
    const nextIndex = nextQueue.findIndex(item => item.id === track.id)
    nextQueue[nextIndex] = track
    stopAll()
    wantsToPlay.current = true
    setError(''); setNotice(''); setLoading(true); retryKind.current = 'playback'
    if (!sameSource) {
      pendingSeek.current = at ?? 0
      durationRef.current = track.duration
      updateTime(at ?? 0)
    }
    commit({ queue: nextQueue, index: nextIndex })
    if (track.soundCloudPlayback && (!track.scUrl || track.scAccess && track.scAccess !== 'playable')) {
      fail('This SoundCloud source is not available for full playback. Open the original or choose another track.')
      return
    }
    if (sameSource) {
      if (at !== undefined) seek(at)
      if (track.soundCloudPlayback) soundCloudRef.current?.play()
      else if (audioRef.current) startNative(audioRef.current)
    }
  }, [commit, currentTrack, fail, seek, startNative, updateTime])
  const toggle = useCallback(() => {
    const track = currentTrack()
    if (!track) return
    if (playing || loading) pause()
    else play(track, selectionRef.current.queue)
  }, [currentTrack, loading, pause, play, playing])
  const stop = useCallback(() => { pause(); seek(0) }, [pause, seek])
  const next = useCallback(async () => {
    const snapshot = selectionRef.current
    const track = snapshot.queue[snapshot.index]
    if (!track || nextRequest.current) return
    if (snapshot.index < snapshot.queue.length - 1) { play(snapshot.queue[snapshot.index + 1], snapshot.queue); return }
    pause()
    const controller = new AbortController()
    nextRequest.current = controller
    setLoading(true); setError(''); retryKind.current = 'next'
    try {
      const skip = snapshot.queue.slice(-50).map(track => track.id).join(',')
      const response = await fetch(`/api/next?after=${encodeURIComponent(track.id)}&skip=${encodeURIComponent(skip)}`, { signal: controller.signal, cache: 'no-store' })
      if (!response.ok) throw new Error('Could not load the next track.')
      const data: unknown = await response.json()
      if (!data || typeof data !== 'object' || !('track' in data) || data.track !== null && !isPlayerTrack(data.track)) throw new Error('Invalid next-track response.')
      if (controller.signal.aborted || nextRequest.current !== controller || playerSourceKey(currentTrack()) !== playerSourceKey(track)) return
      nextRequest.current = null
      const nextTrack = data.track
      if (nextTrack) play(nextTrack, [...selectionRef.current.queue.filter(item => item.id !== nextTrack.id), nextTrack])
      else { setLoading(false); setNotice('You have reached the end of the available queue. Choose another release to keep listening.') }
    } catch {
      if (!controller.signal.aborted && mounted.current) { setLoading(false); setError('The next track could not be loaded. Retry or choose a release.'); retryKind.current = 'next' }
    } finally {
      if (nextRequest.current === controller) {
        nextRequest.current = null
        if (mounted.current && !controller.signal.aborted) setLoading(false)
      }
    }
  }, [currentTrack, pause, play])
  const nextRef = useRef(next)
  nextRef.current = next
  const prev = useCallback(() => {
    const snapshot = selectionRef.current
    if (timeRef.current > 3 || snapshot.index <= 0) seek(0)
    else play(snapshot.queue[snapshot.index - 1], snapshot.queue)
  }, [play, seek])
  const retry = useCallback(() => {
    if (retryKind.current === 'next') { void next(); return }
    if (!currentTrack()) return
    stopAll()
    wantsToPlay.current = true
    pendingSeek.current = timeRef.current
    setError(''); setLoading(true); setRetryVersion(value => value + 1)
  }, [currentTrack, next])
  const setVolume = useCallback((value: number) => {
    if (!Number.isFinite(value) || value < 0 || value > 1) { console.error('Invalid playback volume.'); return }
    setVolumeState(value)
    try { localStorage.setItem('ssz-volume', String(value)) } catch { storageWarning() }
  }, [storageWarning])
  const setLiked = useCallback((id: string, liked: boolean, likes: number) => {
    const snapshot = selectionRef.current
    commit({ ...snapshot, queue: snapshot.queue.map(track => track.id === id ? { ...track, liked, likes } : track) })
  }, [commit])
  const clearQueue = useCallback(() => {
    pause(); commit({ queue: [], index: -1 }); pendingSeek.current = null
    updateTime(0); durationRef.current = 0; setDuration(0); setError(''); setNotice('')
  }, [commit, pause, updateTime])
  const removeFromQueue = useCallback((id: string) => {
    const snapshot = selectionRef.current
    const removed = snapshot.queue.findIndex(track => track.id === id)
    if (removed < 0) return
    const items = snapshot.queue.filter(track => track.id !== id)
    if (!items.length) { clearQueue(); return }
    if (removed === snapshot.index) pause()
    commit({ queue: items, index: Math.max(0, Math.min(items.length - 1, snapshot.index - (removed < snapshot.index ? 1 : 0))) })
  }, [clearQueue, commit, pause])
  const setSoundCloudController = useCallback((controller: SoundCloudControls | null) => {
    soundCloudRef.current = controller
    if (!controller) return
    if (pendingSeek.current !== null) { controller.seek(pendingSeek.current); pendingSeek.current = null }
    if (wantsToPlay.current) controller.play()
    else controller.pause()
  }, [])
  const onSoundCloudPlay = useCallback(() => {
    if (!wantsToPlay.current) { soundCloudRef.current?.pause(); return }
    setPlaying(true); setLoading(false); setError('')
  }, [])
  const onSoundCloudPause = useCallback(() => { setPlaying(false); setLoading(false) }, [])
  const onSoundCloudProgress = useCallback((seconds: number) => { updateTime(seconds); recordProgress(seconds) }, [recordProgress, updateTime])
  const onSoundCloudEnded = useCallback(() => { setPlaying(false); wantsToPlay.current = false; void nextRef.current() }, [])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => { const track = currentTrack(); if (track) play(track, selectionRef.current.queue) }],
      ['pause', pause], ['stop', stop], ['previoustrack', prev], ['nexttrack', () => void next()],
      ['seekbackward', event => seek(timeRef.current - (event.seekOffset ?? 10))],
      ['seekforward', event => seek(timeRef.current + (event.seekOffset ?? 10))],
      ['seekto', event => { if (event.seekTime !== undefined) seek(event.seekTime) }],
    ]
    const supported: MediaSessionAction[] = []
    for (const [action, handler] of handlers) {
      try { navigator.mediaSession.setActionHandler(action, handler); supported.push(action) }
      catch (error) { console.debug(`Media controls do not support ${action}.`, error instanceof Error ? error.name : 'Unsupported action') }
    }
    return () => { for (const action of supported) navigator.mediaSession.setActionHandler(action, null) }
  }, [currentTrack, next, pause, play, prev, seek, stop])
  useEffect(() => {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return
    navigator.mediaSession.metadata = current ? new MediaMetadata({ title: current.title, artist: current.artist, album: 'SolidSoundZ', artwork: current.artUrl ? [{ src: current.artUrl }] : [] }) : null
    navigator.mediaSession.playbackState = current ? playing ? 'playing' : 'paused' : 'none'
  }, [current, playing])
  const wholeSecond = Math.floor(time)
  useEffect(() => {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return
    if (duration > 0 && Number.isFinite(duration)) navigator.mediaSession.setPositionState({ duration, position: Math.min(duration, Math.max(0, wholeSecond)), playbackRate: 1 })
    else navigator.mediaSession.setPositionState()
  }, [wholeSecond, duration])

  useSpaceToToggle()
  useTransport(rootRef, { toggle, stop: pause }, { global: true })
  const value = useMemo<Player>(() => ({ current, queue, playing, loading, error, notice, volume, play, toggle, pause, stop, seek, next, prev, retry, setVolume, setLiked, removeFromQueue, clearQueue }),
    [current, queue, playing, loading, error, notice, volume, play, toggle, pause, stop, seek, next, prev, retry, setVolume, setLiked, removeFromQueue, clearQueue])
  const nativeEvent = (audio: HTMLAudioElement) => {
    const track = currentTrack()
    return audio === audioRef.current && !!track && !track.soundCloudPlayback
      && (!audio.currentSrc || audio.currentSrc === new URL(track.audioUrl, location.href).href)
  }
  return <PlayerCtx.Provider value={value}><TimeCtx.Provider value={{ time, duration }}>
    <div ref={rootRef}>{children}</div>
    <div aria-hidden="true">
    <audio ref={audioRef} src={current && !usesSoundCloud ? current.audioUrl : undefined} preload="metadata"
      onPlay={event => { if (nativeEvent(event.currentTarget)) { if (!wantsToPlay.current) event.currentTarget.pause(); else setPlaying(true) } }}
      onPlaying={event => { if (nativeEvent(event.currentTarget) && wantsToPlay.current) { setLoading(false); setPlaying(true); setError('') } }}
      onPause={event => { if (nativeEvent(event.currentTarget)) { setPlaying(false); updateTime(event.currentTarget.currentTime) } }}
      onWaiting={event => { if (nativeEvent(event.currentTarget) && wantsToPlay.current) setLoading(true) }}
      onCanPlay={event => { if (nativeEvent(event.currentTarget)) setLoading(false) }}
      onError={event => { if (nativeEvent(event.currentTarget) && currentTrack()) fail('The original audio is unavailable or unsupported by this browser. Retry or choose another track.') }}
      onEnded={event => { if (nativeEvent(event.currentTarget)) { setPlaying(false); wantsToPlay.current = false; void next() } }}
      onLoadedMetadata={event => {
        if (!nativeEvent(event.currentTarget)) return
        updateDuration(event.currentTarget.duration)
        if (pendingSeek.current !== null) seek(pendingSeek.current)
      }}
      onTimeUpdate={event => { if (nativeEvent(event.currentTarget)) recordProgress(event.currentTarget.currentTime) }} />
    <SoundCloudWidget key={`${sourceKey}:${retryVersion}`} url={usesSoundCloud && (!current?.scAccess || current.scAccess === 'playable') ? current?.scUrl ?? null : null}
      volume={volume} autoPlay={false} onController={setSoundCloudController} onPlay={onSoundCloudPlay} onPause={onSoundCloudPause}
      onProgress={onSoundCloudProgress} onDuration={updateDuration} onEnded={onSoundCloudEnded} onError={fail} />
    </div>
  </TimeCtx.Provider></PlayerCtx.Provider>
}
