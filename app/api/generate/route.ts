import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getArtist } from '@/lib/artist'
import { hasProAccess, isSiteAdmin } from '@/lib/access'

const REPLICATE_API = 'https://api.replicate.com/v1'
const DEFAULT_MODEL = 'stability-ai/stable-audio-open-1.0'
const PRO_GENERATIONS_PER_MONTH = 10

type ReplicatePrediction = {
  id: string
  status: string
  output?: string | string[] | null
  error?: string | null
}

const outputUrl = (prediction: ReplicatePrediction) => Array.isArray(prediction.output) ? prediction.output[0] ?? null : prediction.output ?? null

function response(generation: { id: string, prompt: string, lyrics: string | null, style: string | null, genre: string | null, mood: string | null, bpm: number | null, duration: number, weirdness: number, influence: number, instrumental: boolean, status: string, outputUrl: string | null, error: string | null, createdAt: Date }) {
  return { ...generation, createdAt: generation.createdAt.toISOString() }
}

async function syncGeneration(id: string, providerId: string) {
  const token = process.env.REPLICATE_API_TOKEN
  if (!token) return null
  const remote = await fetch(`${REPLICATE_API}/predictions/${providerId}`, { headers: { Authorization: `Token ${token}` }, cache: 'no-store' })
  if (!remote.ok) throw new Error('generation status unavailable')
  const prediction = await remote.json() as ReplicatePrediction
  const status = prediction.status === 'succeeded' ? 'succeeded' : prediction.status === 'failed' || prediction.status === 'canceled' ? 'failed' : 'processing'
  return db.generation.update({ where: { id }, data: { status, outputUrl: outputUrl(prediction), error: prediction.error?.slice(0, 500) ?? null } })
}

export async function POST(request: Request) {
  const artist = await getArtist()
  if (!artist) return NextResponse.json({ error: 'sign in required' }, { status: 401 })
  if (!hasProAccess(artist)) return NextResponse.json({ error: 'Creator is included with SolidSoundZ Pro.', code: 'pro_required' }, { status: 402 })
  const periodStart = new Date(Date.now() - 30 * 86_400_000)
  const used = await db.generation.count({ where: { userId: artist.id, createdAt: { gte: periodStart }, status: { in: ['queued', 'processing', 'succeeded'] } } })
  if (used >= PRO_GENERATIONS_PER_MONTH) return NextResponse.json({ error: 'Your 10 included Creator previews are used for this month.', code: 'limit_reached' }, { status: 429 })
  const token = process.env.REPLICATE_API_TOKEN
  if (!token) return NextResponse.json({ error: 'music generation is not configured yet' }, { status: 503 })

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const prompt = String(body.prompt ?? '').trim().slice(0, 500)
  const lyrics = String(body.lyrics ?? '').trim().slice(0, 4000) || null
  const style = String(body.style ?? '').trim().slice(0, 300) || null
  const genre = String(body.genre ?? '').trim().slice(0, 60) || null
  const mood = String(body.mood ?? '').trim().slice(0, 60) || null
  const bpm = Math.min(200, Math.max(50, Math.round(Number(body.bpm) || 120)))
  const duration = Math.min(47, Math.max(10, Math.round(Number(body.duration) || 30)))
  const weirdness = Math.min(100, Math.max(0, Math.round(Number(body.weirdness) || 50)))
  const influence = Math.min(100, Math.max(0, Math.round(Number(body.influence) || 50)))
  const instrumental = body.instrumental !== false
  if (prompt.length < 8) return NextResponse.json({ error: 'describe the track in at least 8 characters' }, { status: 400 })
  if (!instrumental && !lyrics) return NextResponse.json({ error: 'add lyrics or switch back to instrumental mode' }, { status: 400 })

  const generation = await db.generation.create({ data: { userId: artist.id, prompt, lyrics, style, genre, mood, bpm, duration, weirdness, influence, instrumental, status: 'queued' } })
  const fullPrompt = [prompt, style && `style direction: ${style}`, genre && `${genre} style`, mood && `${mood} mood`, `${bpm} BPM`, weirdness > 65 ? 'experimental and unpredictable sound design' : weirdness < 35 ? 'focused, cohesive arrangement' : 'balanced familiar and unexpected elements', instrumental ? 'instrumental, no vocals' : `lead vocals with these lyrics: ${lyrics}`].filter(Boolean).join(', ')
  try {
    const remote = await fetch(`${REPLICATE_API}/models/${process.env.REPLICATE_MODEL ?? DEFAULT_MODEL}/predictions`, {
      method: 'POST',
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { prompt: fullPrompt, seconds: duration, steps: 100, cfg_scale: 3 + influence * 0.09 } }),
    })
    if (!remote.ok) throw new Error('generation request was rejected')
    const prediction = await remote.json() as ReplicatePrediction
    const saved = await db.generation.update({ where: { id: generation.id }, data: { providerId: prediction.id, status: prediction.status === 'succeeded' ? 'succeeded' : 'processing', outputUrl: outputUrl(prediction), error: prediction.error?.slice(0, 500) ?? null } })
    return NextResponse.json(response(saved), { status: 201 })
  } catch (error) {
    const saved = await db.generation.update({ where: { id: generation.id }, data: { status: 'failed', error: error instanceof Error ? error.message : 'generation failed' } })
    return NextResponse.json(response(saved), { status: 502 })
  }
}

export async function GET(request: Request) {
  const artist = await getArtist()
  if (!artist) return NextResponse.json({ error: 'sign in required' }, { status: 401 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) {
    const generations = await db.generation.findMany({ where: { userId: artist.id }, orderBy: { createdAt: 'desc' }, take: 20 })
    const periodStart = new Date(Date.now() - 30 * 86_400_000)
    const used = await db.generation.count({ where: { userId: artist.id, createdAt: { gte: periodStart }, status: { in: ['queued', 'processing', 'succeeded'] } } })
    return NextResponse.json({
      generations: generations.map(response), plan: hasProAccess(artist) ? 'pro' : 'free',
      isAdmin: isSiteAdmin(artist), limit: PRO_GENERATIONS_PER_MONTH,
      remaining: hasProAccess(artist) ? Math.max(0, PRO_GENERATIONS_PER_MONTH - used) : 0,
    })
  }
  let generation = await db.generation.findFirst({ where: { id, userId: artist.id } })
  if (!generation) return NextResponse.json({ error: 'generation not found' }, { status: 404 })
  if ((generation.status === 'queued' || generation.status === 'processing') && generation.providerId) {
    try { generation = await syncGeneration(generation.id, generation.providerId) ?? generation } catch { /* retain the most recent saved status */ }
  }
  return NextResponse.json(response(generation))
}