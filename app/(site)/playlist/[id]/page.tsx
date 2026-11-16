import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getArtist } from '@/lib/artist'
import { artUrl } from '@/lib/storage'
import { Artwork, TrackList } from '@/components/TrackCard'
import PlaylistOwnerControls from '@/components/PlaylistOwnerControls'
import { listTracks } from '@/lib/queries'

export const dynamic = 'force-dynamic'

async function getPlaylist(id: string) {
  return db.playlist.findUnique({
    where: { id },
    include: {
      user: { select: { handle: true, slug: true } },
      tracks: { orderBy: { position: 'asc' }, select: { trackId: true } },
    },
  })
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const p = await db.playlist.findUnique({ where: { id: params.id }, select: { title: true, user: { select: { handle: true } } } })
  return { title: p ? `${p.title} by ${p.user.handle}` : 'Playlist not found' }
}

export default async function PlaylistPage({ params }: { params: { id: string } }) {
  const playlist = await getPlaylist(params.id)
  if (!playlist) notFound()
  const artist = await getArtist()
  const ids = playlist.tracks.map(item => item.trackId)
  const cards = ids.length ? await listTracks({ id: { in: ids } }, { createdAt: 'desc' }, ids.length) : []
  const byId = new Map(cards.map(track => [track.id, track]))
  const tracks = ids.flatMap(id => {
    const track = byId.get(id)
    return track ? [track] : []
  })

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center gap-6">
        <Artwork url={playlist.artHref ?? artUrl(playlist.artKey)} title={playlist.title} size="lg" />
        <div className="min-w-0">
          <div className="text-sm text-[#aaa]">Playlist</div>
          <h1 className="text-3xl font-black">{playlist.title}</h1>
          <Link href={`/artist/${playlist.user.slug}`} className="text-[#ccff00] hover:underline">{playlist.user.handle}</Link>
          <p className="text-sm text-[#999] mt-1">{tracks.length} track{tracks.length === 1 ? '' : 's'}</p>
          {playlist.description && <p className="text-[#ddd] mt-2 max-w-xl whitespace-pre-line">{playlist.description}</p>}
        </div>
      </section>
      {artist?.id === playlist.userId && <PlaylistOwnerControls playlistId={playlist.id} title={playlist.title} description={playlist.description} />}
      <TrackList tracks={tracks} empty="No tracks in this playlist yet." />
    </div>
  )
}
