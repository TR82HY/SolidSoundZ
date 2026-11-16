import Link from 'next/link'
import { getArtist } from '@/lib/artist'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Notifications', robots: { index: false } }

export default async function NotificationsPage() {
  const artist = await getArtist()
  if (!artist) return <div className="border border-[#586055] bg-[#111511] p-6"><h1 className="text-4xl">Notifications</h1><p className="mt-3 text-[#c7cec5]">Sign in to see activity for your catalog.</p><Link href="/sign-in" className="mt-5 inline-block bg-[#d8ff16] px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-black">Sign in</Link></div>
  const notifications = await db.notification.findMany({ where: { userId: artist.id }, orderBy: { createdAt: 'desc' }, take: 100 })
  await db.notification.updateMany({ where: { userId: artist.id, readAt: null }, data: { readAt: new Date() } })
  return <div><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#d8ff16]">Artist activity</p><h1 className="mt-2 text-5xl">Notifications</h1><div className="mt-6 divide-y divide-[#394139] border-y border-[#394139]">{notifications.map(note => <div key={note.id} className="flex gap-4 py-4"><span className="mt-1 h-2 w-2 flex-none bg-[#d8ff16]" /><div><p className="text-sm text-[#e0e5dd]">{note.message}</p><p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#9ea59f]">{note.createdAt.toLocaleString()}</p></div></div>)}{!notifications.length && <p className="py-8 text-sm text-[#9ea59f]">New likes, reposts, comments, fan support, and follows will show up here.</p>}</div></div>
}