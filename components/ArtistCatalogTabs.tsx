'use client'
import Link from 'next/link'
import { useState } from 'react'
import type { TrackCardData } from '@/lib/queries'
import { TrackList } from './TrackCard'
import { usePlayer } from './player/PlayerProvider'

type Playlist = { id: string, title: string, artUrl: string | null, tracks: number }
type Tab = 'tracks' | 'playlists' | 'reposts' | 'likes'

export default function ArtistCatalogTabs({ tracks, reposts, likes, playlists, slug, page, totalTracks, sort }: { tracks: TrackCardData[], reposts: TrackCardData[], likes: TrackCardData[], playlists: Playlist[], slug: string, page: number, totalTracks: number, sort: 'latest' | 'popular' }) {
  const [tab, setTab] = useState<Tab>('tracks')
  const player = usePlayer()
  const items: Array<[Tab, string, number]> = [['tracks', 'Tracks', tracks.length], ['playlists', 'Playlists', playlists.length], ['reposts', 'Reposts', reposts.length], ['likes', 'Likes', likes.length]]
  return <section>
    <div className="flex items-center gap-4 border-b border-[#485044]">
      <nav className="flex flex-1 gap-5 overflow-x-auto text-xs font-bold uppercase tracking-[0.12em]">
        {items.map(([id, label, count]) => <button key={id} onClick={() => setTab(id)} className={`whitespace-nowrap border-b-2 pb-3 ${tab === id ? 'border-[#d8ff16] text-[#d8ff16]' : 'border-transparent text-[#aeb8ab] hover:text-white'}`}>{label} <span className="font-mono">{count}</span></button>)}
      </nav>
      {tab === 'tracks' && tracks.length > 0 && <button onClick={() => player.play(tracks[0], tracks)} title="Play all tracks" className="mb-2 grid h-8 w-8 shrink-0 place-items-center bg-[#d8ff16] text-black hover:bg-white" aria-label="Play all tracks"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></button>}
    </div>
    <div className="pt-5">
      {tab === 'tracks' && <>
        <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em]">
          <span className="text-[#9ea59f]">Order</span>
          {(['latest', 'popular'] as const).map(order => <Link key={order} href={`/artist/${slug}${order === 'latest' ? '' : '?sort=popular'}`} className={`border px-2 py-1 ${sort === order ? 'border-[#d8ff16] text-[#d8ff16]' : 'border-[#485044] text-[#aeb8ab] hover:text-white'}`}>{order}</Link>)}
        </div>
        <TrackList tracks={tracks} empty="No tracks released yet." />
        {totalTracks > tracks.length && <div className="mt-6 flex items-center justify-between border-t border-[#485044] pt-4 text-xs font-bold uppercase tracking-[0.1em]">
          {page > 1 ? <Link href={`/artist/${slug}?page=${page - 1}${sort === 'popular' ? '&sort=popular' : ''}`} className="border border-[#586055] px-3 py-2 text-[#d5ddd2] hover:border-[#d8ff16] hover:text-[#d8ff16]">Previous</Link> : <span />}
          <span className="font-mono text-[#aeb8ab]">Page {page} of {Math.ceil(totalTracks / 30)}</span>
          {page * 30 < totalTracks ? <Link href={`/artist/${slug}?page=${page + 1}${sort === 'popular' ? '&sort=popular' : ''}`} className="border border-[#586055] px-3 py-2 text-[#d5ddd2] hover:border-[#d8ff16] hover:text-[#d8ff16]">Next</Link> : <span />}
        </div>}
      </>}
      {tab === 'reposts' && <TrackList tracks={reposts} empty="No reposts yet." />}
      {tab === 'likes' && <TrackList tracks={likes} empty="No liked tracks yet." />}
      {tab === 'playlists' && <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">{playlists.map(playlist => <Link key={playlist.id} href={`/playlist/${playlist.id}`} className="group"><div className="aspect-square overflow-hidden border border-[#485044] bg-[#111511]">{playlist.artUrl ? <img src={playlist.artUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-105" /> : <div className="h-full w-full flex items-center justify-center text-3xl text-[#d8ff16] display-type">SSZ</div>}</div><p className="mt-2 truncate font-bold text-white group-hover:text-[#d8ff16]">{playlist.title}</p><p className="text-xs text-[#aeb8ab]">{playlist.tracks} tracks</p></Link>)}{!playlists.length && <p className="col-span-full py-6 text-sm text-[#9ea59f]">No playlists released yet.</p>}</div>}
    </div>
  </section>
}