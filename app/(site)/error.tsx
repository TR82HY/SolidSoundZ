'use client'
import Link from 'next/link'
import { useEffect } from 'react'

export default function SiteError({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => { console.error('SolidSoundZ page failed to load.', error) }, [error])
  return <section role="alert" className="mx-auto max-w-xl rounded-2xl border border-[#586055] bg-[#111511] p-6 sm:p-10">
    <p className="font-mono text-xs uppercase tracking-wider text-[#ff9d89]">Something went wrong</p>
    <h1 className="mt-3 text-4xl">This page could not load.</h1>
    <p className="mt-3 text-sm leading-relaxed text-[#bbb]">Something went wrong while opening this page. Try again, or return home to keep exploring.</p>
    <div className="mt-6 flex flex-wrap gap-3">
      <button onClick={reset} className="min-h-11 rounded bg-[#d8ff16] px-4 py-2 text-sm font-bold text-black">Try again</button>
      <Link href="/" className="inline-flex min-h-11 items-center rounded border border-[#586055] px-4 py-2 text-sm font-bold text-white">Back to home</Link>
    </div>
    {error.digest && <p className="mt-4 break-all font-mono text-xs text-[#999]">Reference: {error.digest}</p>}
  </section>
}
