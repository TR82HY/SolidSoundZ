import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { listenerId } from '@/lib/listener'
import { currentAccount } from '@/lib/account'

// POST toggles following this artist and returns the new state.
export async function POST(_req: Request, { params }: { params: { slug: string } }) {
  const artist = await db.user.findUnique({ where: { slug: params.slug }, select: { id: true } })
  if (!artist) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const account = await currentAccount()
  if (account?.id === artist.id) return NextResponse.json({ error: 'cannot follow your own profile' }, { status: 400 })
  const listener = account?.id ?? listenerId(true)
  const where = { artistId_listener: { artistId: artist.id, listener } }
  const existing = await db.follow.findUnique({ where, select: { id: true } })
  if (existing) await db.follow.delete({ where })
  else {
    await db.follow.create({ data: { artistId: artist.id, listener } })
    await db.notification.create({ data: { userId: artist.id, type: 'follow', message: 'You have a new follower' } })
  }
  const followers = await db.follow.count({ where: { artistId: artist.id } })
  return NextResponse.json({ following: !existing, followers })
}
