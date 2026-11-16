'use client'
import { useCallback, useEffect, useRef } from 'react'

export type SoundCloudControls = {
  play: () => void
  pause: () => void
  seek: (seconds: number) => void
  setVolume: (volume: number) => void
}

type Widget = {
  bind: (event: string, listener: (event?: { currentPosition?: number }) => void) => void
  unbind: (event: string) => void
  play: () => void
  pause: () => void
  seekTo: (milliseconds: number) => void
  setVolume: (volume: number) => void
  getDuration: (listener: (milliseconds: number) => void) => void
}

type WidgetApi = {
  Widget: ((frame: HTMLIFrameElement) => Widget) & { Events: Record<string, string> }
}

declare global {
  interface Window { SC?: WidgetApi }
}

let apiPromise: Promise<WidgetApi> | null = null

function getWidgetApi() {
  if (window.SC) return Promise.resolve(window.SC)
  if (!apiPromise) {
    apiPromise = new Promise<WidgetApi>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://w.soundcloud.com/player/api.js'
      const timeout = setTimeout(() => { script.remove(); reject(new Error('SoundCloud widget timed out')) }, 20_000)
      script.onload = () => {
        clearTimeout(timeout)
        if (window.SC) resolve(window.SC)
        else { script.remove(); reject(new Error('SoundCloud widget unavailable')) }
      }
      script.onerror = () => {
        clearTimeout(timeout)
        script.remove()
        reject(new Error('SoundCloud widget failed to load'))
      }
      document.head.appendChild(script)
    }).catch(error => {
      apiPromise = null
      throw error
    })
  }
  return apiPromise
}

type Props = {
  url: string | null
  volume: number
  autoPlay?: boolean
  onController: (controller: SoundCloudControls | null) => void
  onPlay: () => void
  onPause: () => void
  onProgress: (seconds: number) => void
  onDuration: (seconds: number) => void
  onEnded: () => void
  onError?: (message: string) => void
}

