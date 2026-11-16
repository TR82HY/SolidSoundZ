import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getArtist } from '@/lib/artist'
import { isSiteAdmin } from '@/lib/access'

export async function POST(req: Request) {
  const artist = await getArtist()
  if (!artist) return NextResponse.json({ error: 'sign in required' }, { status: 401 })
  if (isSiteAdmin(artist)) return NextResponse.json({ error: 'Your Admin account already includes Pro access. No subscription purchase is needed.', code: 'admin_access' }, { status: 409 })

  const { plan } = await req.json().catch(() => ({ plan: 'monthly' }))
  const price = plan === 'yearly' ? process.env.STRIPE_PRICE_YEARLY : process.env.STRIPE_PRICE_MONTHLY
  if (!process.env.STRIPE_SECRET_KEY || !price) {
    return NextResponse.json({ error: 'stripe not configured' }, { status: 500 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const origin = new URL(req.url).origin
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    client_reference_id: artist.id,
    metadata: { userId: artist.id },
    subscription_data: { metadata: { userId: artist.id } },
    success_url: `${origin}/create?checkout=success`,
    cancel_url: `${origin}/create?checkout=cancel`,
  })
  return NextResponse.json({ url: session.url })
}
