import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { listTracks } from '@/lib/queries'
import { artUrl } from '@/lib/storage'
import { listenerId } from '@/lib/listener'
import { currentAccount } from '@/lib/account'
import { getArtist } from '@/lib/artist'
import { compact } from '@/lib/format'
import ArtistCatalogTabs from '@/components/ArtistCatalogTabs'
import FollowButton from '@/components/FollowButton'
import ProfileShareButton from '@/components/ProfileShareButton'
import RelativeTime from '@/components/RelativeTime'
import { refreshDueSoundCloud } from '@/lib/soundcloudSync'
import { isSiteAdmin } from '@/lib/access'
import AdminBadge from '@/components/AdminBadge'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const a = await db.user.findUnique({
    where: { slug: params.slug },
    select: { handle: true, bio: true, _count: { select: { tracks: true } }, tracks: { where: { OR: [{ artHref: { not: null } }, { artKey: { not: null } }] }, orderBy: { plays: 'desc' }, take: 1, select: { artHref: true, artKey: true } } },
  })
  if (!a) return { title: 'Artist not found' }
  const top = a.tracks[0]
  const image = top ? top.artHref ?? artUrl(top.artKey) : null
  const description = a.bio || `Listen to ${a._count.tracks} tracks by ${a.handle} on SolidSoundZ.`
  return {
    title: a.handle,
    description,
    alternates: { canonical: `/artist/${params.slug}` },
    openGraph: { type: 'profile', title: a.handle, description, url: `/artist/${params.slug}`, images: image ? [image] : undefined },
    twitter: { card: image ? 'summary_large_image' : 'summary', title: a.handle, description },
  }
}

