export type MusicPlatform = 'appleMusic' | 'spotify'

export const MUSIC_PLATFORMS = {
  appleMusic: { name: 'Apple Music', placeholder: 'https://music.apple.com/us/album/release/123?i=456' },
  spotify: { name: 'Spotify', placeholder: 'https://open.spotify.com/track/...' },
} as const

export function parseMusicLink(value: unknown, platform: MusicPlatform): string | null {
  if (value === null || typeof value === 'string' && !value.trim()) return null
  const invalid = () => new Error(platform === 'spotify'
    ? 'Use a full https://open.spotify.com/track/... song link, or leave Spotify blank.'
    : 'Use an https://music.apple.com song link or an album link with a song ID (?i=...), or leave Apple Music blank.')
  if (typeof value !== 'string' || value.length > 2000) throw invalid()
  let url: URL
  try { url = new URL(value.trim()) } catch { throw invalid() }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw invalid()
  if (platform === 'spotify') {
    const track = /^\/(?:intl-[a-z]{2}\/)?track\/([A-Za-z0-9]{22})\/?$/.exec(url.pathname)
    if (url.hostname !== 'open.spotify.com' || !track) throw invalid()
    return `https://open.spotify.com/track/${track[1]}`
  }
  if (url.hostname !== 'music.apple.com' || !/^\/(?:[a-z]{2}\/)?(song|album)\/(?:[^/]+\/)?[1-9]\d*\/?$/.test(url.pathname)) throw invalid()
  const songId = url.searchParams.get('i')
  if (url.pathname.includes('/album/') && (!songId || !/^[1-9]\d*$/.test(songId))) throw invalid()
  url.hash = ''
  url.search = ''
  if (songId && /^[1-9]\d*$/.test(songId)) url.searchParams.set('i', songId)
  return url.href
}

export function musicSearchUrl(platform: MusicPlatform, title: string, artist: string) {
  const query = `${artist} ${title}`.trim()
  if (platform === 'spotify') return `https://open.spotify.com/search/${encodeURIComponent(query)}`
  const url = new URL('https://music.apple.com/us/search')
  url.searchParams.set('term', query)
  return url.href
}
