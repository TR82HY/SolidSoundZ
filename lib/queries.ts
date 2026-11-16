import type { Prisma } from '@prisma/client'
import { db } from './db'
import { artUrl, audioUrl } from './storage'
import { listenerId } from './listener'
import { currentAccount } from './account'
import { refreshDueSoundCloud } from './soundcloudSync'

export type TrackCardData = {
  id: string, userId: string, title: string, artist: string, artistSlug: string, genre: string | null,
  artUrl: string | null, audioUrl: string, duration: number, plays: number, scPlays: number,
  waveformUrl?: string | null, scUrl?: string | null, appleMusicUrl?: string | null, spotifyUrl?: string | null, soundCloudPlayback: boolean,
  contentType?: string, scAccess?: string | null, scSyncedAt?: string | null, scCheckedAt?: string, scReposts?: number, scStatsHidden?: boolean, scCommentsHidden?: boolean,
  likes: number, comments: number, reposts: number, scLikes: number, scComments: number, liked: boolean, reposted: boolean, downloadable: boolean, published: boolean,
  scheduledFor?: string | null,
  peaks: number[] | null, createdAt: string,
}

const include = {
  user: { select: { handle: true, slug: true } },
  _count: { select: { likes: true, timedComments: true, reposts: true } },
} satisfies Prisma.TrackInclude

type Row = Prisma.TrackGetPayload<{ include: typeof include }>

function parsePeaks(json: string | null) {
  try { return json ? (JSON.parse(json) as number[]) : null } catch { return null }
}

