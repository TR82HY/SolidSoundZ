import { NextResponse } from 'next/server'

const ALLOWED_HOSTS = new Set(['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com', 'on.soundcloud.com'])

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('url') ?? ''
  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 })
  }
  if (raw.length > 500 || target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
    return NextResponse.json({ error: 'only soundcloud.com links are supported' }, { status: 400 })
  }

  try {
    const res = await fetch(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(target.toString())}`, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86400 },
    })
    if (!res.ok) return NextResponse.json({ error: 'track not found or private' }, { status: 404 })
    const d = await res.json()
    const artist = String(d.author_name ?? '')
    const title = String(d.title ?? '').replace(new RegExp(`\\s+by\\s+${artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '')
    return NextResponse.json({ title, artist, artwork: d.thumbnail_url ?? null, url: target.toString() })
  } catch {
    return NextResponse.json({ error: 'soundcloud did not respond' }, { status: 502 })
  }
}
