import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getArtist } from '@/lib/artist'
import { GENRES } from '@/lib/genres'
import { parseMusicLink } from '@/lib/musicLinks'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const artist = await getArtist()
  if (!artist) return NextResponse.json({ error: 'sign in required' }, { status: 401 })
  const track = await db.track.findUnique({ where: { id: params.id }, select: { userId: true, s3Key: true } })
  if (!track) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (track.userId !== artist.id) return NextResponse.json({ error: 'not your track' }, { status: 403 })

  const body: unknown = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'invalid track update' }, { status: 400 })
  const data: Prisma.TrackUpdateInput = {}
  if ('title' in body && typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim().slice(0, 120)
  if ('description' in body && typeof body.description === 'string') data.description = body.description.trim().slice(0, 2000) || null
  if ('genre' in body && typeof body.genre === 'string') data.genre = GENRES.includes(body.genre) ? body.genre : null
  if ('downloadable' in body && typeof body.downloadable === 'boolean') data.downloadable = body.downloadable
  try {
    if ('appleMusicUrl' in body) data.appleMusicUrl = parseMusicLink(body.appleMusicUrl, 'appleMusic')
    if ('spotifyUrl' in body) data.spotifyUrl = parseMusicLink(body.spotifyUrl, 'spotify')
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'invalid music service link' }, { status: 400 })
  }
  if ('published' in body && typeof body.published === 'boolean') {
    if (body.published && track.s3Key.startsWith('soundcloud/')) return NextResponse.json({ error: 'upload an audio file before release' }, { status: 400 })
    data.published = body.published; data.publishedAt = body.published ? new Date() : null
    if (body.published) data.scheduledFor = null
  }
  if ('scheduledFor' in body) {
    if (body.scheduledFor === null) data.scheduledFor = null
    else {
      if (track.s3Key.startsWith('soundcloud/')) return NextResponse.json({ error: 'upload an audio file before scheduling' }, { status: 400 })
      const at = new Date(String(body.scheduledFor))
      if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) return NextResponse.json({ error: 'schedule a time in the future' }, { status: 400 })
      data.scheduledFor = at
      data.published = false
    }
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })

  await db.track.update({ where: { id: params.id }, data })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const artist = await getArtist()
  if (!artist) return NextResponse.json({ error: 'sign in required' }, { status: 401 })
  const track = await db.track.findUnique({ where: { id: params.id }, select: { userId: true } })
  if (!track) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (track.userId !== artist.id) return NextResponse.json({ error: 'not your track' }, { status: 403 })
  await db.track.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