function highResArtwork(url: string | null) {
  if (!url || !/^https:\/\/i\d?\.sndcdn\.com\//i.test(url)) return url
  return url.replace(/-(?:large|t\d+x\d+)\.(jpe?g|png)$/i, '-t500x500.$1')
}

async function toCards(rows: Row[]): Promise<TrackCardData[]> {
  const listener = (await currentAccount())?.id ?? listenerId()
  const ids = rows.map(r => r.id)
  const [liked, reposted] = listener && ids.length
    ? await Promise.all([
        db.like.findMany({ where: { listener, trackId: { in: ids } }, select: { trackId: true } }),
        db.repost.findMany({ where: { listener, trackId: { in: ids } }, select: { trackId: true } }),
      ])
    : [[], []]
  const likedSet = new Set(liked.map(l => l.trackId))
  const repostedSet = new Set(reposted.map(r => r.trackId))
  return rows.map(t => ({
    id: t.id, userId: t.userId, title: t.title, artist: t.user.handle, artistSlug: t.user.slug, genre: t.genre,
    artUrl: highResArtwork(t.artHref ?? artUrl(t.artKey)), audioUrl: t.audioHref ?? audioUrl(t.s3Key), duration: t.duration, plays: t.plays, scPlays: t.scStatsHidden ? 0 : t.scPlays,
    likes: t._count.likes, comments: t._count.timedComments, reposts: t._count.reposts, scLikes: t.scStatsHidden ? 0 : t.scLikes, scComments: t.scCommentsHidden ? 0 : t.scComments,
    contentType: t.contentType, scAccess: t.scAccess, scSyncedAt: t.scSyncedAt?.toISOString() ?? null, scCheckedAt: new Date().toISOString(), scReposts: t.scStatsHidden ? 0 : t.scReposts, scStatsHidden: t.scStatsHidden, scCommentsHidden: t.scCommentsHidden,
    liked: likedSet.has(t.id), reposted: repostedSet.has(t.id), downloadable: t.downloadable, published: t.published,
    peaks: parsePeaks(t.waveformJson), waveformUrl: t.waveformUrl, scUrl: t.scUrl, appleMusicUrl: t.appleMusicUrl, spotifyUrl: t.spotifyUrl, soundCloudPlayback: t.s3Key.startsWith('soundcloud/'), scheduledFor: t.scheduledFor?.toISOString() ?? null, createdAt: t.createdAt.toISOString(),
  }))
}

// Flips due scheduled drafts live. Serverless-safe: runs as a cheap sweep before any public read instead of a background job.
async function publishDueTracks() {
  await refreshDueSoundCloud()
  await db.track.updateMany({ where: { published: false, scheduledFor: { lte: new Date() } }, data: { published: true, publishedAt: new Date() } })
}

export async function listTracks(where: Prisma.TrackWhereInput, orderBy: Prisma.TrackOrderByWithRelationInput | Prisma.TrackOrderByWithRelationInput[] = { createdAt: 'desc' }, take = 30, includeUnpublished = false, skip = 0) {
  if (!includeUnpublished) await publishDueTracks()
  const visibility = includeUnpublished ? where : { AND: [where, { published: true }, { user: { profileClaimed: true } }] }
  return toCards(await db.track.findMany({ where: visibility, orderBy, take, skip, include }))
}

// Trending = most plays in the last 7 days, topped up with all-time favourites.
export async function trendingTracks(take = 20) {
  await publishDueTracks()
  const since = new Date(Date.now() - 7 * 86_400_000)
  const recent = await db.playEvent.groupBy({ by: ['trackId'], where: { createdAt: { gte: since } }, _count: { trackId: true }, orderBy: { _count: { trackId: 'desc' } }, take })
  const ids = recent.map(r => r.trackId)
  const hot = ids.length ? await db.track.findMany({ where: { id: { in: ids }, published: true, user: { profileClaimed: true } }, include }) : []
  hot.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
  const rest = hot.length < take
    ? await db.track.findMany({ where: { id: { notIn: ids }, published: true, user: { profileClaimed: true } }, orderBy: [{ plays: 'desc' }, { scPlays: 'desc' }, { createdAt: 'desc' }], take: take - hot.length, include })
    : []
  return toCards([...hot, ...rest])
}

export async function getTrackCard(id: string) {
  await publishDueTracks()
  const row = await db.track.findFirst({ where: { id, published: true, user: { profileClaimed: true } }, include })
  return row ? (await toCards([row]))[0] : null
}

// Same genre first (excluding the track itself), topped up with other trending tracks.
export async function relatedTracks(trackId: string, genre: string | null, take = 8) {
  await publishDueTracks()
  const sameGenre = genre ? await db.track.findMany({ where: { genre, id: { not: trackId }, published: true, user: { profileClaimed: true } }, orderBy: { plays: 'desc' }, take, include }) : []
  const rest = sameGenre.length < take
    ? await db.track.findMany({ where: { id: { notIn: [trackId, ...sameGenre.map(t => t.id)] }, published: true, user: { profileClaimed: true } }, orderBy: { plays: 'desc' }, take: take - sameGenre.length, include })
    : []
  return toCards([...sameGenre, ...rest])
}

// Week-over-week plays/followers plus the artist's top track this week. No schema changes required.
export async function artistGrowth(artistId: string) {
  const weekMs = 7 * 86_400_000
  const since = new Date(Date.now() - weekMs)
  const prevSince = new Date(Date.now() - weekMs * 2)

  const [playsThisWeek, playsPrevWeek, followersThisWeek, followersPrevWeek, topTrackGroup] = await Promise.all([
    db.playEvent.count({ where: { createdAt: { gte: since }, track: { userId: artistId } } }),
    db.playEvent.count({ where: { createdAt: { gte: prevSince, lt: since }, track: { userId: artistId } } }),
    db.follow.count({ where: { artistId, createdAt: { gte: since } } }),
    db.follow.count({ where: { artistId, createdAt: { gte: prevSince, lt: since } } }),
    db.playEvent.groupBy({ by: ['trackId'], where: { createdAt: { gte: since }, track: { userId: artistId } }, _count: { trackId: true }, orderBy: { _count: { trackId: 'desc' } }, take: 1 }),
  ])
  const topGroup = topTrackGroup[0]
  const topTrack = topGroup ? await db.track.findUnique({ where: { id: topGroup.trackId }, select: { id: true, title: true } }) : null

  return {
    playsThisWeek, playsPrevWeek,
    followersThisWeek, followersPrevWeek,
    topTrack: topTrack ? { id: topTrack.id, title: topTrack.title, plays: topGroup!._count.trackId } : null,
  }
}

// A listener's feed: new tracks and reposts from the artists they follow.
export async function feedTracks(listener: string, take = 40) {
  await publishDueTracks()
  const following = await db.follow.findMany({ where: { listener }, select: { artistId: true } })
  const artistIds = following.map(f => f.artistId)
  if (!artistIds.length) return { tracks: [] as TrackCardData[], following: false }
  const [own, reposts] = await Promise.all([
    db.track.findMany({ where: { userId: { in: artistIds }, published: true, user: { profileClaimed: true } }, orderBy: { createdAt: 'desc' }, take, include }),
    db.repost.findMany({ where: { listener: { in: artistIds }, track: { published: true, user: { profileClaimed: true } } }, orderBy: { createdAt: 'desc' }, take, select: { createdAt: true, track: { include } } }),
  ])
  const merged = [
    ...own.map(track => ({ track, activityAt: track.createdAt })),
    ...reposts.map(repost => ({ track: repost.track, activityAt: repost.createdAt })),
  ]
  merged.sort((a, b) => b.activityAt.getTime() - a.activityAt.getTime())
  const seen = new Set<string>()
  const unique = merged.map(item => item.track).filter(t => (seen.has(t.id) ? false : (seen.add(t.id), true)))
  return { tracks: await toCards(unique.slice(0, take)), following: true }
}
