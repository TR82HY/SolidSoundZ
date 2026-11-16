import Link from 'next/link'
import { db } from '@/lib/db'
import { listTracks } from '@/lib/queries'
import { TrackList } from '@/components/TrackCard'
import { GENRES } from '@/lib/genres'
import { artUrl } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export default async function Search({ searchParams }: { searchParams: { q?: string, genre?: string } }) {
  const q = (searchParams.q ?? '').trim().slice(0, 100)
  const genre = GENRES.includes(searchParams.genre ?? '') ? searchParams.genre! : null
  const postgres = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? '')
  // SQLite rejects mode; Postgres also treats backslashes as LIKE escape characters.
  const textFilter = {
    contains: postgres ? q.replace(/\\/g, '\\\\') : q,
    ...(postgres ? { mode: 'insensitive' as const } : {}),
  }

  const [tracks, artists] = await Promise.all([
    listTracks({
      ...(genre ? { genre } : {}),
      ...(q ? { OR: [{ title: textFilter }, { genre: textFilter }, { description: textFilter }, { user: { handle: textFilter } }] } : {}),
    }, { plays: 'desc' }, 50),
    q ? db.user.findMany({ where: { OR: [{ handle: textFilter }, { slug: { ...textFilter, contains: textFilter.contains.toLowerCase() } }] }, take: 10, select: { handle: true, slug: true, avatarHref: true, avatarKey: true, _count: { select: { tracks: true, followers: true } } } }) : [],
  ])

  return (
    <div className="space-y-8">
      <h1 className="break-words text-2xl font-bold">{genre ? `#${genre}` : q ? <>Results for &ldquo;{q}&rdquo;</> : 'Browse'}</h1>
      <div className="flex flex-wrap gap-2">
        {GENRES.map(g => (
          <Link key={g} href={g === genre ? q ? `/search?q=${encodeURIComponent(q)}` : '/search' : `/search?genre=${encodeURIComponent(g)}${q ? `&q=${encodeURIComponent(q)}` : ''}`} aria-current={g === genre ? 'true' : undefined}
            className={`px-3 py-1 rounded-full text-sm border ${g === genre ? 'bg-[#ccff00] text-black border-[#ccff00] font-bold' : 'bg-[#1a1a1a] border-[#333] text-[#ddd] hover:border-[#ccff00]'}`}>{g}</Link>
        ))}
      </div>
      {artists.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-3">Artists</h2>
          <div className="flex flex-wrap gap-3">
            {artists.map(a => (
              <Link key={a.slug} href={`/artist/${a.slug}`} className="flex min-w-0 max-w-full items-center gap-3 rounded-full bg-[#1a1a1a] border border-[#333] pl-1 pr-4 py-1 hover:border-[#ccff00]">
                <span className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-[#ccff00] to-[#333] overflow-hidden flex items-center justify-center text-black font-black">{a.avatarHref ?? artUrl(a.avatarKey) ? <img src={a.avatarHref ?? artUrl(a.avatarKey)!} alt="" className="w-full h-full object-cover" /> : 'SSZ'}</span>
                <span className="min-w-0"><span className="block break-words font-bold text-white">{a.handle}</span><span className="text-xs text-[#aaa]">{a._count.tracks} tracks • {a._count.followers} followers</span></span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <section>
        <h2 className="text-lg font-bold mb-1">Tracks</h2>
        <TrackList tracks={tracks} empty="No tracks match that yet." />
      </section>
    </div>
  )
}
