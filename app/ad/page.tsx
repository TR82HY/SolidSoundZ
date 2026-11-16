import Link from 'next/link'
import BrandLogo from '@/components/BrandLogo'

export default function AdPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090a0a] text-white">
      <div className="absolute inset-0 bg-[linear-gradient(145deg,#090a0a_0%,#1b2412_48%,#090a0a_100%)]" />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(216,255,22,0.11)_0,rgba(216,255,22,0.11)_1px,transparent_1px,transparent_10px)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-7 sm:px-8">
        <Link href="/" aria-label="SolidSoundZ home" className="w-fit rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d8ff16]">
          <BrandLogo className="h-14 w-auto sm:h-16" priority />
        </Link>

        <div className="mt-auto pt-24">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#d8ff16]">Own your sound</p>
          <h1 className="mt-3 text-6xl leading-[0.84] sm:text-7xl">MAKE THE<br />TRACK.<br /><span className="text-[#d8ff16]">BREAK THE<br />NOISE.</span></h1>
          <p className="mt-6 max-w-sm text-base leading-relaxed text-[#e0e5dd]">Upload, polish, and release original tracks from one workspace, then share them with your listeners.</p>

          <div className="mt-8 grid gap-3">
            <Link href="/upload" className="bg-[#d8ff16] px-5 py-4 text-center text-sm font-bold uppercase tracking-[0.12em] text-black hover:bg-white">Upload your track</Link>
            <Link href="/stream" className="border border-white/60 px-5 py-4 text-center text-sm font-bold uppercase tracking-[0.12em] text-white hover:border-[#d8ff16] hover:text-[#d8ff16]">Hear what is moving</Link>
          </div>
        </div>

        <div className="mt-8 border-t border-white/30 pt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-[#bdc5bb]">
          <div>Upload. Master. Get heard.</div>
          <div className="mt-1 text-[#d8ff16]">Developed by TR/\2HY</div>
        </div>
      </div>
    </main>
  )
}