export default async function ArtistPage({ params, searchParams }: { params: { slug: string }, searchParams: { page?: string, sort?: string } }) {
  await refreshDueSoundCloud()
  if (params.slug === 'tr-2hy-') redirect('/artist/tr82hy')
  const artist = await db.user.findUnique({ where: { slug: params.slug }, select: { id: true, handle: true, slug: true, soundCloudId: true, bio: true, location: true, avatarKey: true, avatarHref: true, profileClaimed: true, _count: { select: { followers: true, tracks: true } } } })
  if (!artist || !artist.profileClaimed) notFound()
  const account = await currentAccount()
  const listener = account?.id ?? listenerId()
  const self = (await getArtist())?.id === artist.id
  const page = Math.max(1, Math.floor(Number(searchParams.page) || 1))
  const sort = searchParams.sort === 'popular' ? 'popular' : 'latest'
  const pageSize = 30
  if (self && listener) await db.follow.deleteMany({ where: { artistId: artist.id, listener } })
  const [tracks, following, totals, playlists, publicTrackCount, heroTrack, sourceSync] = await Promise.all([
    listTracks({ userId: artist.id }, sort === 'popular' ? [{ scPlays: 'desc' }, { plays: 'desc' }] : { createdAt: 'desc' }, pageSize, false, (page - 1) * pageSize),
    listener ? db.follow.findUnique({ where: { artistId_listener: { artistId: artist.id, listener } }, select: { id: true } }) : null,
    db.track.aggregate({ where: { userId: artist.id }, _sum: { plays: true, scPlays: true } }),
    db.playlist.findMany({ where: { userId: artist.id }, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, artKey: true, artHref: true, _count: { select: { tracks: true } } } }),
    db.track.count({ where: { userId: artist.id, published: true } }),
    db.track.findFirst({ where: { userId: artist.id, published: true, OR: [{ artHref: { not: null } }, { artKey: { not: null } }] }, orderBy: [{ scPlays: 'desc' }, { plays: 'desc' }], select: { artHref: true, artKey: true } }),
    db.soundCloudSync.findUnique({ where: { userId: artist.id }, select: { enabled: true, profileUrl: true, syncedAt: true, error: true, followers: true, publicTracks: true, sourcePlays: true } }),
  ])
  const repostTracks = await db.repost.findMany({ where: { listener: artist.id }, orderBy: { createdAt: 'desc' }, take: 20, select: { trackId: true } })
  const reposted = repostTracks.length ? await listTracks({ id: { in: repostTracks.map(repost => repost.trackId) } }, { createdAt: 'desc' }, 20) : []
  const likedTracks = await db.like.findMany({ where: { listener: artist.id }, orderBy: { createdAt: 'desc' }, take: 20, select: { trackId: true } })
  const liked = likedTracks.length ? await listTracks({ id: { in: likedTracks.map(like => like.trackId) } }, { createdAt: 'desc' }, 20) : []
  const plays = (totals._sum.plays ?? 0) + (sourceSync?.sourcePlays ?? totals._sum.scPlays ?? 0)
  const avatar = artist.avatarHref ?? artUrl(artist.avatarKey)
  const heroArt = heroTrack?.artHref ?? artUrl(heroTrack?.artKey ?? null)

  return (
    <div className="space-y-8">
      <section className="relative min-h-[320px] overflow-hidden border border-[#586055] bg-[#101510] px-5 py-8 shadow-[0_24px_60px_rgba(0,0,0,0.34)] sm:px-8">
        {heroArt && <img src={heroArt} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />}
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative flex flex-wrap items-end gap-5">
        <div className="relative w-36 h-36 overflow-hidden border border-[#d8ff16] bg-[#111511] flex items-center justify-center shadow-[8px_8px_0_#090a0a]">
          {avatar
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={avatar} alt={artist.handle} className="w-full h-full object-cover" />
            : <><span className="display-type relative z-10 text-4xl text-[#d8ff16]">SSZ</span><span className="absolute inset-3 border border-[#53604d]" /><span className="absolute inset-x-0 bottom-0 h-8 bg-[repeating-linear-gradient(90deg,#d8ff16_0,#d8ff16_2px,transparent_2px,transparent_7px)] opacity-40" /></>}
        </div>
        <div className="flex-1 min-w-[200px] max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#d8ff16]">Artist channel / verified signal</p>
          <div className="mt-1 flex flex-wrap items-center gap-3"><h1 className="max-w-full break-words text-5xl leading-none">{artist.handle}</h1>{isSiteAdmin(artist) && <AdminBadge />}</div>
          {artist.bio && <p className="mt-3 max-w-xl text-[#e2e7df]">{artist.bio}</p>}
          {artist.location && <p className="mt-3 font-mono text-xs uppercase tracking-[0.12em] text-[#aeb8ab]">{artist.location}</p>}
          <div className="mt-5 flex flex-wrap gap-5 text-sm text-[#c7cec5]">
            <span><b className="text-white">{publicTrackCount}</b> tracks</span>
            <span><b className="text-white">{compact(plays)}</b> combined plays</span>
            <span><b className="text-white">{artist._count.followers}</b> SolidSoundZ followers</span>
            {sourceSync?.followers !== null && sourceSync?.followers !== undefined && <span><b className="text-white">{compact(sourceSync.followers)}</b> SoundCloud followers</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FollowButton slug={artist.slug} following={!!following} followers={artist._count.followers} self={self} />
          <ProfileShareButton artist={artist.handle} slug={artist.slug} />
          {self && <Link href="/settings" className="min-h-11 rounded border border-[#586055] px-4 py-3 text-xs font-bold uppercase tracking-wide text-white hover:border-[#d8ff16]">Edit profile</Link>}
          {self && <Link href="/settings#delete-profile" className="min-h-11 px-2 py-3 text-xs font-bold text-[#ffb9a8] underline">Delete profile</Link>}
          {self && <Link href="/move" className="border border-[#d8ff16] px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-[#d8ff16] hover:bg-[#d8ff16] hover:text-black">Connect SoundCloud</Link>}
        </div>
        </div>
      </section>
      {sourceSync?.enabled && <section aria-label="SoundCloud catalog sync" className="rounded-lg border border-[#394039] bg-[#111511] p-4 text-sm text-[#bbb]">
        <p><a href={sourceSync.profileUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-[#ffab94] underline">SoundCloud catalog</a>
          {sourceSync.syncedAt ? <> updated <RelativeTime value={sourceSync.syncedAt.toISOString()} referenceTime={new Date().toISOString()} />.</> : ' is waiting for its first refresh.'}
          {sourceSync.publicTracks !== null && <> {sourceSync.publicTracks} public releases at the source.</>}
        </p>
        <p className="mt-1 text-xs">Updates automatically about every 5 minutes while the site is open; the next visit catches up after idle periods. Source counts can lag while SoundCloud processes plays. Original uploads and Apple-approved metadata are preserved.</p>
        {sourceSync.error && <p role="status" className="mt-2 text-xs text-[#ffcf79]">{sourceSync.error}</p>}
      </section>}
      <ArtistCatalogTabs tracks={tracks} reposts={reposted} likes={liked} playlists={playlists.map(playlist => ({ id: playlist.id, title: playlist.title, artUrl: playlist.artHref ?? artUrl(playlist.artKey), tracks: playlist._count.tracks }))} slug={artist.slug} page={page} totalTracks={publicTrackCount} sort={sort} />
    </div>
  )
}
