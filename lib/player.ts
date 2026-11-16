import type { TrackCardData } from './queries'

export type PlayerTrack = Pick<TrackCardData, 'id' | 'title' | 'artist' | 'artistSlug' | 'artUrl' | 'audioUrl' | 'duration' | 'peaks' | 'liked' | 'likes' | 'scUrl' | 'soundCloudPlayback' | 'contentType' | 'scAccess'> & Partial<Pick<TrackCardData, 'scLikes'>>
export type QueueSelection = { queue: PlayerTrack[], index: number }

function playableUrl(value: unknown) {
  if (typeof value !== 'string' || !value) return false
  if (value.startsWith('/') && !value.startsWith('//')) return true
  try { return ['https:', 'http:'].includes(new URL(value).protocol) } catch { return false }
}

export function isPlayerTrack(value: unknown): value is PlayerTrack {
  if (!value || typeof value !== 'object') return false
  return 'id' in value && typeof value.id === 'string' && !!value.id
    && 'title' in value && typeof value.title === 'string'
    && 'artist' in value && typeof value.artist === 'string'
    && 'artistSlug' in value && typeof value.artistSlug === 'string'
    && 'audioUrl' in value && playableUrl(value.audioUrl)
    && 'artUrl' in value && (value.artUrl === null || playableUrl(value.artUrl))
    && 'duration' in value && typeof value.duration === 'number' && Number.isFinite(value.duration) && value.duration >= 0
    && 'likes' in value && typeof value.likes === 'number' && Number.isSafeInteger(value.likes) && value.likes >= 0
    && 'liked' in value && typeof value.liked === 'boolean'
    && (!('scLikes' in value) || typeof value.scLikes === 'number' && Number.isSafeInteger(value.scLikes) && value.scLikes >= 0)
    && 'peaks' in value && (value.peaks === null || Array.isArray(value.peaks) && value.peaks.length <= 400 && value.peaks.every(peak => typeof peak === 'number' && Number.isFinite(peak) && peak >= 0 && peak <= 1))
    && 'soundCloudPlayback' in value && typeof value.soundCloudPlayback === 'boolean'
    && (!('scUrl' in value) || value.scUrl === null || playableUrl(value.scUrl))
    && (!('scAccess' in value) || value.scAccess === null || typeof value.scAccess === 'string')
    && (!('contentType' in value) || typeof value.contentType === 'string')
}

export function parseSavedQueue(value: unknown): QueueSelection & { time: number } {
  if (!value || typeof value !== 'object' || !('queue' in value) || !Array.isArray(value.queue)
    || !value.queue.every(isPlayerTrack) || !('index' in value) || typeof value.index !== 'number' || !Number.isInteger(value.index)) throw new Error('Invalid saved playback queue.')
  const queue = value.queue
  if (new Set(queue.map(track => track.id)).size !== queue.length) throw new Error('Duplicate saved playback tracks.')
  const index = queue.length ? Math.max(0, Math.min(queue.length - 1, value.index)) : -1
  const time = 'time' in value ? value.time : 0
  if (typeof time !== 'number' || !Number.isFinite(time) || time < 0) throw new Error('Invalid saved playback position.')
  return { queue, index, time: Math.min(time, queue[index]?.duration || time) }
}

export const playerSourceKey = (track: PlayerTrack | null) => track ? `${track.id}:${track.soundCloudPlayback ? track.scUrl ?? '' : track.audioUrl}` : ''

export function playerSource(track: PlayerTrack) {
  return track.soundCloudPlayback ? {
    label: 'SoundCloud stream',
    detail: 'The official SoundCloud player selects the stream available to your browser and account. Its bitrate is not selectable here. A full-quality original upload takes priority when the artist provides one.',
  } : {
    label: 'Original upload',
    detail: 'Playing the uploaded audio file directly, without extra compression or mastering by SolidSoundZ. Final quality depends on the source file, browser and listening device.',
  }
}
