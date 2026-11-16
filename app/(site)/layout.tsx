import { Suspense } from 'react'
import PlayerProvider from '@/components/player/PlayerProvider'
import PlayerBar from '@/components/player/PlayerBar'
import Nav from '@/components/Nav'
import SoundCloudRefresh from '@/components/SoundCloudRefresh'

export const maxDuration = 60

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlayerProvider>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-[#d8ff16] focus:px-4 focus:py-3 focus:font-bold focus:text-black">Skip to content</a>
      <Suspense fallback={<div className="h-14 border-b border-[#222]" />}><Nav /></Suspense>
      <SoundCloudRefresh />
      <main id="main-content" tabIndex={-1} className="max-w-6xl mx-auto px-4 pt-8 pb-[calc(var(--player-height,0px)+3rem)] scroll-mt-48">{children}</main>
      <PlayerBar />
    </PlayerProvider>
  )
}
