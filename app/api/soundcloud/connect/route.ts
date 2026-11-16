import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createHash, randomBytes } from 'crypto'
import { getArtist } from '@/lib/artist'

export async function GET(req: Request) {
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID
  if (!clientId) return NextResponse.redirect(new URL('/move?error=soundcloud-not-configured', req.url))

  const state = crypto.randomUUID()
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const signedIn = await getArtist()
  cookies().set('soundcloud_oauth_account', signedIn?.id ?? 'signed-out', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  cookies().set('soundcloud_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  cookies().set('soundcloud_oauth_verifier', verifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  const redirectUri = process.env.SOUNDCLOUD_REDIRECT_URI || new URL('/api/soundcloud/callback', req.url).toString()
  const authorize = new URL('https://secure.soundcloud.com/authorize')
  authorize.searchParams.set('client_id', clientId)
  authorize.searchParams.set('redirect_uri', redirectUri)
  authorize.searchParams.set('response_type', 'code')
  authorize.searchParams.set('state', state)
  authorize.searchParams.set('code_challenge', challenge)
  authorize.searchParams.set('code_challenge_method', 'S256')
  return NextResponse.redirect(authorize)
}