import { compact } from '@/lib/format'
import type { TrackCardData } from '@/lib/queries'
import RelativeTime from './RelativeTime'

export default function SoundCloudStats({ track, detailed = false }: { track: TrackCardData, detailed?: boolean }) {
  if (!track.scUrl) return null
  return <div className={`text-xs leading-relaxed text-[#aaa] ${detailed ? 'rounded-lg border border-[#394039] bg-[#111511] p-3' : 'mt-2'}`}>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <a href={track.scUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-[#ffab94] underline underline-offset-2">SoundCloud</a>
      {track.scStatsHidden ? <span>Source statistics are hidden</span> : <>
        <span>{compact(track.scPlays)} plays</span><span>{compact(track.scLikes)} likes</span>
        <span>{compact(track.scReposts ?? 0)} reposts</span>
      </>}
      {!track.scCommentsHidden && <span>{compact(track.scComments)} comments</span>}
    </div>
    {detailed && <p className="mt-2 text-[#939e91]">
      {track.scSyncedAt ? <>Source counts refreshed <RelativeTime value={track.scSyncedAt} referenceTime={track.scCheckedAt} />.</> : 'Source counts are from the last import.'}
      {' '}SoundCloud totals are separate from activity on SolidSoundZ.
      {track.scAccess && track.scAccess !== 'playable' && ' This SoundCloud source is not currently available for full playback.'}
    </p>}
  </div>
}
