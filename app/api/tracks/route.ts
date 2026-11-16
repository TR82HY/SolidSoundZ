import { NextResponse } from 'next/server'
import { head } from '@vercel/blob'
import { db } from '@/lib/db'
import { getArtist } from '@/lib/artist'
import { BLOB_URL, IMAGE_TYPES, audioUrl, blobConfigured, saveFile } from '@/lib/storage'
import { GENRES } from '@/lib/genres'

const MAX_AUDIO = 300 * 1024 * 1024
const MAX_ART = 5 * 1024 * 1024
const SC_URL = /^https:\/\/(www\.|m\.|on\.)?soundcloud\.com\/[^\s]{1,300}$/i
const SC_ART = /^https:\/\/i\d?\.sndcdn\.com\/[\w\-./]+\.(jpg|jpeg|png)$/i

const safeName = (n: string) => n.replace(/[^\w.-]/g, '_').slice(-80)

function parsePeaks(raw: FormDataEntryValue | null) {
  try {
    const arr = JSON.parse(String(raw ?? ''))
    if (!Array.isArray(arr) || arr.length > 400) return null
    return JSON.stringify(arr.map(v => Math.round(Math.min(1, Math.max(0, Number(v) || 0)) * 1000) / 1000))
  } catch {
    return null
  }
}

async function fetchSoundCloudArt(url: string) {
  if (!SC_ART.test(url)) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const type = res.headers.get('content-type')?.split(';')[0] ?? ''
    if (!res.ok || !IMAGE_TYPES[type]) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return buf.length <= MAX_ART ? { buf, type } : null
  } catch {
    return null
  }
}

export async function GET() {
  const artist = await getArtist()
  if (!artist) return NextResponse.json({ error: 'sign in required' }, { status: 401 })
  const tracks = await db.track.findMany({
    where: { userId: artist.id }, orderBy: { createdAt: 'desc' }, take: 200,
    select: { id: true, title: true, duration: true, audioHref: true, s3Key: true },
  })
  return NextResponse.json({ tracks: tracks.map(t => ({ ...t, audioUrl: t.audioHref ?? audioUrl(t.s3Key) })) })
}

// Confirms a browser-uploaded file really is in our Blob store and has the expected type/size.
async function verifyBlob(url: string, kind: 'audio' | 'image', max: number) {
  if (!BLOB_URL.test(url)) return null
  try {
    const info = await head(url)
    const okType = kind === 'audio' ? info.contentType.startsWith('audio/') : !!IMAGE_TYPES[info.contentType]
    return okType && info.size <= max ? info : null
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const artist = await getArtist()
  if (!artist) return NextResponse.json({ error: 'sign in required' }, { status: 401 })

  const form = await req.formData()
  const importedTrackId = String(form.get('importedTrackId') ?? '')
  const pending = importedTrackId ? await db.track.findFirst({ where: { id: importedTrackId, userId: artist.id, s3Key: { startsWith: 'soundcloud/' }, published: false } }) : null
  if (importedTrackId && !pending) return NextResponse.json({ error: 'pending SoundCloud track not found' }, { status: 404 })
  const stamp = Date.now()
  let s3Key: string, contentType: string, audioHref: string | null = null, fileName: string

  if (blobConfigured()) {
    const info = await verifyBlob(String(form.get('audioUrl') ?? ''), 'audio', MAX_AUDIO)
    if (!info) return NextResponse.json({ error: 'upload the audio file first' }, { status: 400 })
    s3Key = info.pathname; contentType = info.contentType; audioHref = info.url; fileName = info.pathname.split('/').pop() ?? 'track'
  } else {
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'no file' }, { status: 400 })
    if (!file.type.startsWith('audio/')) return NextResponse.json({ error: 'audio files only' }, { status: 415 })
    if (file.size > MAX_AUDIO) return NextResponse.json({ error: 'file too large (300 MB max)' }, { status: 413 })
    s3Key = `tracks/${stamp}-${safeName(file.name)}`; contentType = file.type; fileName = file.name
    await saveFile(s3Key, Buffer.from(await file.arrayBuffer()), file.type)
  }

  const title = String(form.get('title') ?? '').trim().slice(0, 120) || fileName.replace(/\.[^.]+$/, '')
  const genreRaw = String(form.get('genre') ?? '')
  const genre = GENRES.includes(genreRaw) ? genreRaw : null
  const description = String(form.get('description') ?? '').trim().slice(0, 2000) || null
  const duration = Math.max(0, Number(form.get('duration')) || 0)
  const scUrlRaw = String(form.get('scUrl') ?? '').trim()
  const scUrl = SC_URL.test(scUrlRaw) ? scUrlRaw : null
  const scPlays = Math.min(Math.max(0, Math.floor(Number(form.get('scPlays')) || 0)), 10_000_000_000)
  const waveformJson = parsePeaks(form.get('peaks'))
  const published = String(form.get('published') ?? 'true') !== 'false'

  let artKey: string | null = null, artHref: string | null = null
  const artFile = form.get('art')
  const artUrlField = String(form.get('artUrl') ?? '')
  if (artUrlField && blobConfigured()) {
    const info = await verifyBlob(artUrlField, 'image', MAX_ART)
    if (!info) return NextResponse.json({ error: 'artwork upload not found' }, { status: 400 })
    artKey = info.pathname; artHref = info.url
  } else {
    let art: { buf: Buffer, type: string } | null = null
    if (artFile instanceof File && artFile.size > 0) {
      if (!IMAGE_TYPES[artFile.type]) return NextResponse.json({ error: 'artwork must be JPG, PNG or WEBP' }, { status: 415 })
      if (artFile.size > MAX_ART) return NextResponse.json({ error: 'artwork too large (5 MB max)' }, { status: 413 })
      art = { buf: Buffer.from(await artFile.arrayBuffer()), type: artFile.type }
    } else if (form.get('artFromUrl')) {
      art = await fetchSoundCloudArt(String(form.get('artFromUrl')))
    }
    if (art) {
      artKey = `art/${stamp}-${crypto.randomUUID().slice(0, 8)}.${IMAGE_TYPES[art.type]}`
      artHref = await saveFile(artKey, art.buf, art.type)
    }
  }

  const track = pending
    ? await db.track.update({ where: { id: pending.id }, data: { title, artKey: artKey ?? pending.artKey, artHref: artHref ?? pending.artHref, s3Key, audioHref, contentType, duration, waveformJson, published, publishedAt: published ? new Date() : null }, select: { id: true } })
    : await db.track.create({
      data: { userId: artist.id, title, genre, description, artKey, artHref, s3Key, audioHref, contentType, duration, scUrl, scPlays, waveformJson, published, publishedAt: published ? new Date() : null },
      select: { id: true },
    })
  return NextResponse.json({ id: track.id, url: `/t/${track.id}` })
}
