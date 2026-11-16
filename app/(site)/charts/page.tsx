import Link from 'next/link'
import { listTracks, trendingTracks } from '@/lib/queries'
import { TrackList } from '@/components/TrackCard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Charts', description: 'Discover the tracks moving on SolidSoundZ right now.' }

export default async function ChartsPage() {
  const [weekly, allTime] = await Promise.all([trendingTracks(30), listTracks({}, { plays: 'desc' }, 30)])
  return <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1fr)_280px]"><div className="min-w-0 space-y-10"><section className="min-w-0 border-y border-[#586055] bg-[#111511] p-6"><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#d8ff16]">SolidSoundZ discovery</p><h1 className="mt-2 text-5xl">Charts</h1><p className="mt-3 max-w-xl text-[#c7cec5]">The tracks listeners are finding, replaying, and carrying forward.</p></section><section className="min-w-0"><h2 className="flex items-center gap-3 text-3xl mb-3"><span className="font-mono text-xs text-[#d8ff16]">01</span> Moving this week</h2><TrackList tracks={weekly} empty="Charts will fill as listeners play new music." /></section><section className="min-w-0"><h2 className="flex items-center gap-3 text-3xl mb-3"><span className="font-mono text-xs text-[#d8ff16]">02</span> All-time plays</h2><TrackList tracks={allTime} empty="No all-time chart entries yet." /></section></div><aside className="min-w-0 border-t border-[#586055] pt-5 lg:border-l lg:border-t-0 lg:pl-5"><h2 className="text-2xl text-[#d8ff16]">Get on the chart</h2><p className="mt-3 text-sm text-[#c7cec5]">Release a finished master, share it, and keep the catalog moving.</p><Link href="/upload" className="mt-5 inline-block bg-[#d8ff16] px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-black">Upload a track</Link></aside></div>
}