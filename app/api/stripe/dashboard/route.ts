import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getArtist } from '@/lib/artist'

// GET redirects the signed-in artist straight into their Stripe Express payouts dashboard.
export async function GET(request: Request) {
  const artist = await getArtist()
  if (!artist) return NextResponse.redirect(new URL('/sign-in', request.url))
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || key.includes('placeholder') || !artist.stripeAccountId) return NextResponse.redirect(new URL('/artist-hq', request.url))
  const stripe = new Stripe(key)
  try {
    const link = await stripe.accounts.createLoginLink(artist.stripeAccountId)
    return NextResponse.redirect(link.url)
  } catch {
    return NextResponse.redirect(new URL('/artist-hq?stripe=error', request.url))
  }
}
