import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTrackCard, trendingTracks } from '@/lib/queries'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Picks what to autoplay after a track: same-genre trending first, then anything trending, skipping recently played ids.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const after = params.get('after') ?? ''
  const skip = new Set([after, ...(params.get('skip') ?? '').split(',')].filter(id => /^[\w-]{1,40}$/.test(id)).slice(0, 100))
  const current = after ? await db.track.findUnique({ where: { id: after }, select: { genre: true } }) : null

  const pool = await trendingTracks(60)
  const fresh = pool.filter(t => !skip.has(t.id))
  const pick = fresh.find(t => current?.genre && t.genre === current.genre) ?? fresh[0]
  if (pick) return NextResponse.json({ track: pick })

  // Everything has been heard: fall back to a random track other than the one that just ended.
  const visible = { id: { not: after }, published: true, user: { profileClaimed: true } }
  const count = await db.track.count({ where: visible })
  if (!count) return NextResponse.json({ track: null })
  const [row] = await db.track.findMany({ where: visible, skip: Math.floor(Math.random() * count), take: 1, select: { id: true } })
  return NextResponse.json({ track: row ? await getTrackCard(row.id) : null })
}
