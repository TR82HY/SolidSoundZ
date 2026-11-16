import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { head } from '@vercel/blob'
import { db } from '@/lib/db'
import { getArtist } from '@/lib/artist'
import { clearAccountCookies, passwordMatches } from '@/lib/account'
import { BLOB_URL, IMAGE_TYPES, artUrl, blobConfigured, saveFile } from '@/lib/storage'
import { deleteProfileData, profileMutationAllowed, ProfileChangeError } from '@/lib/profile'

const MAX_ART = 5 * 1024 * 1024

export async function PATCH(req: Request) {
  if (!profileMutationAllowed(req)) return NextResponse.json({ error: 'Profile changes must be submitted from this site.' }, { status: 403 })
  try {
    const artist = await getArtist()
    if (!artist) return NextResponse.json({ error: 'Sign in to edit your profile.' }, { status: 401 })
    let form: FormData
    try { form = await req.formData() }
    catch { return NextResponse.json({ error: 'The profile form could not be read.' }, { status: 400 }) }
    if (form.get('profileId') !== artist.id) return NextResponse.json({ error: 'Your signed-in profile changed. Reload settings before saving.' }, { status: 409 })
    const data: Prisma.UserUpdateInput = {}
    for (const [field, maximum] of [['handle', 40], ['bio', 500], ['location', 100]] as const) {
      const value = form.get(field)
      if (value === null) continue
      if (typeof value !== 'string' || value.trim().length > maximum || field === 'handle' && !value.trim()) {
        return NextResponse.json({ error: field === 'handle' ? 'Enter an artist name between 1 and 40 characters.' : `${field === 'bio' ? 'Bio' : 'Location'} must be at most ${maximum} characters.` }, { status: 400 })
      }
      if (field === 'handle') data.handle = value.trim()
      else data[field] = value.trim() || null
    }
    const avatarUrlField = form.get('avatarUrl')
    const avatarFile = form.get('avatar')
    const removeAvatar = form.get('removeAvatar') === 'true'
    if (removeAvatar && (avatarUrlField || avatarFile instanceof File && avatarFile.size)) return NextResponse.json({ error: 'Choose a new avatar or remove it, not both.' }, { status: 400 })
    if (removeAvatar) { data.avatarKey = null; data.avatarHref = null }
    else if (avatarUrlField) {
      if (typeof avatarUrlField !== 'string' || !BLOB_URL.test(avatarUrlField) || !blobConfigured()) return NextResponse.json({ error: 'Invalid avatar upload.' }, { status: 400 })
      const info = await head(avatarUrlField)
      if (!IMAGE_TYPES[info.contentType] || info.size > MAX_ART) return NextResponse.json({ error: 'Avatar must be JPG, PNG or WEBP, up to 5 MB.' }, { status: 400 })
      data.avatarKey = info.pathname; data.avatarHref = info.url
    } else if (avatarFile instanceof File && avatarFile.size > 0) {
      if (!IMAGE_TYPES[avatarFile.type]) return NextResponse.json({ error: 'Avatar must be JPG, PNG or WEBP.' }, { status: 415 })
      if (avatarFile.size > MAX_ART) return NextResponse.json({ error: 'Avatar must be up to 5 MB.' }, { status: 413 })
      const key = `art/avatar-${artist.id}-${Date.now()}.${IMAGE_TYPES[avatarFile.type]}`
      data.avatarHref = await saveFile(key, Buffer.from(await avatarFile.arrayBuffer()), avatarFile.type)
      data.avatarKey = key
    }
    if (!Object.keys(data).length) return NextResponse.json({ error: 'No profile changes were submitted.' }, { status: 400 })
    const profile = await db.user.update({ where: { id: artist.id }, data,
      select: { id: true, handle: true, slug: true, bio: true, location: true, avatarHref: true, avatarKey: true },
    })
    return NextResponse.json({ ok: true, profile: { id: profile.id, handle: profile.handle, slug: profile.slug, bio: profile.bio, location: profile.location, avatarUrl: profile.avatarHref ?? artUrl(profile.avatarKey) } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ error: 'That artist name is already in use. Choose another name.' }, { status: 409 })
    console.error('Profile update failed.', error instanceof Error ? error.name : 'Unknown error')
    return NextResponse.json({ error: 'Could not save your profile. Your changes have not been confirmed; please retry.' }, { status: 503 })
  }
}

export async function DELETE(req: Request) {
  if (!profileMutationAllowed(req)) return NextResponse.json({ error: 'Profile deletion must be submitted from this site.' }, { status: 403 })
  try {
    const artist = await getArtist()
    if (!artist) return NextResponse.json({ error: 'Sign in to delete your profile.' }, { status: 401 })
    const body: unknown = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || !('profileId' in body) || body.profileId !== artist.id
      || !('confirmation' in body) || body.confirmation !== artist.handle
      || !('confirmed' in body) || body.confirmed !== true) {
      return NextResponse.json({ error: 'Confirm the signed-in profile by typing its exact artist name.' }, { status: 400 })
    }
    const password = 'password' in body && typeof body.password === 'string' ? body.password : ''
    if (artist.passwordHash && (password.length > 1024 || !await passwordMatches(password, artist.passwordHash))) {
      return NextResponse.json({ error: 'Enter the current password for this SolidSoundZ account.' }, { status: 403 })
    }
    await db.$transaction(async tx => {
      const current = await tx.user.findUnique({ where: { id: artist.id }, select: { handle: true, passwordHash: true } })
      if (!current || current.handle !== artist.handle || current.passwordHash !== artist.passwordHash) throw new ProfileChangeError('The profile changed. Reload settings and confirm again.', 409)
      await deleteProfileData(tx, artist.id)
    }, { isolationLevel: 'Serializable', maxWait: 5000, timeout: 20000 })
    clearAccountCookies()
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof ProfileChangeError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Profile deletion failed.', error instanceof Error ? error.name : 'Unknown error')
    return NextResponse.json({ error: 'The deletion could not be confirmed. Reload settings before trying again.' }, { status: 503 })
  }
}
