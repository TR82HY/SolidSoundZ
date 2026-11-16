import { notFound } from 'next/navigation'
import { getTrackCard } from '@/lib/queries'
import { SITE_URL } from '@/lib/site'
import EmbedPlayer from '@/components/EmbedPlayer'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { id: string } }) {
  const t = await getTrackCard(params.id)
  return { title: t ? `${t.title} by ${t.artist}` : 'SolidSoundZ', robots: { index: false } }
}

export default async function Embed({ params }: { params: { id: string } }) {
  const t = await getTrackCard(params.id)
  if (!t) notFound()
  return <EmbedPlayer t={t} siteUrl={SITE_URL} />
}
