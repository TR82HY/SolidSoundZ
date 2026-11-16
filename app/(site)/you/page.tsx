import Link from 'next/link'
import { getArtist } from '@/lib/artist'
import { currentAccount } from '@/lib/account'
import { db } from '@/lib/db'
import { listTracks, artistGrowth } from '@/lib/queries'
import { listenerId } from '@/lib/listener'
import { compact } from '@/lib/format'
import { TrackList } from '@/components/TrackCard'
import { artUrl } from '@/lib/storage'
import ProfileEditor from '@/components/ProfileEditor'
import CreatePlaylistButton from '@/components/CreatePlaylistButton'
import DraftList from '@/components/DraftList'
import GrowthPanel from '@/components/GrowthPanel'
import { isSiteAdmin } from '@/lib/access'
import AdminBadge from '@/components/AdminBadge'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Library', robots: { index: false } }

export default async function Library({ searchParams }: { searchParams: { connected?: string, imported?: string, playlists?: string, error?: string } }) {
  const artist = await getArtist()
  const listener = (await currentAccount())?.id ?? listenerId()
  const likedIds = listener ? (await db.like.findMany({ where: { listener }, orderBy: { createdAt: 'desc' }, select: { trackId: true }, take: 100 })).map(l => l.trackId) : []
  const repostedIds = listener ? (await db.repost.findMany({ where: { listener }, orderBy: { createdAt: 'desc' }, select: { trackId: true }, take: 100 })).map(repost => repost.trackId) : []

  const [mine, liked, reposts, totals, followers, comments, likes, playlists, history, pendingSoundCloud, growth] = await Promise.all([
    artist ? listTracks({ userId: artist.id }, { createdAt: 'desc' }, 200, true) : [],
    likedIds.length ? listTracks({ id: { in: likedIds } }, { createdAt: 'desc' }, 100) : [],
    repostedIds.length ? listTracks({ id: { in: repostedIds } }, { createdAt: 'desc' }, 100) : [],
    artist ? db.track.aggregate({ where: { userId: artist.id }, _sum: { plays: true, scPlays: true } }) : null,
    artist ? db.follow.count({ where: { artistId: artist.id } }) : 0,
    artist ? db.timedComment.count({ where: { track: { userId: artist.id } } }) : 0,
    artist ? db.like.count({ where: { track: { userId: artist.id } } }) : 0,
    artist ? db.playlist.findMany({ where: { userId: artist.id }, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, artKey: true, artHref: true, _count: { select: { tracks: true } } } }) : [],
    artist ? db.listeningHistory.findMany({ where: { userId: artist.id }, orderBy: { lastPlayedAt: 'desc' }, take: 12, include: { track: { select: { id: true, title: true } } } }) : [],
    artist ? db.track.count({ where: { userId: artist.id, s3Key: { startsWith: 'soundcloud/' }, published: false } }) : 0,
    artist ? artistGrowth(artist.id) : null,
  ])
  const ssz = totals?._sum.plays ?? 0, sc = totals?._sum.scPlays ?? 0
  const imported = Math.max(0, Number(searchParams.imported) || 0)
  const importedPlaylists = Math.max(0, Number(searchParams.playlists) || 0)
  const connectedSoundCloud = searchParams.connected === 'soundcloud'
  const drafts = mine.filter(track => !track.published)
  const released = mine.filter(track => track.published)

  return (
    <div className="space-y-10">
      {artist ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-black">Your Library</h1>{isSiteAdmin(artist) && <AdminBadge />}</div>
              <Link href={`/artist/${artist.slug}`} className="text-[#ccff00] text-sm underline">View your public profile ({artist.handle})</Link>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/settings" className="min-h-11 rounded-full border border-[#586055] px-4 py-2 text-sm font-bold text-white">Profile settings</Link>
              <Link href="/upload" className="px-4 py-2 rounded-full bg-[#ccff00] text-black text-sm font-bold">Upload</Link>
            </div>
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-6">
            {([['Total plays', ssz + sc, 'text-[#ccff00]'], ['SolidSoundZ plays', ssz, 'text-white'], ['From SoundCloud', sc, 'text-[#ff5500]'], ['Likes', likes, 'text-white'], ['Comments', comments, 'text-white'], ['Followers', followers, 'text-white']] as const).map(([label, v, color]) => (
              <div key={label} className="rounded-lg bg-[#141414] border border-[#333] p-4">
                <div className={`text-2xl font-bold ${color}`}>{compact(v)}</div>
                <div className="text-xs text-[#aaa]">{label}</div>
              </div>
            ))}
          </div>
          {connectedSoundCloud && <div className={`border-l-4 p-4 ${searchParams.error ? 'border-[#ff5a36] bg-[#2a1510]' : 'border-[#d8ff16] bg-[#18200d]'}`}>
            <p className="font-bold text-white">{searchParams.error ? 'SoundCloud connected, but the catalog could not finish importing.' : 'SoundCloud connected.'}</p>
            <p className="mt-1 text-sm text-[#c7cec5]">{imported} new track{imported === 1 ? '' : 's'} and {importedPlaylists} new playlist{importedPlaylists === 1 ? '' : 's'} imported.</p>
          </div>}
          {growth && <GrowthPanel growth={growth} />}
          {pendingSoundCloud > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border border-[#ff8b72] bg-[#20120e] p-4">
            <div><p className="font-bold text-white">{pendingSoundCloud} SoundCloud track{pendingSoundCloud === 1 ? '' : 's'} need original audio.</p><p className="mt-1 text-sm text-[#c7cec5]">Add your files before releasing them on SolidSoundZ.</p></div>
            <Link href="/move" className="border border-[#ff8b72] px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-[#ff9d89] hover:bg-[#ff8b72] hover:text-black">Finish transfer</Link>
          </div>}
          <ProfileEditor key={artist.id} id={artist.id} handle={artist.handle} slug={artist.slug} bio={artist.bio} location={artist.location} avatarUrl={artist.avatarHref ?? artUrl(artist.avatarKey)} />
          <Link href="/settings#delete-profile" className="inline-flex min-h-9 items-center text-sm text-[#ffb9a8] underline">Delete this profile</Link>
          <section>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-bold">Your playlists</h2>
              <CreatePlaylistButton />
            </div>
            {playlists.length ? (
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 md:grid-cols-6">
                {playlists.map(p => (
                  <Link key={p.id} href={`/playlist/${p.id}`} className="block">
                    <div className="aspect-square rounded bg-gradient-to-br from-[#ccff00] via-[#4d5e00] to-[#111] overflow-hidden">
                      {(p.artHref ?? artUrl(p.artKey)) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.artHref ?? artUrl(p.artKey)!} alt={p.title} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="mt-1 text-sm font-bold truncate">{p.title}</div>
                    <div className="text-xs text-[#999]">{p._count.tracks} tracks</div>
                  </Link>
                ))}
              </div>
            ) : <p className="text-sm text-[#999]">No playlists yet. Add a track to a new playlist from any track's menu.</p>}
          </section>
          <section>
            <h2 className="text-xl font-bold mb-1">Your tracks</h2>
            <TrackList tracks={released} empty={<>You haven&apos;t released anything yet. <Link href="/upload" className="text-[#ccff00] underline">Upload a track</Link>.</>} />
          </section>
          {drafts.length > 0 && <section><h2 className="text-xl font-bold mb-1">Private drafts</h2><DraftList tracks={drafts} /></section>}
          <section>
            <h2 className="text-xl font-bold mb-1">Listening history</h2>
            <div className="divide-y divide-[#333] border-y border-[#333]">{history.map(item => <Link key={item.id} href={`/t/${item.track.id}`} className="flex items-center justify-between py-3 text-sm hover:text-[#d8ff16]"><span>{item.track.title}</span><span className="font-mono text-xs text-[#999]">{item.playCount} plays</span></Link>)}{!history.length && <p className="py-4 text-sm text-[#999]">Tracks you play while signed in will appear here.</p>}</div>
          </section>
        </>
      ) : (
        <div className="rounded-xl border border-[#333] bg-[#111] p-6">Sign in to see your tracks and stats.</div>
      )}
      <section>
        <h2 className="text-xl font-bold mb-1">Liked tracks</h2>
        <TrackList tracks={liked} empty="Tracks you like show up here." />
      </section>
      <section>
        <h2 className="text-xl font-bold mb-1">Reposts</h2>
        <TrackList tracks={reposts} empty="Tracks you repost show up here." />
      </section>
    </div>
  )
}
