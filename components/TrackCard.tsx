'use client'
import Link from 'next/link'
import type { TrackCardData } from '@/lib/queries'
import { compact } from '@/lib/format'
import { fmt } from '@/lib/audio'
import { usePlayer, usePlayerTime } from './player/PlayerProvider'
import Waveform from './Waveform'
import LikeButton from './LikeButton'
import ShareMenu from './ShareMenu'
import RepostButton from './RepostButton'
import AddToPlaylistButton from './AddToPlaylistButton'
import RelativeTime from './RelativeTime'
import MusicPlatformLinks from './MusicPlatformLinks'
import SoundCloudStats from './SoundCloudStats'

export function Artwork({ url, title, size = 'md' }: { url: string | null, title: string, size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'w-full max-w-72 aspect-square md:w-72 md:h-72' : size === 'sm' ? 'w-12 h-12' : 'w-16 h-16 sm:w-36 sm:h-36'
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt={title} className={`${cls} object-cover flex-shrink-0 bg-[#222] border border-[#485044]`} />
    : <div className={`${cls} flex-shrink-0 bg-gradient-to-br from-[#d8ff16] via-[#5b6d0c] to-[#111] border border-[#485044] flex items-center justify-center text-black font-black ${size === 'sm' ? 'text-xs' : 'text-2xl'}`}>SSZ</div>
}

export function PlayButton({ playing, onClick, size = 'md', title }: { playing: boolean, onClick: () => void, size?: 'sm' | 'md' | 'lg', title?: string }) {
  const s = size === 'lg' ? 'w-14 h-14 sm:w-16 sm:h-16' : size === 'sm' ? 'w-9 h-9' : 'w-10 h-10 sm:w-12 sm:h-12'
  return (
    <button onClick={onClick} aria-label={`${playing ? 'Pause' : 'Play'}${title ? ` ${title}` : ''}`} className={`${s} rounded-full bg-[#ccff00] text-black flex items-center justify-center flex-shrink-0 hover:scale-105 transition motion-reduce:transition-none motion-reduce:hover:scale-100`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="w-1/2 h-1/2" fill="currentColor">{playing ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}</svg>
    </button>
  )
}

function CardWave({ t, queue }: { t: TrackCardData, queue: TrackCardData[] }) {
  const player = usePlayer()
  const { time, duration } = usePlayerTime()
  const isCurrent = player.current?.id === t.id
  const d = isCurrent ? duration || t.duration : t.duration
  return (
    <div>
      <Waveform peaks={t.peaks} waveformUrl={t.waveformUrl} seed={t.id} active={isCurrent} preview={!isCurrent} progress={isCurrent && d ? time / d : 0}
        seekLabel={`Playback position for ${t.title}`} duration={d}
        onSeek={f => isCurrent ? player.seek(f * d) : player.play(t, queue, f * t.duration)} />
      <div className="flex justify-between text-[11px] font-mono text-[#999] mt-0.5">
        <span>{isCurrent ? fmt(time) : 'Play or seek on the waveform'}</span><span>{fmt(d)}</span>
      </div>
    </div>
  )
}

export default function TrackCard({ t, queue }: { t: TrackCardData, queue: TrackCardData[] }) {
  const player = usePlayer()
  const isCurrent = player.current?.id === t.id
  const playing = isCurrent && player.playing

  return (
    <article aria-label={`${t.title} by ${t.artist}`} className={`grid grid-cols-[4rem_minmax(0,1fr)] gap-x-3 gap-y-3 py-4 px-2 border-b border-[#303630] border-l-2 transition-colors sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-4 ${isCurrent ? 'border-l-[#d8ff16] bg-[#111511]' : 'border-l-transparent hover:border-l-[#d8ff16] hover:bg-[#111511]/80'}`}>
      <Link href={`/t/${t.id}`} className="sm:row-span-2"><Artwork url={t.artUrl} title={t.title} /></Link>
      <div className="min-w-0">
        <div className="flex items-start gap-2 sm:gap-3">
          <PlayButton title={t.title} playing={playing} onClick={() => playing ? player.pause() : player.play(t, queue)} />
          <div className="min-w-0 flex-1">
            <Link href={`/artist/${t.artistSlug}`} className="block text-xs text-[#9ea59f] uppercase tracking-[0.1em] hover:text-white truncate">{t.artist}</Link>
            <Link href={`/t/${t.id}`} className="line-clamp-2 break-words text-sm leading-snug text-white font-semibold hover:text-[#d8ff16] sm:text-base">{t.title}</Link>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#999]">
          <RelativeTime value={t.createdAt} />
          {t.genre && <Link href={`/search?genre=${encodeURIComponent(t.genre)}`} className="max-w-full truncate border border-[#424a42] px-2 py-0.5 text-[#c7cec5] hover:border-[#d8ff16]">#{t.genre}</Link>}
          {isCurrent && <span className="text-[#d8ff16]">{playing ? 'Now playing' : 'Paused'}</span>}
        </div>
      </div>
      <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2">
        <CardWave t={t} queue={queue} />
        <div className="flex flex-wrap items-center gap-2 mt-1 min-w-0">
          <LikeButton trackId={t.id} liked={t.liked} likes={t.likes} baseline={t.scLikes} />
          <RepostButton trackId={t.id} reposted={t.reposted} reposts={t.reposts} baseline={t.scReposts} />
          <AddToPlaylistButton trackId={t.id} />
          <ShareMenu trackId={t.id} title={t.title} artist={t.artist} />
          <MusicPlatformLinks appleMusicUrl={t.appleMusicUrl} spotifyUrl={t.spotifyUrl} title={t.title} artist={t.artist} />
          <span className="flex items-center gap-3 text-xs text-[#aaa] sm:ml-auto">
            <span className="inline-flex items-center gap-1" title="Plays recorded on SolidSoundZ">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>{compact(t.plays)} SolidSoundZ plays
            </span>
            <Link href={`/t/${t.id}#comments`} className="inline-flex items-center gap-1 hover:text-white">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M4 4h16v12H7l-3 3z" /></svg>{compact(t.comments)} comments
            </Link>
          </span>
        </div>
        <SoundCloudStats track={t} />
      </div>
    </article>
  )
}

export function TrackList({ tracks, empty }: { tracks: TrackCardData[], empty?: React.ReactNode }) {
  if (!tracks.length) return <div className="py-10 text-center text-[#aaa]">{empty ?? 'Nothing here yet.'}</div>
  return <div>{tracks.map(t => <TrackCard key={t.id} t={t} queue={tracks} />)}</div>
}
