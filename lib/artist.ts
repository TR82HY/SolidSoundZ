import { auth, currentUser } from '@clerk/nextjs'
import { db } from './db'
import { currentAccount } from './account'

const isPlaceholder = (v?: string) => !v || /PASTE_|\.\.\./.test(v)

export const clerkConfigured = () => process.env.ENABLE_CLERK_MIDDLEWARE === 'true' && !isPlaceholder(process.env.CLERK_SECRET_KEY)

const LOCAL_ARTIST_ID = 'local-artist'

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'artist'

async function uniqueSlug(base: string) {
  let slug = base
  while (await db.user.findUnique({ where: { slug }, select: { id: true } })) slug = `${base}-${Math.random().toString(36).slice(2, 6)}`
  return slug
}

async function uniqueHandle(base: string) {
  let handle = base
  while (await db.user.findUnique({ where: { handle }, select: { id: true } })) handle = `${base} ${Math.floor(Math.random() * 900 + 100)}`
  return handle
}

// Until Clerk keys exist, local development runs as a single built-in artist.
export async function getArtist() {
  const account = await currentAccount()
  if (account) return account
  let id: string | null = null
  if (clerkConfigured()) id = auth().userId
  else if (process.env.NODE_ENV !== 'production') id = LOCAL_ARTIST_ID
  if (!id) return null

  const existing = await db.user.findUnique({ where: { id } })
  if (existing) return existing
  if (await db.deletedProfile.findUnique({ where: { id }, select: { id: true } })) return null

  if (id === LOCAL_ARTIST_ID) return db.user.create({ data: { id, handle: 'TR/\\2HY', slug: 'tr82hy' } })

  const u = await currentUser()
  const name = (u?.username || [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.emailAddresses[0]?.emailAddress.split('@')[0] || 'New Artist').slice(0, 40)
  const handle = await uniqueHandle(name)
  return db.user.create({ data: { id, handle, slug: await uniqueSlug(slugify(name)) } })
}
