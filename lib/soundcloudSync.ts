import { randomUUID } from 'crypto'
import { GENRES } from './genres'
import { db } from './db'
import { getSoundCloudAppToken, record, soundCloudId, soundcloudFetch, SoundCloudBusyError, SoundCloudRequestError } from './soundcloudApi'

export const SOUNDCLOUD_SYNC_INTERVAL = 5 * 60_000

function counter(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 2_147_483_647) throw new Error(`Invalid SoundCloud ${label}.`)
  return value
}

function publicUrl(value: unknown, kind: 'profile' | 'track') {
  if (typeof value !== 'string') throw new Error(`Missing SoundCloud ${kind} URL.`)
  const url = new URL(value)
  if (url.protocol !== 'https:' || !['soundcloud.com', 'www.soundcloud.com'].includes(url.hostname) || url.username || url.password || url.port
    || !new RegExp(kind === 'profile' ? '^/[^/]+/?$' : '^/[^/]+/[^/]+/?$').test(url.pathname)) throw new Error(`Invalid SoundCloud ${kind} URL.`)
  url.hostname = 'soundcloud.com'; url.search = ''; url.hash = ''
  url.pathname = url.pathname.replace(/\/$/, '')
  return url.href
}

function mediaUrl(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Error('Invalid SoundCloud artwork or waveform.')
  const url = new URL(value)
  if (url.protocol !== 'https:' || !/(^|\.)sndcdn\.com$/.test(url.hostname) || url.username || url.password || url.port) throw new Error('Unexpected SoundCloud media host.')
  return url.href
}

export function parsePublicSoundCloudTrack(value: unknown, sourceUserId: string) {
  const data = record(value)
  const id = soundCloudId(data, 'tracks')
  const owner = soundCloudId(data.user ?? { id: data.user_id }, 'users')
  if (owner !== sourceUserId) throw new Error('SoundCloud returned a track from another artist.')
  if (data.sharing !== 'public') return null
  if (typeof data.title !== 'string' || !data.title.trim()) throw new Error('SoundCloud track title is missing.')
  if (typeof data.duration !== 'number' || !Number.isFinite(data.duration) || data.duration <= 0) throw new Error('Invalid SoundCloud track duration.')
  const createdAt = new Date(typeof data.created_at === 'string' ? data.created_at : '')
  if (!Number.isFinite(createdAt.getTime())) throw new Error('Invalid SoundCloud release date.')
  const statsHidden = data.reveal_stats === false
  const commentsHidden = data.reveal_comments === false
  const access = data.access === 'playable' && data.streamable === true ? 'playable'
    : data.access === 'preview' ? 'preview'
      : data.access === 'blocked' || data.streamable === false ? 'blocked' : null
  const genre = typeof data.genre === 'string' ? GENRES.find(genre => genre.toLowerCase() === String(data.genre).toLowerCase()) ?? null : null
  return {
    id, url: publicUrl(data.permalink_url, 'track'), title: data.title.trim().slice(0, 120),
    description: typeof data.description === 'string' ? data.description.trim().slice(0, 2000) || null : null,
    genre, duration: data.duration / 1000, createdAt,
    artwork: mediaUrl(data.artwork_url), waveform: mediaUrl(data.waveform_url),
    access, statsHidden, commentsHidden,
    plays: statsHidden ? undefined : counter(data.playback_count, 'play count'),
    likes: statsHidden ? undefined : counter(data.favoritings_count ?? data.likes_count, 'like count'),
    reposts: statsHidden ? undefined : counter(data.reposts_count, 'repost count'),
    comments: commentsHidden ? undefined : counter(data.comment_count, 'comment count'),
  }
}

export function soundCloudTrackSnapshot(track: NonNullable<ReturnType<typeof parsePublicSoundCloudTrack>>, syncedAt: Date) {
  return {
    soundCloudTrackId: track.id, scUrl: track.url, scSyncedAt: syncedAt, scAccess: track.access,
    scStatsHidden: track.statsHidden, scCommentsHidden: track.commentsHidden,
    ...(track.plays !== undefined ? { scPlays: track.plays } : {}),
    ...(track.likes !== undefined ? { scLikes: track.likes } : {}),
    ...(track.reposts !== undefined ? { scReposts: track.reposts } : {}),
    ...(track.comments !== undefined ? { scComments: track.comments } : {}),
  }
}

