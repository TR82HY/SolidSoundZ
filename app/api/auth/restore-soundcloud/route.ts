import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSession, currentAccount } from '@/lib/account'
import { getSoundCloudProfile, SoundCloudRequestError } from '@/lib/soundcloud'
import { findSoundCloudAccount } from '@/lib/soundcloudAccount'
import { isSiteAdmin } from '@/lib/access'

export async function POST() {
  try {
    const current = await currentAccount()
    if (current) return NextResponse.json({ user: { handle: current.handle, slug: current.slug, isAdmin: isSiteAdmin(current) } })
    const token = cookies().get('soundcloud_access_token')?.value
    if (!token) return NextResponse.json({ user: null })
    let profile
    try {
      profile = await getSoundCloudProfile(token)
      if (!Number.isSafeInteger(profile.id) || profile.id <= 0) throw new Error('Invalid SoundCloud profile ID')
    } catch (error) {
      if (error instanceof SoundCloudRequestError && (error.status === 401 || error.status === 403)) {
        cookies().set('soundcloud_access_token', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0, path: '/' })
        return NextResponse.json({ user: null })
      }
      console.error('SoundCloud session lookup failed', error instanceof Error ? error.name : 'unknown error')
      return NextResponse.json({ error: 'SoundCloud is temporarily unavailable. Please try again.' }, { status: 502 })
    }
    const soundCloudId = String(profile.id)
    const user = await findSoundCloudAccount(soundCloudId)
    if (!user) return NextResponse.json({ error: 'connect SoundCloud once to create your account' }, { status: 404 })
    await createSession(user.id)
    return NextResponse.json({ user: { handle: user.handle, slug: user.slug, isAdmin: isSiteAdmin(user) } })
  } catch (error) {
    console.error('Session restoration failed', error instanceof Error ? error.name : 'unknown error')
    return NextResponse.json({ error: 'Could not restore your session. Please try again.' }, { status: 503 })
  }
}