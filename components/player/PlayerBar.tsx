'use client'
import Link from 'next/link'
import { fmt } from '@/lib/audio'
import { usePlayer, usePlayerTime } from './PlayerProvider'
import { Artwork } from '../TrackCard'
import LikeButton from '../LikeButton'
import ActionPopover from '../ActionPopover'
import { useEffect, useRef, useState } from 'react'
import { playerSource } from '@/lib/player'

const iconBtn = 'w-10 h-10 shrink-0 flex items-center justify-center border border-transparent text-white hover:border-[#586055] hover:bg-[#1a1f1a] disabled:opacity-30'

function Scrubber() {
  const player = usePlayer()
  const { time, duration } = usePlayerTime()
  const total = Number.isFinite(duration) && duration > 0 ? duration : 0
  const position = Math.max(0, Math.min(time, total))
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span aria-hidden="true" className="w-10 shrink-0 text-right font-mono text-xs text-[#ccff00]">{fmt(position)}</span>
      <input type="range" aria-label="Playback position" aria-valuetext={`${fmt(position)} of ${fmt(total)}`} min={0} max={total} step={0.1} value={position} disabled={!total}
        onChange={event => player.seek(Number(event.target.value))}
        onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].includes(event.key)) return
          event.preventDefault()
          const step = event.shiftKey ? 10 : 1
          player.seek(Math.max(0, Math.min(total, position + (event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -step : step))))
        }}
        className="h-9 min-w-0 flex-1 accent-[#d8ff16] disabled:opacity-40" />
      <span aria-hidden="true" className="w-10 shrink-0 font-mono text-xs text-[#aaa]">{fmt(total)}</span>
    </div>
  )
}

