import { db } from './db'
import type { SoundCloudProfile } from './soundcloud'

export class SoundCloudAccountConflict extends Error {
  constructor() { super('This SoundCloud identity is linked to a different profile, or the signed-in profile changed.'); this.name = 'SoundCloudAccountConflict' }
}

export async function findSoundCloudAccount(sourceId: string) {
  const users = await db.user.findMany({ where: { soundCloudId: sourceId }, take: 2 })
  if (users.length > 1) throw new SoundCloudAccountConflict()
  return users[0] ?? null
}

export async function linkSoundCloudAccount(profile: SoundCloudProfile, signedInId: string | null) {
  if (!Number.isSafeInteger(profile.id) || profile.id <= 0) throw new Error('Invalid SoundCloud profile identity.')
  const sourceId = String(profile.id)
  return db.$transaction(async tx => {
    const linked = await tx.user.findMany({ where: { soundCloudId: sourceId }, take: 2 })
    if (linked.length > 1) throw new SoundCloudAccountConflict()
    const current = signedInId ? await tx.user.findUnique({ where: { id: signedInId } }) : null
    if (signedInId && (!current || current.soundCloudId && current.soundCloudId !== sourceId
      || linked[0] && linked[0].id !== current.id)) throw new SoundCloudAccountConflict()
    const target = current ?? linked[0]
    if (target) {
      const connection = await tx.soundCloudSync.findUnique({ where: { userId: target.id }, select: { sourceUserId: true } })
      if (connection && connection.sourceUserId !== sourceId) throw new SoundCloudAccountConflict()
      return tx.user.update({ where: { id: target.id }, data: { soundCloudId: sourceId, profileClaimed: true } })
    }
    const name = profile.username?.trim().slice(0, 40) || 'SoundCloud Artist'
    const base = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'artist'
    let suffix = 0, handle = name, slug = base
    while (await tx.user.findFirst({ where: { OR: [{ handle }, { slug }] }, select: { id: true } })) {
      suffix++
      const ending = ` ${suffix}`
      handle = `${name.slice(0, 40 - ending.length)}${ending}`
      slug = `${base}-${suffix}`
    }
    const location = [profile.city?.trim(), profile.country?.trim()].filter(Boolean).join(', ')
    return tx.user.create({ data: {
      handle, slug, soundCloudId: sourceId, profileClaimed: true,
      bio: profile.description?.trim().slice(0, 500) || null, location: location.slice(0, 100) || null,
      avatarHref: profile.avatar_url?.replace(/-large(\.[a-z]+)$/i, '-t500x500$1') ?? null,
    } })
  }, { isolationLevel: 'Serializable', maxWait: 5000, timeout: 15000 })
}
