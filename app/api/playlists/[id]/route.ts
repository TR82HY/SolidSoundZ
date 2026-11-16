import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getArtist } from '@/lib/artist'

async function assertOwner(id: string) {
  const artist = await getArtist()
  if (!artist) return { error: NextResponse.json({ error: 'sign in required' }, { status: 401 }) }
  const playlist = await db.playlist.findUnique({ where: { id }, select: { userId: true } })
  if (!playlist) return { error: NextResponse.json({ error: 'not found' }, { status: 404 }) }
  if (playlist.userId !== artist.id) return { error: NextResponse.json({ error: 'not your playlist' }, { status: 403 }) }
  return { artist }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { error } = await assertOwner(params.id)
  if (error) return error
  const body = await req.json().catch(() => ({})) as { title?: unknown, description?: unknown }
  const data: Record<string, unknown> = {}
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim().slice(0, 120)
  if (typeof body.description === 'string') data.description = body.description.trim().slice(0, 2000) || null
  if (!Object.keys(data).length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  await db.playlist.update({ where: { id: params.id }, data })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { error } = await assertOwner(params.id)
  if (error) return error
  await db.playlist.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
