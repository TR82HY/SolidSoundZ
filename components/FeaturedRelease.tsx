'use client'

import Link from 'next/link'
import type { TrackCardData } from '@/lib/queries'
import { compact } from '@/lib/format'
import { usePlayer } from './player/PlayerProvider'
import MusicPlatformLinks from './MusicPlatformLinks'

export default function FeaturedRelease({ track, queue }: { track: TrackCardData, queue: TrackCardData[] }) {
  const player = usePlayer()
  const playing = player.current?.id === track.id && player.playing
  return <section className="relative isolate min-h-[440px] overflow-hidden border border-[#586055] bg-[#101510] shadow-[0_26px_80px_rgba(0,0,0,0.42)] sm:min-h-[500px]">
    {track.artUrl && <img src={track.artUrl} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />}
    <div className="absolute inset-0 -z-10 bg-black/60" />
    <div className="surface-grid absolute inset-0 -z-10 opacity-25" />
    <div className="flex min-h-[440px] flex-col justify-end p-6 sm:min-h-[500px] sm:p-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#d8ff16]">Featured release / on SolidSoundZ</p>
      <Link href={`/artist/${track.artistSlug}`} className="mt-3 max-w-full break-words text-sm font-bold uppercase tracking-[0.12em] text-[#d5ddd2] hover:text-[#d8ff16]">{track.artist}</Link>
      <h1 className="mt-1 max-w-3xl break-words text-5xl leading-[0.95] text-white sm:text-7xl">{track.title}</h1>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button onClick={() => playing ? player.pause() : player.play(track, queue)} className="grid h-14 w-14 place-items-center rounded-full bg-[#d8ff16] text-black transition hover:scale-105" aria-label={playing ? 'Pause featured release' : 'Play featured release'}>
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">{playing ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}</svg>
        </button>
        <div className="font-mono text-xs uppercase tracking-[0.12em] text-[#d5ddd2]">{compact(track.plays + track.scPlays)} combined plays</div>
        <Link href={`/t/${track.id}`} className="border-b border-[#d8ff16] pb-1 text-xs font-bold uppercase tracking-[0.12em] text-white hover:text-[#d8ff16]">Open release</Link>
        <MusicPlatformLinks appleMusicUrl={track.appleMusicUrl} spotifyUrl={track.spotifyUrl} title={track.title} artist={track.artist} size="lg" />
      </div>
    </div>
  </section>
}