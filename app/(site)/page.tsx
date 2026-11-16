import Link from 'next/link'
import { listTracks, trendingTracks } from '@/lib/queries'
import { TrackList } from '@/components/TrackCard'
import { GENRES } from '@/lib/genres'
import FeaturedRelease from '@/components/FeaturedRelease'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const [trending, fresh] = await Promise.all([trendingTracks(10), listTracks({}, { createdAt: 'desc' }, 20)])
  const featured = trending[0] ?? fresh[0]
  const queue = trending.length ? trending : fresh

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-10">
        {featured ? <FeaturedRelease track={featured} queue={queue} /> : <section className="border border-[#596255] bg-[#111511] px-6 py-12 sm:px-10"><p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#d8ff16]">SolidSoundZ / independent frequency</p><h1 className="mt-3 text-6xl">Release your signal.</h1><Link href="/upload" className="mt-6 inline-block bg-[#d8ff16] px-5 py-3 text-sm font-bold uppercase tracking-[0.1em] text-black">Upload your track</Link></section>}

        <section>
          <h2 className="flex items-center gap-3 text-3xl mb-3"><span className="font-mono text-xs text-[#d8ff16]">01</span> Moving right now</h2>
          <TrackList tracks={trending.filter(track => track.id !== featured?.id)} empty={featured ? 'More trending tracks will appear here as the catalog grows.' : <>No tracks yet. <Link href="/upload" className="text-[#ccff00] underline">Upload the first one</Link>.</>} />
        </section>

        <section>
          <h2 className="flex items-center gap-3 text-3xl mb-3"><span className="font-mono text-xs text-[#d8ff16]">02</span> New releases</h2>
          <TrackList tracks={fresh} empty="New uploads will show up here." />
        </section>
      </div>

      <aside className="space-y-6">
        <div>
          <h3 className="text-xl text-[#d8ff16] mb-3">Browse by genre</h3>
          <div className="flex flex-wrap gap-2">
            {GENRES.map(g => <Link key={g} href={`/search?genre=${encodeURIComponent(g)}`} className="px-3 py-1 border border-[#394039] bg-[#111511] text-xs font-bold uppercase tracking-[0.06em] text-[#d6dcd4] hover:border-[#d8ff16] hover:text-[#d8ff16]">{g}</Link>)}
          </div>
        </div>
        <div className="border border-[#555d52] bg-[#151a15] p-5 border-l-4 border-l-[#ff5a36]">
          <div className="text-2xl text-[#d8ff16]">Mix &amp; Master Studio</div>
          <p className="text-sm text-[#c7cec5] mt-2">5-band EQ, compressor, saturation, stereo width, loudness matching and HD export, all in your browser.</p>
          <Link href="/studio" className="inline-block mt-4 text-xs font-bold uppercase tracking-[0.12em] text-white border-b border-[#d8ff16] pb-1 hover:text-[#d8ff16]">Try it free</Link>
        </div>
      </aside>
    </div>
  )
}
