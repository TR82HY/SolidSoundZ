import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getTrackCard, relatedTracks } from '@/lib/queries'
import { getArtist } from '@/lib/artist'
import { SITE_URL } from '@/lib/site'
import TrackView from '@/components/TrackView'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const t = await getTrackCard(params.id)
  if (!t) return { title: 'Track not found' }
  const title = `${t.title} by ${t.artist}`
  const description = `Listen to ${t.title} by ${t.artist}${t.genre ? ` (${t.genre})` : ''} on SolidSoundZ. Stream free, no signup needed.`
  const images = t.artUrl ? [{ url: t.artUrl, width: 800, height: 800, alt: title }] : undefined
  const embed = `${SITE_URL}/embed/${t.id}`
  return {
    title,
    description,
    alternates: { canonical: `/t/${t.id}` },
    openGraph: { type: 'music.song', title, description, url: `/t/${t.id}`, images, audio: [{ url: t.audioUrl }] },
    twitter: { card: 'player', title, description, images: t.artUrl ? [t.artUrl] : undefined, players: [{ playerUrl: embed, streamUrl: t.audioUrl, width: 480, height: 166 }] },
  }
}

export default async function TrackPage({ params }: { params: { id: string } }) {
  const [card, extra] = await Promise.all([
    getTrackCard(params.id),
    db.track.findUnique({
      where: { id: params.id },
      select: { userId: true, description: true, scUrl: true, timedComments: { orderBy: { timestampMs: 'asc' }, select: { id: true, userId: true, name: true, text: true, timestampMs: true, createdAt: true, user: { select: { handle: true, slug: true } } } } },
    }),
  ])
  if (!card || !extra) notFound()
  const [artist, related] = await Promise.all([getArtist(), relatedTracks(params.id, card.genre)])
  return (
    <TrackView key={card.id} t={card} description={extra.description} scUrl={extra.scUrl} isOwner={artist?.id === extra.userId} related={related}
      comments={extra.timedComments.map(c => ({ ...c, createdAt: c.createdAt.toISOString() }))} />
  )
}
