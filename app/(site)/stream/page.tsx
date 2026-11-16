import Link from 'next/link'
import { feedTracks, trendingTracks } from '@/lib/queries'
import { listenerId } from '@/lib/listener'
import { currentAccount } from '@/lib/account'
import { TrackList } from '@/components/TrackCard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Stream', robots: { index: false } }

export default async function StreamPage() {
  const listener = (await currentAccount())?.id ?? listenerId()
  const { tracks, following } = listener ? await feedTracks(listener) : { tracks: [], following: false }
  const starterTracks = !following ? await trendingTracks(20) : []

  return (
    <div className="space-y-6">
      <div className="border-b border-[#485044] pb-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#d8ff16]">Listening queue</p>
        <h1 className="mt-1 text-4xl">{following ? 'Your stream' : 'Start your stream'}</h1>
      </div>
      {!following ? (
        <>
          <p className="max-w-2xl text-[#aaa]">Follow artists to make this queue your own. Until then, these are the tracks moving across SolidSoundZ right now.</p>
          <TrackList tracks={starterTracks} empty={<>No releases are moving yet. <Link href="/upload" className="text-[#ccff00] underline">Put the first one in the stream.</Link></>} />
        </>
      ) : (
        <TrackList tracks={tracks} empty="Nobody you follow has posted yet. Check back soon!" />
      )}
    </div>
  )
}
