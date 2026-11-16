import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { listenerId } from '@/lib/listener'
import { currentAccount } from '@/lib/account'

// POST toggles the like for this listener and returns the new state.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const track = await db.track.findUnique({ where: { id: params.id }, select: { id: true, userId: true, title: true } })
  if (!track) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const account = await currentAccount()
  const listener = account?.id ?? listenerId(true)
  const where = { trackId_listener: { trackId: track.id, listener } }
  const existing = await db.like.findUnique({ where, select: { id: true } })
  if (existing) await db.like.delete({ where })
  else {
    await db.like.create({ data: { trackId: track.id, listener } })
    if (account?.id !== track.userId) await db.notification.create({ data: { userId: track.userId, trackId: track.id, type: 'like', message: `New like on ${track.title}` } })
  }
  const likes = await db.like.count({ where: { trackId: track.id } })
  return NextResponse.json({ liked: !existing, likes })
}
