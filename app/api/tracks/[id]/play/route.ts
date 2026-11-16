import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { currentAccount } from '@/lib/account'

const DEDUPE_MINUTES = 30

// Counts at most one play per listener per track every 30 minutes.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const track = await db.track.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!track) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'local'
  const visitor = createHash('sha256').update(`${process.env.PLAY_SALT ?? ''}|${ip}|${req.headers.get('user-agent') ?? ''}`).digest('hex').slice(0, 32)

  const recent = await db.playEvent.findFirst({
    where: { trackId: track.id, visitor, createdAt: { gte: new Date(Date.now() - DEDUPE_MINUTES * 60_000) } },
    select: { id: true },
  })
  if (recent) {
    const t = await db.track.findUnique({ where: { id: track.id }, select: { plays: true } })
    return NextResponse.json({ counted: false, plays: t?.plays ?? 0 })
  }

  const account = await currentAccount()
  if (account) await db.listeningHistory.upsert({ where: { userId_trackId: { userId: account.id, trackId: track.id } }, update: { playCount: { increment: 1 }, lastPlayedAt: new Date() }, create: { userId: account.id, trackId: track.id } })

  const [, updated] = await db.$transaction([
    db.playEvent.create({ data: { trackId: track.id, visitor } }),
    db.track.update({ where: { id: track.id }, data: { plays: { increment: 1 } }, select: { plays: true } }),
  ])
  return NextResponse.json({ counted: true, plays: updated.plays })
}
