import Link from 'next/link'
import { getArtist } from '@/lib/artist'
import { db } from '@/lib/db'
import { compact } from '@/lib/format'
import ConnectPayoutsButton from '@/components/ConnectPayoutsButton'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Earnings', robots: { index: false } }

export default async function EarningsPage() {
  const artist = await getArtist()
  if (!artist) return <div className="border border-[#586055] bg-[#111511] p-6"><h1 className="text-4xl">Earnings</h1><p className="mt-3 text-[#c7cec5]">Sign in to see your fan support and payouts.</p><Link href="/sign-in" className="mt-5 inline-block bg-[#d8ff16] px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-black">Sign in</Link></div>

  const [paidTotal, pendingTotal, paidCount, recent] = await Promise.all([
    db.contribution.aggregate({ where: { artistId: artist.id, status: 'paid' }, _sum: { amountCents: true } }),
    db.contribution.aggregate({ where: { artistId: artist.id, status: 'pending' }, _sum: { amountCents: true } }),
    db.contribution.count({ where: { artistId: artist.id, status: 'paid' } }),
    db.contribution.findMany({ where: { artistId: artist.id, status: 'paid' }, orderBy: { createdAt: 'desc' }, take: 20, include: { track: { select: { id: true, title: true } } } }),
  ])
  const paid = (paidTotal._sum.amountCents ?? 0) / 100
  const pending = (pendingTotal._sum.amountCents ?? 0) / 100

  return (
    <div className="space-y-8">
      <header className="border-y border-[#586055] bg-[#111511] p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#d8ff16]">Artist HQ / payouts</p>
        <h1 className="mt-2 text-5xl">Fan support records.</h1>
        <p className="mt-4 max-w-xl text-[#c7cec5]">Review recorded fan contributions and open your Stripe account. These totals are not your available Stripe balance or confirmation of a bank payout.</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {artist.stripeOnboarded
            ? <a href="/api/stripe/dashboard" className="border border-[#d8ff16] px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-[#d8ff16] hover:bg-[#d8ff16] hover:text-black">Open Stripe dashboard</a>
            : <ConnectPayoutsButton />}
          <Link href="/artist-hq" className="border border-[#586055] px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-[#aeb8ab] hover:border-[#d8ff16] hover:text-[#d8ff16]">Back to Artist HQ</Link>
        </div>
      </header>

      <section className="grid gap-px border border-[#495346] bg-[#495346] grid-cols-2 md:grid-cols-3">
        <div className="bg-[#0d100d] p-4"><div className="text-2xl font-bold text-[#d8ff16]">${paid.toFixed(2)}</div><div className="mt-1 text-xs uppercase tracking-[0.08em] text-[#aeb8ab]">Recorded contributions</div></div>
        <div className="bg-[#0d100d] p-4"><div className="text-2xl font-bold text-white">${pending.toFixed(2)}</div><div className="mt-1 text-xs uppercase tracking-[0.08em] text-[#aeb8ab]">Pending records</div></div>
        <div className="bg-[#0d100d] p-4"><div className="text-2xl font-bold text-white">{compact(paidCount)}</div><div className="mt-1 text-xs uppercase tracking-[0.08em] text-[#aeb8ab]">Contributions</div></div>
      </section>
      <p className="text-xs text-[#9ea59f]">Contribution totals are gross checkout records. Pending records may include unfinished checkouts; use Stripe to confirm settlement, refunds, and payouts.</p>

      {!artist.stripeOnboarded && <div className="border-l-4 border-l-[#ff5a36] bg-[#151a15] p-4"><p className="text-sm text-[#dce2d9]">Connect a Stripe payout account to receive fan support directly. Until then, fans can&apos;t send contributions to your tracks.</p></div>}

      <section>
        <h2 className="text-2xl">Recent contributions</h2>
        <div className="mt-3 divide-y divide-[#364035] border-y border-[#364035]">
          {recent.map(item => <div key={item.id} className="flex items-center justify-between py-3 text-sm"><Link href={`/t/${item.track.id}`} className="text-[#e0e5dd] hover:text-[#d8ff16]">{item.track.title}</Link><b className="text-[#d8ff16]">${(item.amountCents / 100).toFixed(2)}</b></div>)}
          {!recent.length && <p className="py-8 text-sm text-[#9ea59f]">Fan contributions to your tracks will show up here.</p>}
        </div>
      </section>
    </div>
  )
}
