import Link from 'next/link'
import { currentAccount } from '@/lib/account'
import { db } from '@/lib/db'
import TransferTool from '@/components/TransferTool'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Move from SoundCloud', description: 'Connect SoundCloud and transfer your original audio files to SolidSoundZ.' }

export default async function MovePage({ searchParams }: { searchParams: { error?: string } }) {
  const account = await currentAccount()
  const pending = account ? await db.track.findMany({ where: { userId: account.id, s3Key: { startsWith: 'soundcloud/' }, published: false }, select: { id: true, title: true, scUrl: true, artHref: true, scPlays: true }, take: 200 }) : []
  const errors: Record<string, string> = {
    'soundcloud-state': 'The SoundCloud connection expired. Please connect again.',
    'soundcloud-canceled': 'SoundCloud authorization was canceled. Your profile and tracks were not changed.',
    'soundcloud-account-changed': 'Your signed-in profile changed during authorization. Start the connection again from the profile you want to use.',
    'soundcloud-not-configured': 'SoundCloud connection is not configured yet.',
    'soundcloud-token': 'SoundCloud could not authorize the connection.',
    'soundcloud-profile': 'SoundCloud could not return your profile.',
    'soundcloud-account': 'We could not link your account. Please try again.',
    'soundcloud-account-conflict': 'This SoundCloud account is already linked to a different profile, or its saved link needs attention. Sign in to the intended profile before reconnecting; profiles are never merged by name.',
    'soundcloud-import': 'Connected, but we could not fetch your tracks. You can try connecting again.',
  }
  return <div className="max-w-4xl space-y-6">
    <div className="border-y border-[#586055] bg-[#111511] p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#d8ff16]">Catalog tools</p>
      <h1 className="mt-2 text-4xl">Move from SoundCloud</h1>
      <p className="mt-4 text-[#c7cec5]">Connect your SoundCloud account to import public, fully playable releases and keep their source counts updated. Original audio uploads are optional and play directly on SolidSoundZ.</p>
      <p className="mt-2 text-sm text-[#aaa]">{account ? `You are connecting to ${account.handle}. Existing profile edits, uploads and publication choices will be kept.` : 'Already have a SolidSoundZ profile? Sign in to it first to avoid creating a separate artist account. Returning SoundCloud connections use their existing linked profile.'}</p>
      {!account && <Link href="/sign-in" className="inline-flex min-h-9 items-center text-sm text-[#d8ff16] underline">Sign in to an existing profile</Link>}
      {searchParams.error && <p role="alert" className="mt-4 text-[#ff9d89]">{errors[searchParams.error] ?? 'SoundCloud connection could not be completed.'}</p>}
      <div className="mt-6 flex flex-wrap gap-3"><a href="/api/soundcloud/connect" className="bg-[#d8ff16] px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-black">Connect SoundCloud</a><Link href="/upload" className="border border-[#d8ff16] px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-[#d8ff16]">Upload a track</Link></div>
    </div>
    <TransferTool pending={pending} />
  </div>
}
