import Link from 'next/link'
import { compact } from '@/lib/format'

type Growth = {
  playsThisWeek: number, playsPrevWeek: number,
  followersThisWeek: number, followersPrevWeek: number,
  topTrack: { id: string, title: string, plays: number } | null,
}

function Delta({ current, previous }: { current: number, previous: number }) {
  if (previous === 0) return current > 0 ? <span className="text-[#d8ff16]">New</span> : <span className="text-[#737b72]">—</span>
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return <span className="text-[#737b72]">flat</span>
  const up = pct > 0
  return <span className={up ? 'text-[#d8ff16]' : 'text-[#ff9d89]'}>{up ? '▲' : '▼'} {Math.abs(pct)}%</span>
}

export default function GrowthPanel({ growth }: { growth: Growth }) {
  return (
    <section className="border border-[#3e473d] bg-[#111511] p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#d8ff16]">Growth / last 7 days</p>
      <div className="mt-4 grid gap-4 grid-cols-2 md:grid-cols-3">
        <div>
          <div className="text-2xl font-bold text-white">{compact(growth.playsThisWeek)}</div>
          <div className="text-xs text-[#aeb8ab]">Plays this week <Delta current={growth.playsThisWeek} previous={growth.playsPrevWeek} /></div>
        </div>
        <div>
          <div className="text-2xl font-bold text-white">{compact(growth.followersThisWeek)}</div>
          <div className="text-xs text-[#aeb8ab]">New followers <Delta current={growth.followersThisWeek} previous={growth.followersPrevWeek} /></div>
        </div>
        <div className="col-span-2 md:col-span-1">
          {growth.topTrack ? (
            <>
              <Link href={`/t/${growth.topTrack.id}`} className="block truncate text-lg font-bold text-white hover:text-[#d8ff16]">{growth.topTrack.title}</Link>
              <div className="text-xs text-[#aeb8ab]">Top track this week · {compact(growth.topTrack.plays)} plays</div>
            </>
          ) : <div className="text-xs text-[#aeb8ab]">No plays yet this week.</div>}
        </div>
      </div>
    </section>
  )
}
