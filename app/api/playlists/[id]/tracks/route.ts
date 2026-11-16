import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getArtist } from '@/lib/artist'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const artist = await getArtist()
  if (!artist) return NextResponse.json({ error: 'sign in required' }, { status: 401 })
  const playlist = await db.playlist.findUnique({ where: { id: params.id }, select: { userId: true } })
  if (!playlist) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (playlist.userId !== artist.id) return NextResponse.json({ error: 'not your playlist' }, { status: 403 })

  const { trackId } = await req.json().catch(() => ({})) as { trackId?: unknown }
  if (typeof trackId !== 'string') return NextResponse.json({ error: 'trackId required' }, { status: 400 })
  const track = await db.track.findUnique({ where: { id: trackId }, select: { id: true } })
  if (!track) return NextResponse.json({ error: 'track not found' }, { status: 404 })

  const existing = await db.playlistTrack.findUnique({ where: { playlistId_trackId: { playlistId: params.id, trackId } } })
  if (existing) return NextResponse.json({ ok: true, alreadyAdded: true })

  const last = await db.playlistTrack.findFirst({ where: { playlistId: params.id }, orderBy: { position: 'desc' }, select: { position: true } })
  await db.playlistTrack.create({ data: { playlistId: params.id, trackId, position: (last?.position ?? -1) + 1 } })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const artist = await getArtist()
  if (!artist) return NextResponse.json({ error: 'sign in required' }, { status: 401 })
  const playlist = await db.playlist.findUnique({ where: { id: params.id }, select: { userId: true } })
  if (!playlist) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (playlist.userId !== artist.id) return NextResponse.json({ error: 'not your playlist' }, { status: 403 })

  const trackId = new URL(req.url).searchParams.get('trackId')
  if (!trackId) return NextResponse.json({ error: 'trackId required' }, { status: 400 })
  await db.playlistTrack.deleteMany({ where: { playlistId: params.id, trackId } })
  return NextResponse.json({ ok: true })
}
