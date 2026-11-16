import type { Prisma } from '@prisma/client'

export class ProfileChangeError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = 'ProfileChangeError' }
}

export function profileMutationAllowed(request: Request) {
  const expected = new URL(request.url)
  // Next's internal request URL can use localhost while the browser uses the incoming host.
  expected.host = request.headers.get('host') ?? expected.host
  return request.headers.get('origin') === expected.origin
    && request.headers.get('sec-fetch-site') !== 'cross-site'
}

export function profileDeletionBlock(profile: { plan: string, stripeAccountId: string | null, _count: { contributions: number } }) {
  if (profile.plan !== 'free' || profile.stripeAccountId || profile._count.contributions > 0) {
    return 'This profile has billing or payout records. Resolve its subscription and payout history with support before deleting it. Deleting a profile does not cancel Stripe billing.'
  }
  return null
}

export async function deleteProfileData(tx: Prisma.TransactionClient, userId: string) {
  const profile = await tx.user.findUnique({ where: { id: userId }, select: {
    id: true, plan: true, stripeAccountId: true, _count: { select: { contributions: true } },
  } })
  if (!profile) throw new ProfileChangeError('This profile no longer exists.', 404)
  const blocked = profileDeletionBlock(profile)
  if (blocked) throw new ProfileChangeError(blocked, 409)

  const tracks = await tx.track.findMany({ where: { userId }, select: { id: true } })
  await tx.soundCloudSync.deleteMany({ where: { userId } })
  await tx.session.deleteMany({ where: { userId } })
  await tx.notification.deleteMany({ where: { OR: [{ userId }, { trackId: { in: tracks.map(track => track.id) } }] } })
  await tx.timedComment.deleteMany({ where: { userId } })
  await tx.like.deleteMany({ where: { listener: userId } })
  await tx.repost.deleteMany({ where: { listener: userId } })
  await tx.follow.deleteMany({ where: { listener: userId } })
  await tx.master.deleteMany({ where: { track: { userId } } })
  await tx.stem.deleteMany({ where: { project: { userId } } })
  await tx.project.deleteMany({ where: { userId } })
  await tx.generation.deleteMany({ where: { userId } })
  await tx.vocalChain.deleteMany({ where: { userId } })
  await tx.playlist.deleteMany({ where: { userId } })
  await tx.track.deleteMany({ where: { userId } })
  await tx.user.delete({ where: { id: userId } })
  // Remember only the opaque ID so legacy login and development fallbacks cannot recreate it.
  await tx.deletedProfile.upsert({ where: { id: userId }, create: { id: userId }, update: {} })
}
