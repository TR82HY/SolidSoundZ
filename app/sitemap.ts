import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'
import { GENRES } from '@/lib/genres'
import { SITE_URL } from '@/lib/site'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [tracks, artists] = await Promise.all([
    db.track.findMany({ where: { published: true, user: { profileClaimed: true } }, select: { id: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 45000 }),
    db.user.findMany({ where: { profileClaimed: true, tracks: { some: { published: true } } }, select: { slug: true, createdAt: true }, take: 5000 }),
  ])
  const now = new Date()
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    { url: `${SITE_URL}/studio`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/move`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    ...GENRES.map(g => ({ url: `${SITE_URL}/search?genre=${encodeURIComponent(g)}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.5 })),
    ...artists.map(a => ({ url: `${SITE_URL}/artist/${a.slug}`, lastModified: a.createdAt, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...tracks.map(t => ({ url: `${SITE_URL}/t/${t.id}`, lastModified: t.createdAt, changeFrequency: 'weekly' as const, priority: 0.8 })),
  ]
}
