import Link from 'next/link'
import { getArtist } from '@/lib/artist'
import { db } from '@/lib/db'
import { compact } from '@/lib/format'
import ConnectPayoutsButton from '@/components/ConnectPayoutsButton'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Artist HQ', robots: { index: false } }

export default async function ArtistHQ() {
  const artist = await getArtist()
  if (!artist) return <div className="border border-[#586055] bg-[#111511] p-6"><h1 className="text-4xl">Artist HQ</h1><p className="mt-3 text-[#c7cec5]">Connect SoundCloud or sign in to see your private artist data.</p><Link href="/move" className="mt-5 inline-block bg-[#d8ff16] px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-black">Connect SoundCloud</Link></div>

  const [totals, likes, reposts, comments, followers, earnings, recentComments, notifications] = await Promise.all([
    db.track.aggregate({ where: { userId: artist.id }, _sum: { plays: true, scPlays: true } }),
    db.like.count({ where: { track: { userId: artist.id } } }),
    db.repost.count({ where: { track: { userId: artist.id } } }),
    db.timedComment.count({ where: { track: { userId: artist.id } } }),
    db.follow.count({ where: { artistId: artist.id } }),
    db.contribution.aggregate({ where: { artistId: artist.id, status: 'paid' }, _sum: { amountCents: true } }),
    db.timedComment.findMany({ where: { track: { userId: artist.id } }, orderBy: { createdAt: 'desc' }, take: 8, include: { track: { select: { title: true, id: true } } } }),
    db.notification.findMany({ where: { userId: artist.id }, orderBy: { createdAt: 'desc' }, take: 8 }),
  ])
  const stats = [
    ['Total plays', (totals._sum.plays ?? 0) + (totals._sum.scPlays ?? 0)], ['SolidSoundZ plays', totals._sum.plays ?? 0], ['SoundCloud plays', totals._sum.scPlays ?? 0],
    ['Likes', likes], ['Reposts', reposts], ['Followers', followers], ['Comments', comments], ['Fan support', `$${((earnings._sum.amountCents ?? 0) / 100).toFixed(2)}`],
  ]
  return <div className="space-y-8">
    <header className="border-y border-[#586055] bg-[#111511] p-6"><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#d8ff16]">Artist HQ / private</p><h1 className="mt-2 text-5xl">Your signal. Your money.</h1><p className="mt-3 text-[#c7cec5]">Review catalog activity, recorded fan contributions, and payout setup in one place. Check Stripe for your available balance and bank-payout status.</p><div className="mt-5">{artist.stripeOnboarded ? <span className="text-sm text-[#d8ff16]">Payouts connected</span> : <ConnectPayoutsButton />}</div></header>
    <section className="grid gap-px border border-[#495346] bg-[#495346] grid-cols-2 md:grid-cols-4">{stats.map(([label, value]) => <div key={label} className="bg-[#0d100d] p-4"><div className="text-2xl font-bold text-[#d8ff16]">{typeof value === 'number' ? compact(value) : value}</div><div className="mt-1 text-xs uppercase tracking-[0.08em] text-[#aeb8ab]">{label}</div></div>)}</section>
    <div className="grid gap-8 lg:grid-cols-2"><section><h2 className="text-3xl">Recent comments</h2><div className="mt-3 divide-y divide-[#364035] border-y border-[#364035]">{recentComments.map(comment => <div key={comment.id} className="py-3"><div className="text-sm"><b>{comment.name}</b> on <Link href={`/t/${comment.track.id}`} className="text-[#d8ff16]">{comment.track.title}</Link></div><p className="mt-1 text-sm text-[#c7cec5]">{comment.text}</p></div>)}{!recentComments.length && <p className="py-5 text-sm text-[#9ea59f]">New comments from listeners will appear here.</p>}</div></section><section><div className="flex items-center justify-between"><h2 className="text-3xl">Notifications</h2><Link href="/earnings" className="text-xs font-bold uppercase tracking-[0.1em] text-[#d8ff16]">Payouts</Link></div><div className="mt-3 divide-y divide-[#364035] border-y border-[#364035]">{notifications.map(note => <p key={note.id} className="py-3 text-sm text-[#c7cec5]">{note.message}</p>)}{!notifications.length && <p className="py-5 text-sm text-[#9ea59f]">Likes, reposts, comments, follows, and contributions will appear here.</p>}</div></section></div>
  </div>
}