export default function PlayerBar() {
  const player = usePlayer()
  const [queueOpen, setQueueOpen] = useState(false)
  const [audioOpen, setAudioOpen] = useState(false)
  const audibleVolume = useRef(0.9)
  const bar = useRef<HTMLDivElement>(null)
  const t = player.current
  const hasTrack = !!t
  useEffect(() => {
    const element = bar.current
    if (!hasTrack || !element) return
    const resize = () => document.documentElement.style.setProperty('--player-height', `${element.getBoundingClientRect().height}px`)
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--player-height') }
  }, [hasTrack])
  useEffect(() => { if (player.volume > 0) audibleVolume.current = player.volume }, [player.volume])
  if (!t) return player.error || player.notice ? <p role={player.error ? 'alert' : 'status'} className="mx-auto max-w-6xl px-4 pb-4 text-xs text-[#ffcf79]">{player.error || player.notice}</p> : null
  const source = playerSource(t)
  return (
    <div ref={bar} role="region" aria-label="Music player" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} className="fixed inset-x-0 bottom-0 z-50 border-t border-[#586055] bg-[#0b0e0b]/95 shadow-[0_-16px_42px_rgba(0,0,0,0.36)] backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-px bg-[#d8ff16]/70" />
      <div className="mx-auto max-w-6xl px-4 py-2">
        <div className="mb-2 flex min-w-0 items-center gap-2 md:hidden">
          <Artwork url={t.artUrl} title={t.title} size="sm" />
          <div className="min-w-0 flex-1">
            <Link href={`/t/${t.id}`} className="block truncate text-sm font-bold text-white">{t.title}</Link>
            <Link href={`/artist/${t.artistSlug}`} className="block truncate text-xs text-[#aeb8ab]">{t.artist}</Link>
            <span className="block text-[10px] font-bold uppercase tracking-wide text-[#aab98c]">{source.label}</span>
          </div>
          <LikeButton key={`${t.id}-${t.liked}-${t.likes}`} trackId={t.id} liked={t.liked} likes={t.likes} baseline={t.scLikes} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 md:flex-nowrap">
          <div className="flex shrink-0 items-center gap-1">
          <button onClick={player.prev} className={iconBtn} aria-label="Previous" title="Previous track or restart"><svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg></button>
          <button onClick={player.toggle} className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center bg-[#d8ff16] text-black hover:bg-white" aria-label={player.playing || player.loading ? 'Pause' : 'Play'} aria-busy={player.loading} title="Play / pause (Space)">
            {player.loading ? <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-black/30 border-t-black motion-reduce:animate-none" /> : <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">{player.playing ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}</svg>}
          </button>
          <button onClick={player.stop} className={iconBtn} aria-label="Stop" title="Stop and return to the beginning"><svg aria-hidden="true" viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M6 6h12v12H6z" /></svg></button>
          <button onClick={player.next} className={iconBtn} aria-label="Next" title="Next track"><svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg></button>
          </div>
          <div className="order-last w-full min-w-0 md:order-none md:flex-1"><Scrubber /></div>
          <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2 md:ml-0">
            <ActionPopover label={player.volume === 0 ? 'Muted' : 'Audio'} title="Playback audio" description={source.detail} open={audioOpen} onOpenChange={setAudioOpen}>
              <p className="mb-3 text-sm font-bold text-[#d8ff16]">{source.label}</p>
              <label className="block text-sm text-[#ddd]">Volume <span aria-hidden="true" className="font-mono">{Math.round(player.volume * 100)}%</span>
                <input type="range" min={0} max={1} step={0.01} value={player.volume} aria-valuetext={`${Math.round(player.volume * 100)}%`} onChange={e => player.setVolume(Number(e.target.value))} className="mt-2 h-9 w-full accent-[#d8ff16]" />
              </label>
              <button onClick={() => player.setVolume(player.volume === 0 ? audibleVolume.current : 0)} className="mt-2 min-h-10 rounded border border-[#586055] px-3 py-2 text-sm">{player.volume === 0 ? 'Unmute' : 'Mute'}</button>
              {t.soundCloudPlayback && t.scUrl && <a href={t.scUrl} target="_blank" rel="noopener noreferrer" className="mt-3 block text-xs text-[#ffab94] underline">Open original on SoundCloud</a>}
              <p className="mt-3 text-xs leading-relaxed text-[#999]">Space plays or pauses. Arrow keys on the timeline seek 1 second; Shift + arrow seeks 10 seconds. Stop rewinds the current track. Your queue reopens paused.</p>
            </ActionPopover>
            <ActionPopover label={`Queue ${player.queue.length}`} title="Playback queue" description="Choose a track to play next, remove an upcoming track, or clear the queue to stop listening." open={queueOpen} onOpenChange={setQueueOpen}>
              <button onClick={player.clearQueue} className="mb-2 min-h-9 text-xs font-bold text-[#ff9d89] underline">Clear queue</button>
              <div className="space-y-1">{player.queue.map((item, position) => <div key={item.id} className="flex items-center gap-2 border-b border-[#303630] py-1">
                <span aria-hidden="true" className="w-5 shrink-0 font-mono text-xs text-[#8f998e]">{position + 1}</span>
                <button onClick={() => player.play(item, player.queue)} aria-label={`Play ${item.title} from queue`} aria-current={item.id === t.id ? 'true' : undefined} className={`min-h-11 min-w-0 flex-1 rounded px-1 py-2 text-left hover:bg-[#262e25] ${item.id === t.id ? 'text-[#d8ff16]' : 'text-white'}`}>
                  <span className="block truncate text-sm font-bold">{item.title}</span><span className="block truncate text-xs text-[#aeb8ab]">{item.artist}</span>
                </button>
                {item.id !== t.id && <button onClick={() => player.removeFromQueue(item.id)} aria-label={`Remove ${item.title} from queue`} className="min-h-9 shrink-0 px-1 text-xs text-[#ccc] underline">Remove</button>}
              </div>)}</div>
            </ActionPopover>
          </div>
          <div className="hidden md:flex shrink-0 items-center gap-2 min-w-0 w-56 lg:w-64">
            <Artwork url={t.artUrl} title={t.title} size="sm" />
            <div className="min-w-0 flex-1">
              <Link href={`/artist/${t.artistSlug}`} className="block text-xs text-[#aaa] hover:text-white truncate">{t.artist}</Link>
              <Link href={`/t/${t.id}`} className="block text-sm text-white hover:text-[#ccff00] truncate">{t.title}</Link>
              <span className="block text-[10px] font-bold uppercase tracking-wide text-[#aab98c]">{source.label}</span>
            </div>
            <LikeButton key={`${t.id}-${t.liked}-${t.likes}`} trackId={t.id} liked={t.liked} likes={t.likes} baseline={t.scLikes} />
          </div>
        </div>
        {player.loading && <p role="status" className="mt-2 text-xs leading-relaxed text-[#c4d197]">Loading audio... You can pause or stop while it connects.</p>}
        {player.error && <div role="alert" className="mt-2 flex min-w-0 flex-col gap-2 border-t border-[#586055] pt-2 text-sm text-[#ffb9a8] sm:flex-row sm:items-center sm:gap-3">
          <p className="min-w-0 flex-1 break-words leading-relaxed">{player.error}</p>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <button onClick={player.retry} className="min-h-9 rounded border border-[#586055] px-3 text-xs font-bold text-white">Retry</button>
            {t.scUrl && <a href={t.scUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center text-xs underline">Open original</a>}
          </div>
        </div>}
        {player.notice && <p role="status" className="mt-2 break-words text-xs leading-relaxed text-[#ffcf79]">{player.notice}</p>}
      </div>
    </div>
  )
}
