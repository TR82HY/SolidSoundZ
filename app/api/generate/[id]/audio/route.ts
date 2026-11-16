import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getArtist } from '@/lib/artist'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const artist = await getArtist()
  if (!artist) return new NextResponse('sign in required', { status: 401 })
  const generation = await db.generation.findFirst({ where: { id: params.id, userId: artist.id }, select: { status: true, outputUrl: true } })
  if (!generation?.outputUrl || generation.status !== 'succeeded') return new NextResponse('audio not ready', { status: 404 })

  try {
    const source = await fetch(generation.outputUrl)
    if (!source.ok || !source.body) return new NextResponse('audio unavailable', { status: 502 })
    return new NextResponse(source.body, { headers: { 'Content-Type': source.headers.get('content-type') ?? 'audio/mpeg', 'Cache-Control': 'private, max-age=300' } })
  } catch {
    return new NextResponse('audio unavailable', { status: 502 })
  }
}