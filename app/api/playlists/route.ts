import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getArtist } from '@/lib/artist'

export async function GET() {
  const artist = await getArtist()
  if (!artist) return NextResponse.json({ error: 'sign in required' }, { status: 401 })
  const playlists = await db.playlist.findMany({
    where: { userId: artist.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, _count: { select: { tracks: true } } },
  })
  return NextResponse.json({ playlists })
}

export async function POST(req: Request) {
  const artist = await getArtist()
  if (!artist) return NextResponse.json({ error: 'sign in required' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { title?: unknown, trackId?: unknown }
  const title = String(body.title ?? '').trim().slice(0, 120)
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const trackId = typeof body.trackId === 'string' ? body.trackId : null
  if (trackId) {
    const track = await db.track.findUnique({ where: { id: trackId }, select: { id: true } })
    if (!track) return NextResponse.json({ error: 'track not found' }, { status: 404 })
  }
  const playlist = await db.playlist.create({
    data: { userId: artist.id, title, ...(trackId ? { tracks: { create: { trackId, position: 0 } } } : {}) },
    select: { id: true, title: true, _count: { select: { tracks: true } } },
  })
  return NextResponse.json({ playlist })
}
