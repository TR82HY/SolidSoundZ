import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { currentAccount } from '@/lib/account'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const track = await db.track.findUnique({ where: { id: params.id }, select: { id: true, duration: true, userId: true, title: true } })
  if (!track) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const body = await req.json().catch(() => null) as { text?: unknown, name?: unknown, t?: unknown } | null
  const text = String(body?.text ?? '').trim().slice(0, 300)
  const account = await currentAccount()
  const name = account?.handle ?? (String(body?.name ?? '').trim().slice(0, 40) || 'Listener')
  const t = Math.max(0, Math.min(Number(body?.t) || 0, track.duration || 86_400))
  if (!text) return NextResponse.json({ error: 'comment is empty' }, { status: 400 })

  const comment = await db.timedComment.create({
    data: { trackId: track.id, userId: account?.id, text, name, timestampMs: Math.round(t * 1000) },
    select: { id: true, userId: true, text: true, name: true, timestampMs: true, createdAt: true, user: { select: { handle: true, slug: true } } },
  })
  if (account?.id !== track.userId) await db.notification.create({ data: { userId: track.userId, trackId: track.id, type: 'comment', message: `${name} commented on ${track.title}` } })
  return NextResponse.json(comment)
}
