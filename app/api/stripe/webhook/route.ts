import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const key = process.env.STRIPE_SECRET_KEY
  const signature = request.headers.get('stripe-signature')
  if (!secret || !key || !signature) return new NextResponse('webhook unavailable', { status: 400 })

  let event: Stripe.Event
  try {
    event = new Stripe(key).webhooks.constructEvent(await request.text(), signature, secret)
  } catch {
    return new NextResponse('invalid signature', { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    if (session.metadata?.type === 'contribution' && session.metadata.contributionId) {
      const contribution = await db.contribution.update({ where: { id: session.metadata.contributionId }, data: { status: 'paid' }, include: { track: { select: { title: true } } } })
      await db.notification.create({ data: { userId: contribution.artistId, trackId: contribution.trackId, type: 'contribution', message: `New $${(contribution.amountCents / 100).toFixed(2)} fan contribution for ${contribution.track.title}` } })
    } else {
      const userId = session.client_reference_id ?? session.metadata?.userId
      if (userId) await db.user.updateMany({ where: { id: userId }, data: { plan: 'pro' } })
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const userId = subscription.metadata.userId
    if (userId) await db.user.updateMany({ where: { id: userId }, data: { plan: 'free' } })
  }

  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account
    if (account.payouts_enabled) await db.user.updateMany({ where: { stripeAccountId: account.id }, data: { stripeOnboarded: true } })
  }

  return NextResponse.json({ received: true })
}