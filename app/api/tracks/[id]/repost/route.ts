import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { listenerId } from '@/lib/listener'
import { currentAccount } from '@/lib/account'

// POST toggles a repost of this track for the current listener.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const track = await db.track.findUnique({ where: { id: params.id }, select: { id: true, userId: true, title: true } })
  if (!track) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const account = await currentAccount()
  const listener = account?.id ?? listenerId(true)
  const where = { trackId_listener: { trackId: track.id, listener } }
  const existing = await db.repost.findUnique({ where, select: { id: true } })
  if (existing) await db.repost.delete({ where })
  else {
    await db.repost.create({ data: { trackId: track.id, listener } })
    if (account?.id !== track.userId) await db.notification.create({ data: { userId: track.userId, trackId: track.id, type: 'repost', message: `New repost of ${track.title}` } })
  }
  const reposts = await db.repost.count({ where: { trackId: track.id } })
  return NextResponse.json({ reposted: !existing, reposts })
}
