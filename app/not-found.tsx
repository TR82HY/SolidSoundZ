import Link from 'next/link'
import BrandLogo from '@/components/BrandLogo'

export default function NotFound() {
  return <section className="mx-auto my-10 max-w-xl rounded-2xl border border-[#586055] bg-[#111511] p-6 sm:p-10">
    <Link href="/" aria-label="SolidSoundZ home" className="inline-block"><BrandLogo className="h-auto w-44" /></Link>
    <p className="mt-6 font-mono text-xs uppercase tracking-wider text-[#d8ff16]">404 / Nothing on this frequency</p>
    <h1 className="mt-3 text-4xl">That page is not available.</h1>
    <p className="mt-3 text-sm leading-relaxed text-[#bbb]">The link may be incorrect, or the release may have been removed or made private. There is more music to explore.</p>
    <div className="mt-6 flex flex-wrap gap-3">
      <Link href="/" className="inline-flex min-h-11 items-center rounded bg-[#d8ff16] px-4 py-2 text-sm font-bold text-black">Back to home</Link>
      <Link href="/search" className="inline-flex min-h-11 items-center rounded border border-[#586055] px-4 py-2 text-sm font-bold text-white">Search music</Link>
    </div>
  </section>
}
