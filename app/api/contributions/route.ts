import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || key.includes('placeholder')) return NextResponse.json({ error: 'fan contributions are not configured yet' }, { status: 503 })
  const { trackId, amount } = await request.json().catch(() => ({})) as { trackId?: unknown, amount?: unknown }
  const cents = Math.min(100_000, Math.max(100, Math.round(Number(amount) * 100)))
  if (typeof trackId !== 'string' || !Number.isFinite(cents)) return NextResponse.json({ error: 'invalid contribution' }, { status: 400 })
  const track = await db.track.findUnique({ where: { id: trackId }, include: { user: { select: { stripeAccountId: true, stripeOnboarded: true, handle: true } } } })
  if (!track?.user.stripeAccountId || !track.user.stripeOnboarded) return NextResponse.json({ error: 'this artist has not enabled contributions yet' }, { status: 409 })
  const contribution = await db.contribution.create({ data: { trackId: track.id, artistId: track.userId, amountCents: cents } })
  const stripe = new Stripe(key)
  const origin = new URL(request.url).origin
  const session = await stripe.checkout.sessions.create({ mode: 'payment', success_url: `${origin}/t/${track.id}?support=thanks`, cancel_url: `${origin}/t/${track.id}?support=cancel`, line_items: [{ price_data: { currency: 'usd', unit_amount: cents, product_data: { name: `Support ${track.user.handle}` } }, quantity: 1 }], payment_intent_data: { transfer_data: { destination: track.user.stripeAccountId }, metadata: { contributionId: contribution.id, trackId: track.id } }, metadata: { contributionId: contribution.id, type: 'contribution' } })
  await db.contribution.update({ where: { id: contribution.id }, data: { stripeSessionId: session.id } })
  return NextResponse.json({ url: session.url })
}