export async function fetchPublicSoundCloudCatalog(profileUrl: string, sourceUserId: string, token: string) {
  const signal = AbortSignal.timeout(20_000)
  const profile = record(await soundcloudFetch(`/resolve?url=${encodeURIComponent(publicUrl(profileUrl, 'profile'))}`, token, signal))
  if (soundCloudId(profile, 'users') !== sourceUserId) throw new Error('The connected SoundCloud profile identity changed.')
  const followers = counter(profile.followers_count, 'follower count')
  const publicTracks = counter(profile.track_count, 'track count')
  const canonical = publicUrl(profile.permalink_url, 'profile')
  const tracks = new Map<string, NonNullable<ReturnType<typeof parsePublicSoundCloudTrack>>>()
  const pages = new Set<string>()
  let next: string | null = `/users/${encodeURIComponent(`soundcloud:users:${sourceUserId}`)}/tracks?limit=200&linked_partitioning=true`
  while (next) {
    if (pages.has(next) || pages.size >= 10 || tracks.size > 2000) throw new Error('SoundCloud catalog pagination was incomplete.')
    pages.add(next)
    const response: unknown = await soundcloudFetch(next, token, signal)
    const page: Record<string, unknown> = Array.isArray(response) ? { collection: response } : record(response)
    if (!Array.isArray(page.collection) || (page.next_href !== null && page.next_href !== undefined && typeof page.next_href !== 'string')) throw new Error('Invalid SoundCloud track page.')
    for (const item of page.collection) {
      const track = parsePublicSoundCloudTrack(item, sourceUserId)
      if (track) tracks.set(track.id, track)
    }
    next = typeof page.next_href === 'string' && page.next_href ? page.next_href : null
  }
  if (publicTracks > 0 && !tracks.size) throw new Error('SoundCloud returned an empty catalog for an artist with public tracks.')
  return { profileUrl: canonical, followers, publicTracks, tracks: [...tracks.values()] }
}

function syncMessage(error: unknown) {
  if (error instanceof SoundCloudRequestError) {
    if (error.status === 401 || error.status === 403) return 'SoundCloud authorization needs attention. The last saved catalog is still available.'
    if (error.status === 429) return 'SoundCloud is rate-limiting updates. Refresh will retry automatically.'
  }
  return 'SoundCloud refresh is delayed. The last saved catalog is still available; updates will retry automatically.'
}

