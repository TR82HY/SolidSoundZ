import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getArtist } from '@/lib/artist'
import { imageTypeForKey, localFile, r2Configured, streamFile } from '@/lib/storage'

export async function GET(req: Request, { params }: { params: { key: string[] } }) {
  const key = params.key.join('/')
  const isArt = key.startsWith('art/')
  const track = await db.track.findFirst({ where: isArt ? { artKey: key } : { s3Key: key }, select: { contentType: true, userId: true, published: true } })
  if (!track) return new NextResponse('not found', { status: 404 })
  if (!track.published && (await getArtist())?.id !== track.userId) return new NextResponse('not found', { status: 404 })

  if (r2Configured()) return NextResponse.redirect(`${process.env.R2_PUBLIC_URL}/${key}`)

  const f = await localFile(key)
  if (!f) return new NextResponse('not found', { status: 404 })

  const headers: Record<string, string> = { 'Content-Type': isArt ? imageTypeForKey(key) : track.contentType, 'Accept-Ranges': 'bytes', 'Cache-Control': track.published ? 'public, max-age=3600' : 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
  const range = req.headers.get('range')?.match(/^bytes=(\d*)-(\d*)$/)
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, f.size - Number(range[2]))
    const end = range[1] && range[2] ? Math.min(Number(range[2]), f.size - 1) : f.size - 1
    if (start >= f.size || start > end) return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${f.size}` } })
    return new NextResponse(streamFile(f.file, start, end), {
      status: 206,
      headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${f.size}`, 'Content-Length': String(end - start + 1) },
    })
  }
  return new NextResponse(streamFile(f.file), { headers: { ...headers, 'Content-Length': String(f.size) } })
}
