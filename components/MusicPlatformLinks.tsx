import { MUSIC_PLATFORMS, musicSearchUrl } from '@/lib/musicLinks'

export default function MusicPlatformLinks({ appleMusicUrl, spotifyUrl, title, artist, size = 'sm' }: {
  appleMusicUrl?: string | null, spotifyUrl?: string | null, title: string, artist: string, size?: 'sm' | 'lg',
}) {
  const urls = { appleMusic: appleMusicUrl, spotify: spotifyUrl }
  return <div role="group" aria-label={`Find ${title} on music services`} className="inline-flex max-w-full flex-wrap items-stretch gap-2">
    {(['appleMusic', 'spotify'] as const).map(platform => {
      const { name } = MUSIC_PLATFORMS[platform]
      const direct = urls[platform]
      return <a key={platform} href={direct || musicSearchUrl(platform, title, artist)} target="_blank" rel="noopener noreferrer"
        aria-label={`${direct ? 'Listen to' : 'Search for'} ${title} by ${artist} on ${name} (opens in a new tab)`}
        title={direct ? `Open the linked song on ${name}` : `Search ${name} by song and artist; an exact song link has not been added`}
        className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded border border-[#555] font-bold text-[#ddd] hover:border-[#d8ff16] hover:text-white ${size === 'lg' ? 'min-h-11 px-4 py-2 text-sm' : 'min-h-9 px-2.5 py-1 text-xs'}`}>
        <span><span className="block">{name}</span>{!direct && <span className="block text-[10px] font-normal leading-4 text-[#aaa]">Search</span>}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 4H4v12h12v-3M10 4h6v6M16 4l-8 8" /></svg>
      </a>
    })}
  </div>
}