async function syncArtist(connection: { userId: string, sourceUserId: string, profileUrl: string, importNew: boolean }, accessToken?: string) {
  const lockId = randomUUID()
  const now = new Date()
  const locked = await db.soundCloudSync.updateMany({
    where: { userId: connection.userId, enabled: true, nextSyncAt: { lte: now }, OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] },
    data: { lockId, lockedUntil: new Date(Date.now() + 90_000) },
  })
  if (!locked.count) return false
  try {
    const token = accessToken ?? await getSoundCloudAppToken()
    const catalog = await fetchPublicSoundCloudCatalog(connection.profileUrl, connection.sourceUserId, token)
    const syncedAt = new Date()
    await db.$transaction(async tx => {
      const owner = await tx.soundCloudSync.findFirst({ where: { userId: connection.userId, sourceUserId: connection.sourceUserId, enabled: true, lockId }, select: { importNew: true } })
      if (!owner) throw new SoundCloudBusyError()
      const existing = await tx.track.findMany({
        where: { userId: connection.userId },
        select: { id: true, soundCloudTrackId: true, scUrl: true, s3Key: true, appleMusicUrl: true },
      })
      const seen = new Set<string>()
      for (const track of catalog.tracks) {
        const matches = existing.filter(item => item.soundCloudTrackId === track.id
          || item.s3Key === `soundcloud/${track.id}` || item.scUrl?.replace(/\/$/, '') === track.url)
        const metadata = soundCloudTrackSnapshot(track, syncedAt)
        for (const match of matches) {
          seen.add(match.id)
          const sourceManaged = match.s3Key.startsWith('soundcloud/')
          await tx.track.update({
            where: { id: match.id },
            data: {
              ...metadata,
              ...(sourceManaged ? { duration: track.duration, waveformUrl: track.waveform,
                ...(!match.appleMusicUrl ? { title: track.title, artHref: track.artwork, description: track.description, genre: track.genre } : {}),
              } : {}),
            },
          })
        }
        if (!matches.length && owner.importNew && track.access === 'playable') {
          await tx.track.create({
            data: {
              userId: connection.userId, title: track.title, s3Key: `soundcloud/${track.id}`, contentType: 'audio/mpeg',
              artHref: track.artwork, waveformUrl: track.waveform, description: track.description, genre: track.genre,
              duration: track.duration, createdAt: track.createdAt, published: true, publishedAt: syncedAt, ...metadata,
            },
          })
        }
      }
      const absent = existing.filter(track => !seen.has(track.id) && (track.soundCloudTrackId || track.s3Key.startsWith('soundcloud/')))
      if (absent.length) await tx.track.updateMany({ where: { userId: connection.userId, id: { in: absent.map(track => track.id) } }, data: { scAccess: 'unavailable', scSyncedAt: syncedAt } })
      const updated = await tx.soundCloudSync.updateMany({
        where: { userId: connection.userId, lockId, enabled: true },
        data: {
          syncedAt, nextSyncAt: new Date(syncedAt.getTime() + SOUNDCLOUD_SYNC_INTERVAL), lockId: null, lockedUntil: null, error: null,
          profileUrl: catalog.profileUrl, followers: catalog.followers, publicTracks: catalog.publicTracks,
          sourcePlays: counter(catalog.tracks.reduce((sum, track) => sum + (track.plays ?? 0), 0), 'catalog play total'),
        },
      })
      if (!updated.count) throw new SoundCloudBusyError()
    }, { isolationLevel: 'Serializable', maxWait: 3000, timeout: 20_000 })
    return true
  } catch (error) {
    const busy = error instanceof SoundCloudBusyError
    if (!busy) console.error('SoundCloud catalog refresh failed.', error instanceof SoundCloudRequestError ? `HTTP ${error.status}` : error instanceof Error ? error.message : 'Unknown error')
    await db.soundCloudSync.updateMany({
      where: { userId: connection.userId, lockId },
      data: { lockId: null, lockedUntil: null, nextSyncAt: new Date(Date.now() + (busy ? 30_000 : SOUNDCLOUD_SYNC_INTERVAL)), ...(!busy ? { error: syncMessage(error) } : {}) },
    })
    return false
  }
}

export async function refreshSoundCloudConnection(userId: string, accessToken: string) {
  const connection = await db.soundCloudSync.findFirst({
    where: { userId, enabled: true, user: { profileClaimed: true } },
    select: { userId: true, sourceUserId: true, profileUrl: true, importNew: true },
  })
  if (!connection) throw new Error('The SoundCloud connection is no longer enabled.')
  return syncArtist(connection, accessToken)
}

let activeRefresh: Promise<boolean> | null = null
let checkedAt = 0

export function refreshDueSoundCloud() {
  if (activeRefresh) return activeRefresh
  if (Date.now() - checkedAt < 2000) return Promise.resolve(false)
  activeRefresh = (async () => {
    const due = await db.soundCloudSync.findMany({
      where: { enabled: true, user: { profileClaimed: true }, nextSyncAt: { lte: new Date() } },
      orderBy: { nextSyncAt: 'asc' }, take: 1,
      select: { userId: true, sourceUserId: true, profileUrl: true, importNew: true },
    })
    let refreshed = false
    for (const connection of due) refreshed = await syncArtist(connection) || refreshed
    checkedAt = Date.now()
    return refreshed
  })().finally(() => { activeRefresh = null })
  return activeRefresh
}
