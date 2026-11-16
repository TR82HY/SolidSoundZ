import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { localFile, r2Configured, streamFile } from '@/lib/storage'

const safe = (s: string) => s.replace(/[^\w.-]/g, '_').slice(0, 100)

// Forces a real download (Content-Disposition) so it works even for cross-origin Blob/R2 URLs.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const t = await db.track.findUnique({ where: { id: params.id }, select: { title: true, s3Key: true, audioHref: true, contentType: true, downloadable: true } })
  if (!t || !t.downloadable) return new NextResponse('not found', { status: 404 })

  const ext = t.s3Key.split('.').pop() || 'mp3'
  const filename = `${safe(t.title)}.${ext}`

  let buf: Uint8Array<ArrayBuffer>
  if (t.audioHref) {
    const res = await fetch(t.audioHref)
    if (!res.ok) return new NextResponse('not found', { status: 404 })
    buf = new Uint8Array(await res.arrayBuffer())
  } else if (r2Configured()) {
    return NextResponse.redirect(`${process.env.R2_PUBLIC_URL}/${t.s3Key}`)
  } else {
    const f = await localFile(t.s3Key)
    if (!f) return new NextResponse('not found', { status: 404 })
    const chunks: Uint8Array[] = []
    for await (const chunk of streamFile(f.file) as unknown as AsyncIterable<Uint8Array>) chunks.push(chunk)
    buf = new Uint8Array(Buffer.concat(chunks))
  }
  return new NextResponse(new Blob([buf]), { headers: { 'Content-Type': t.contentType, 'Content-Disposition': `attachment; filename="${filename}"` } })
}
