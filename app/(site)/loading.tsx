export default function SiteLoading() {
  return <div role="status" aria-live="polite" aria-busy="true" className="space-y-5">
    <span className="sr-only">Loading SolidSoundZ...</span>
    <div aria-hidden="true" className="animate-pulse space-y-5 motion-reduce:animate-none">
      <div className="h-8 w-2/3 max-w-sm rounded bg-[#252d22]" />
      {[0, 1, 2].map(index => <div key={index} className="flex gap-4 rounded-xl border border-[#303630] bg-[#111511] p-4">
        <div className="h-16 w-16 shrink-0 rounded bg-[#252d22] sm:h-24 sm:w-24" />
        <div className="min-w-0 flex-1 space-y-3"><div className="h-4 w-2/3 rounded bg-[#30392c]" /><div className="h-3 w-1/3 rounded bg-[#252d22]" /><div className="h-8 rounded bg-[#1b2219]" /></div>
      </div>)}
    </div>
  </div>
}