export default function SoundCloudWidget({ url, volume, autoPlay = true, onController, onPlay, onPause, onProgress, onDuration, onEnded, onError }: Props) {
  const frame = useRef<HTMLIFrameElement | null>(null)
  const currentWidget = useRef<Widget | null>(null)
  const latestVolume = useRef(volume)
  const dispose = useRef<(() => void) | null>(null)
  const callbacks = useRef({ onController, onPlay, onPause, onProgress, onDuration, onEnded, onError })
  callbacks.current = { onController, onPlay, onPause, onProgress, onDuration, onEnded, onError }
  latestVolume.current = volume
  const setFrame = useCallback((element: HTMLIFrameElement | null) => {
    if (!element) dispose.current?.()
    frame.current = element
  }, [])

  useEffect(() => {
    currentWidget.current?.setVolume(Math.round(volume * 100))
  }, [volume])

  useEffect(() => {
    if (!url || !frame.current) { callbacks.current.onController(null); return }
    const element = frame.current
    let active = true
    let ready = false
    let failed = false
    let wantsToPlay = autoPlay
    let pendingSeek: number | null = null
    let widget: Widget | null = null
    let events: Record<string, string> | null = null
    let readyTimeout: ReturnType<typeof setTimeout> | null = null
    let playTimeout: ReturnType<typeof setTimeout> | null = null
    const clearPlayTimeout = () => { if (playTimeout) clearTimeout(playTimeout); playTimeout = null }
    const fail = (message: string) => {
      if (!active || failed) return
      failed = true; wantsToPlay = false
      if (readyTimeout) clearTimeout(readyTimeout)
      clearPlayTimeout()
      if (ready) widget?.pause()
      console.error(message)
      callbacks.current.onPause()
      callbacks.current.onError?.(message)
    }
    const expectPlayback = () => {
      clearPlayTimeout()
      playTimeout = setTimeout(() => fail('SoundCloud playback did not start. Retry or open the original track.'), 25_000)
    }
    const cleanup = () => {
      if (!active) return
      active = false
      if (readyTimeout) clearTimeout(readyTimeout)
      clearPlayTimeout()
      if (ready) widget?.pause()
      ready = false
      currentWidget.current = null
      if (widget && events) {
        for (const event of [events.READY, events.PLAY, events.PAUSE, events.PLAY_PROGRESS, events.SEEK, events.FINISH, events.ERROR]) if (event) widget.unbind(event)
      }
      callbacks.current.onController(null)
    }
    // Ref cleanup runs before the iframe is detached, while the SDK can still reach its window.
    dispose.current = cleanup
    callbacks.current.onController({
      play: () => {
        if (failed) { callbacks.current.onError?.('SoundCloud playback needs a fresh connection. Choose Retry.'); return }
        wantsToPlay = true; expectPlayback(); if (ready) widget?.play()
      },
      pause: () => { wantsToPlay = false; clearPlayTimeout(); if (ready) widget?.pause() },
      seek: seconds => {
        if (!Number.isFinite(seconds) || seconds < 0) return
        pendingSeek = seconds * 1000
        if (ready) { widget?.seekTo(pendingSeek); pendingSeek = null }
      },
      setVolume: nextVolume => {
        latestVolume.current = nextVolume
        if (ready) widget?.setVolume(Math.round(nextVolume * 100))
      },
    })
    readyTimeout = setTimeout(() => fail('SoundCloud is taking too long to load. Retry or open the original track.'), 30_000)
    getWidgetApi().then(api => {
      if (!active || failed) return
      // Register the SDK's message listener before the iframe can emit its one-time READY event.
      element.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=false&show_artwork=false&show_comments=false&show_user=false&show_reposts=false&show_teaser=false`
      widget = api.Widget(element)
      events = api.Widget.Events
      widget.bind(events.READY, () => {
        if (!active || failed || !widget) return
        if (readyTimeout) clearTimeout(readyTimeout)
        ready = true
        currentWidget.current = widget
        widget.setVolume(Math.round(latestVolume.current * 100))
        widget.getDuration(milliseconds => { if (active && Number.isFinite(milliseconds) && milliseconds > 0) callbacks.current.onDuration(milliseconds / 1000) })
        if (pendingSeek !== null) { widget.seekTo(pendingSeek); pendingSeek = null }
        if (wantsToPlay) { expectPlayback(); widget.play() }
        else widget.pause()
      })
      widget.bind(events.PLAY, () => {
        if (!active || failed) return
        if (!wantsToPlay) { widget?.pause(); return }
        clearPlayTimeout(); callbacks.current.onPlay()
      })
      widget.bind(events.PAUSE, () => { if (active) callbacks.current.onPause() })
      const progress = (event?: { currentPosition?: number }) => {
        if (active && typeof event?.currentPosition === 'number' && Number.isFinite(event.currentPosition) && event.currentPosition >= 0) callbacks.current.onProgress(event.currentPosition / 1000)
      }
      widget.bind(events.PLAY_PROGRESS, progress)
      widget.bind(events.SEEK, progress)
      widget.bind(events.FINISH, () => { if (active) { clearPlayTimeout(); wantsToPlay = false; callbacks.current.onEnded() } })
      widget.bind(events.ERROR, () => {
        if (!active) return
        fail('SoundCloud could not play this track. Retry or open the original for its availability details.')
      })
    }).catch(error => {
      if (!active) return
      console.error('SoundCloud widget failed to initialize.', error instanceof Error ? error.name : 'Unknown error')
      fail('The SoundCloud player could not load. Check your connection or content blocker, then retry.')
    })

    return () => {
      cleanup()
      if (dispose.current === cleanup) dispose.current = null
    }
  }, [url, autoPlay])

  if (!url) return null
  return <iframe key={url} ref={setFrame} src="about:blank" title="SoundCloud transport" aria-hidden="true" tabIndex={-1} className="fixed left-0 top-0 w-px h-px opacity-0 pointer-events-none -z-10" loading="eager" allow="autoplay; encrypted-media" />
}