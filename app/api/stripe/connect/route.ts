import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getArtist } from '@/lib/artist'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  const artist = await getArtist()
  if (!artist) return NextResponse.json({ error: 'sign in required' }, { status: 401 })
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || key.includes('placeholder')) return NextResponse.json({ error: 'Stripe payouts are not configured yet' }, { status: 503 })
  const stripe = new Stripe(key)
  let accountId = artist.stripeAccountId
  if (!accountId) {
    const account = await stripe.accounts.create({ type: 'express', capabilities: { transfers: { requested: true } }, metadata: { solidSoundzArtistId: artist.id } })
    accountId = account.id
    await db.user.update({ where: { id: artist.id }, data: { stripeAccountId: accountId } })
  }
  const origin = new URL(request.url).origin
  const link = await stripe.accountLinks.create({ account: accountId, refresh_url: `${origin}/artist-hq?stripe=refresh`, return_url: `${origin}/artist-hq?stripe=return`, type: 'account_onboarding' })
  return NextResponse.json({ url: link.url })
}