type Account = { soundCloudId: string | null, plan: string }

export function isSiteAdmin(account: Pick<Account, 'soundCloudId'> | null | undefined) {
  const ownerId = process.env.SITE_OWNER_SOUNDCLOUD_ID?.trim()
  return !!ownerId && /^[1-9]\d*$/.test(ownerId) && account?.soundCloudId === ownerId
}

export function hasProAccess(account: Account | null | undefined) {
  return !!account && (account.plan === 'pro' || isSiteAdmin(account))
}
