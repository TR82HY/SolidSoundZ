import Link from 'next/link'
import { getArtist } from '@/lib/artist'
import { db } from '@/lib/db'
import { artUrl } from '@/lib/storage'
import { profileDeletionBlock } from '@/lib/profile'
import ProfileEditor from '@/components/ProfileEditor'
import DeleteProfileButton from '@/components/DeleteProfileButton'
import { isSiteAdmin } from '@/lib/access'
import AdminBadge from '@/components/AdminBadge'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Profile settings', robots: { index: false } }

export default async function SettingsPage({ searchParams }: { searchParams: { deleted?: string } }) {
  const artist = await getArtist()
  if (!artist) return <section className="mx-auto max-w-2xl space-y-4 rounded-xl border border-[#586055] bg-[#111511] p-6">
    <h1 className="text-4xl">{searchParams.deleted === '1' ? 'Profile removed' : 'Profile settings'}</h1>
    <p className="text-sm leading-relaxed text-[#bbb]">{searchParams.deleted === '1'
      ? 'You are signed out. Your SoundCloud and Apple Music releases are untouched. You can create a fresh profile whenever you are ready.'
      : 'Sign in to edit your artist name, photo, bio and location, manage your SoundCloud connection, or delete your profile.'}</p>
    <div className="flex flex-wrap gap-3">
      <Link href="/sign-in" className="min-h-11 rounded bg-[#d8ff16] px-4 py-3 text-sm font-bold text-black">Sign in</Link>
      <Link href="/move" className="min-h-11 rounded border border-[#586055] px-4 py-3 text-sm font-bold text-white">Connect SoundCloud</Link>
    </div>
  </section>
  const details = await db.user.findUniqueOrThrow({ where: { id: artist.id }, select: {
    plan: true, stripeAccountId: true, _count: { select: { tracks: true, playlists: true, contributions: true } },
    soundCloudSync: { select: { enabled: true, profileUrl: true, error: true } },
  } })
  return <div className="mx-auto max-w-3xl space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-4xl">Profile settings</h1><p className="mt-2 break-words text-sm text-[#bbb]">Managing {artist.handle}</p></div>
      <Link href={`/artist/${artist.slug}`} className="min-h-10 py-2 text-sm font-bold text-[#d8ff16] underline">View profile</Link>
    </header>
    {isSiteAdmin(artist) && <p className="flex flex-wrap items-center gap-3 rounded-lg border border-[#586055] bg-[#111511] p-4 text-sm text-[#ddd]"><AdminBadge /> Pro features are included for your owner account. No SolidSoundZ subscription is required.</p>}
    <ProfileEditor key={artist.id} id={artist.id} handle={artist.handle} slug={artist.slug} bio={artist.bio} location={artist.location} avatarUrl={artist.avatarHref ?? artUrl(artist.avatarKey)} />
    <section aria-labelledby="soundcloud-connection" className="rounded-xl border border-[#394039] bg-[#111511] p-4 sm:p-6">
      <h2 id="soundcloud-connection" className="text-2xl text-[#d8ff16]">SoundCloud connection</h2>
      <p className="mt-2 text-sm leading-relaxed text-[#bbb]">Connect your SoundCloud account to this profile, or renew its authorization. Existing uploads, published tracks, custom profile edits and Apple-approved metadata are preserved.</p>
      <p className="mt-2 text-xs leading-relaxed text-[#aaa]">Connecting imports public, fully playable releases and enables automatic catalog updates about every five minutes while the site is active. Use the SoundCloud account you intend to link; names alone are never used to merge accounts.</p>
      {details.soundCloudSync?.error && <p role="status" className="mt-3 text-sm text-[#ffcf79]">{details.soundCloudSync.error}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <a href="/api/soundcloud/connect" className="inline-flex min-h-11 items-center rounded bg-[#d8ff16] px-4 py-2 text-sm font-bold text-black">{artist.soundCloudId ? 'Reconnect SoundCloud' : 'Connect SoundCloud'}</a>
        {details.soundCloudSync && <a href={details.soundCloudSync.profileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[#ffb9a8] underline">Open source profile</a>}
      </div>
    </section>
    <DeleteProfileButton profileId={artist.id} handle={artist.handle} trackCount={details._count.tracks} playlistCount={details._count.playlists} needsPassword={!!artist.passwordHash} blocked={profileDeletionBlock(details)} />
  </div>
}
