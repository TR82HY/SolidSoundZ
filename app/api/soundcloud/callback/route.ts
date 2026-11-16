import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSoundCloudProfile, importSoundCloudPlaylists } from '@/lib/soundcloud'
import { getArtist } from '@/lib/artist'
import { createSession } from '@/lib/account'
import { db } from '@/lib/db'
import { linkSoundCloudAccount, SoundCloudAccountConflict } from '@/lib/soundcloudAccount'
import { refreshSoundCloudConnection } from '@/lib/soundcloudSync'

export const maxDuration = 60
const PENDING_COOKIES = ['soundcloud_oauth_state', 'soundcloud_oauth_verifier', 'soundcloud_oauth_account']

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const jar = cookies()
  const savedState = jar.get('soundcloud_oauth_state')?.value
  const verifier = jar.get('soundcloud_oauth_verifier')?.value
  const expectedAccount = jar.get('soundcloud_oauth_account')?.value
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID
  const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET
  const redirect = (destination: string) => {
    const response = NextResponse.redirect(new URL(destination, req.url))
    for (const name of PENDING_COOKIES) response.cookies.set(name, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0, path: '/' })
    return response
  }
  if (!state || !savedState || state !== savedState || !verifier || !expectedAccount) return redirect('/move?error=soundcloud-state')
  if (url.searchParams.has('error')) return redirect('/move?error=soundcloud-canceled')
  if (!code) return redirect('/move?error=soundcloud-state')
  if (!clientId || !clientSecret) return redirect('/move?error=soundcloud-not-configured')

  let signedIn
  try {
    signedIn = await getArtist()
    if ((signedIn?.id ?? 'signed-out') !== expectedAccount) return redirect('/move?error=soundcloud-account-changed')
  } catch {
    return redirect('/move?error=soundcloud-account')
  }
  for (const name of PENDING_COOKIES) jar.set(name, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0, path: '/' })
  const redirectUri = process.env.SOUNDCLOUD_REDIRECT_URI || new URL('/api/soundcloud/callback', req.url).toString()
  let token: string
  try {
    const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', redirect_uri: redirectUri, code_verifier: verifier, code })
    const response = await fetch('https://secure.soundcloud.com/oauth/token', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body,
      cache: 'no-store', signal: AbortSignal.timeout(12000),
    })
    if (!response.ok) return redirect('/move?error=soundcloud-token')
    const data: unknown = await response.json()
    if (!data || typeof data !== 'object' || !('access_token' in data) || typeof data.access_token !== 'string' || !data.access_token) return redirect('/move?error=soundcloud-token')
    token = data.access_token
  } catch (error) {
    console.error('SoundCloud authorization failed.', error instanceof Error ? error.name : 'Unknown error')
    return redirect('/move?error=soundcloud-token')
  }
  let profile
  try { profile = await getSoundCloudProfile(token) }
  catch (error) {
    console.error('SoundCloud profile request failed.', error instanceof Error ? error.name : 'Unknown error')
    return redirect('/move?error=soundcloud-profile')
  }
  let artist
  try {
    artist = await linkSoundCloudAccount(profile, signedIn?.id ?? null)
    await createSession(artist.id)
  } catch (error) {
    if (error instanceof SoundCloudAccountConflict) return redirect('/move?error=soundcloud-account-conflict')
    console.error('SoundCloud account linking failed.', error instanceof Error ? error.name : 'Unknown error')
    return redirect('/move?error=soundcloud-account')
  }

  let imported = 0, importedPlaylists = 0, importError = ''
  try {
    if (!profile.permalink_url) throw new Error('SoundCloud did not return a public profile URL.')
    const before = await db.track.count({ where: { userId: artist.id } })
    await db.soundCloudSync.upsert({
      where: { userId: artist.id },
      create: { userId: artist.id, sourceUserId: String(profile.id), profileUrl: profile.permalink_url, enabled: true, importNew: true, nextSyncAt: new Date(0) },
      update: { profileUrl: profile.permalink_url, enabled: true, importNew: true },
    })
    await refreshSoundCloudConnection(artist.id, token)
    const connection = await db.soundCloudSync.findUnique({ where: { userId: artist.id }, select: { error: true } })
    if (connection?.error) importError = 'soundcloud-import'
    imported = Math.max(0, await db.track.count({ where: { userId: artist.id } }) - before)
    importedPlaylists = await importSoundCloudPlaylists(token, artist.id)
  } catch (error) {
    console.error('SoundCloud catalog import failed.', error instanceof Error ? error.name : 'Unknown error')
    importError = 'soundcloud-import'
  }
  const response = redirect(`/you?connected=soundcloud&imported=${imported}&playlists=${importedPlaylists}${importError ? `&error=${importError}` : ''}`)
  response.cookies.set('soundcloud_access_token', token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 3600, path: '/',
  })
  return response
}
