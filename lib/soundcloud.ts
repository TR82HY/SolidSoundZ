import { db } from './db'
import { soundcloudFetch, soundCloudId, record } from './soundcloudApi'
import { fetchPublicSoundCloudCatalog, soundCloudTrackSnapshot } from './soundcloudSync'
export { SoundCloudRequestError } from './soundcloudApi'

export async function importSoundCloudTracks(token: string, artistId: string) {
  const profile = record(await soundcloudFetch('/me', token))
  if (typeof profile.permalink_url !== 'string') throw new Error('SoundCloud profile URL is missing.')
  const catalog = await fetchPublicSoundCloudCatalog(profile.permalink_url, soundCloudId(profile, 'users'), token)
  let imported = 0
  for (const track of catalog.tracks) {
    const metadata = soundCloudTrackSnapshot(track, new Date())
    const existing = await db.track.findFirst({ where: { userId: artistId, OR: [{ soundCloudTrackId: track.id }, { s3Key: `soundcloud/${track.id}` }, { scUrl: track.url }] }, select: { id: true, waveformUrl: true } })
    if (existing) {
      await db.track.update({ where: { id: existing.id }, data: { ...metadata, ...(track.waveform && !existing.waveformUrl ? { waveformUrl: track.waveform } : {}) } })
      continue
    }
    await db.track.create({
      data: {
        userId: artistId,
        title: track.title,
        s3Key: `soundcloud/${track.id}`,
        artHref: track.artwork, waveformUrl: track.waveform, duration: track.duration, ...metadata,
        published: false,
        createdAt: track.createdAt,
      },
    })
    imported++
  }
  return imported
}

export async function importSoundCloudPlaylists(token: string, artistId: string) {
  const playlists: Record<string, unknown>[] = []
  const pages = new Set<string>()
  let path: string | null = '/me/playlists?show_tracks=true&limit=200&linked_partitioning=true'
  while (path && playlists.length < 1_000) {
    if (pages.has(path)) throw new Error('SoundCloud playlist pagination repeated.')
    pages.add(path)
    const response = await soundcloudFetch(path, token)
    const page: Record<string, unknown> = Array.isArray(response) ? { collection: response } : record(response)
    if (!Array.isArray(page.collection) || page.next_href !== undefined && page.next_href !== null && typeof page.next_href !== 'string') throw new Error('Invalid SoundCloud playlist page.')
    playlists.push(...page.collection.map(record))
    path = typeof page.next_href === 'string' ? page.next_href : null
  }
  if (path) throw new Error('SoundCloud playlist import exceeded the supported catalog size.')

  let imported = 0
  for (const playlist of playlists) {
    if (playlist.sharing !== 'public') continue
    if (typeof playlist.title !== 'string' || !playlist.title.trim() || !Array.isArray(playlist.tracks)) throw new Error('SoundCloud playlist details are incomplete.')
    const sourceId = soundCloudId(playlist, 'playlists')
    const trackKeys = [...new Set(playlist.tracks.map(track => `soundcloud/${soundCloudId(track, 'tracks')}`))]
    const tracks = trackKeys.length ? await db.track.findMany({ where: { userId: artistId, s3Key: { in: trackKeys } }, select: { id: true, s3Key: true } }) : []
    const trackIdByKey = new Map(tracks.map(track => [track.s3Key, track.id]))
    const items = trackKeys.flatMap((key, position) => {
      const trackId = trackIdByKey.get(key)
      return trackId ? [{ trackId, position }] : []
    })
    const existing = await db.playlist.findFirst({ where: { userId: artistId, soundCloudId: sourceId }, select: { id: true } })
    const data = { userId: artistId, soundCloudId: sourceId, title: playlist.title.trim().slice(0, 120), description: typeof playlist.description === 'string' ? playlist.description.trim().slice(0, 2000) || null : null, artHref: typeof playlist.artwork_url === 'string' ? playlist.artwork_url : null }
    const saved = existing
      ? await db.playlist.update({ where: { id: existing.id }, data })
      : await db.playlist.create({ data })
    await db.$transaction([
      db.playlistTrack.deleteMany({ where: { playlistId: saved.id } }),
      ...(items.length ? [db.playlistTrack.createMany({ data: items.map(item => ({ playlistId: saved.id, ...item })) })] : []),
    ])
    if (!existing) imported++
  }
  return imported
}

export type SoundCloudProfile = { id: number, username?: string, description?: string | null, avatar_url?: string | null, city?: string | null, country?: string | null, permalink_url?: string }

export const getSoundCloudProfile = async (token: string): Promise<SoundCloudProfile> => {
  const profile = record(await soundcloudFetch('/me', token))
  const id = Number(soundCloudId(profile, 'users'))
  if (!Number.isSafeInteger(id)) throw new Error('Invalid SoundCloud profile ID.')
  const source = typeof profile.permalink_url === 'string' ? new URL(profile.permalink_url) : null
  if (source && (source.protocol !== 'https:' || !['soundcloud.com', 'www.soundcloud.com'].includes(source.hostname) || source.username || source.password || source.port || !/^\/[^/]+\/?$/.test(source.pathname))) throw new Error('Invalid SoundCloud profile URL.')
  if (source) { source.search = ''; source.hash = '' }
  return {
    id,
    ...(source ? { permalink_url: source.href } : {}),
    ...(typeof profile.username === 'string' ? { username: profile.username } : {}),
    ...(typeof profile.description === 'string' ? { description: profile.description } : {}),
    ...(typeof profile.avatar_url === 'string' ? { avatar_url: profile.avatar_url } : {}),
    ...(typeof profile.city === 'string' ? { city: profile.city } : {}),
    ...(typeof profile.country === 'string' ? { country: profile.country } : {}),
  }
}