import { Suspense } from 'react'
import Studio from '@/components/studio/Studio'

export const metadata = { title: 'Free Online Mix & Master Studio', description: 'Master your track free in the browser: 5-band EQ, compressor, saturation, stereo width, loudness matching to Spotify levels and HD WAV export.' }

export default function StudioPage() {
  return <Suspense fallback={<div className="min-h-[320px] border border-[#586055] bg-[#111511]" />}><Studio /></Suspense>
}
