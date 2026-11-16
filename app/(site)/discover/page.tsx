import Link from 'next/link'
import { db } from '@/lib/db'
import { currentAccount } from '@/lib/account'
import { listenerId } from '@/lib/listener'
import { listTracks, trendingTracks } from '@/lib/queries'
import { TrackList } from '@/components/TrackCard'
import { artUrl } from '@/lib/storage'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Discover', description: 'Personalized music discovery on SolidSoundZ.' }

export default async function DiscoverPage() {
  const account = await currentAccount()
  const listener = account?.id ?? listenerId()
  const liked = listener ? await db.like.findMany({ where: { listener }, select: { track: { select: { id: true, genre: true } } }, take: 50 }) : []
  const likedIds = liked.map(item => item.track.id)
  const genres = Array.from(new Set(liked.map(item => item.track.genre).filter((genre): genre is string => !!genre)))
  const [forYou, trending, artists] = await Promise.all([
    genres.length ? listTracks({ genre: { in: genres }, id: { notIn: likedIds } }, { plays: 'desc' }, 30) : Promise.resolve([]),
    trendingTracks(30),
    db.user.findMany({ where: account ? { id: { not: account.id } } : {}, orderBy: { tracks: { _count: 'desc' } }, take: 12, select: { handle: true, slug: true, avatarHref: true, avatarKey: true, _count: { select: { tracks: true, followers: true } } } }),
  ])
  return <div className="space-y-10"><section className="border-y border-[#586055] bg-[#111511] p-6"><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#d8ff16]">SolidSoundZ discovery</p><h1 className="mt-2 text-5xl">Discover</h1><p className="mt-3 max-w-xl text-[#c7cec5]">New music shaped by what you follow, like, and replay.</p></section>{forYou.length > 0 ? <section><h2 className="text-3xl mb-3">For you</h2><TrackList tracks={forYou} /></section> : <section className="border-l-4 border-l-[#ff5a36] bg-[#151a15] p-4"><p className="text-sm text-[#dce2d9]">Like a few tracks and follow artists to personalize this page.</p><Link href="/search" className="mt-3 inline-block text-xs font-bold uppercase tracking-[0.1em] text-[#d8ff16]">Browse music</Link></section>}<section><h2 className="text-3xl mb-3">Artists to follow</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{artists.map(artist => <Link key={artist.slug} href={`/artist/${artist.slug}`} className="flex items-center gap-3 border border-[#3e473d] bg-[#111511] p-3 hover:border-[#d8ff16]"><div className="h-12 w-12 flex-none overflow-hidden border border-[#53604d] bg-[#0a0d0a] flex items-center justify-center text-xs font-bold text-[#d8ff16]">{artist.avatarHref ?? artUrl(artist.avatarKey) ? <img src={artist.avatarHref ?? artUrl(artist.avatarKey)!} alt="" className="h-full w-full object-cover" /> : 'SSZ'}</div><div className="min-w-0"><p className="truncate font-bold text-white">{artist.handle}</p><p className="text-xs text-[#aeb8ab]">{artist._count.tracks} tracks · {artist._count.followers} followers</p></div></Link>)}</div></section><section><h2 className="text-3xl mb-3">Trending across SolidSoundZ</h2><TrackList tracks={trending} empty="Discovery will fill as music is released." /></section></div>
}