'use client'
import { fmt } from '@/lib/audio'

type Props = {
  peaks: number[] | null
  waveformUrl?: string | null
  progress: number
  onSeek?: (fraction: number) => void
  height?: number
  markers?: number[]
  active?: boolean
  seed?: string
  preview?: boolean
  seekLabel?: string
  duration?: number
}

function fallbackPeaks(seed = 'default') {
  let state = 0
  for (let index = 0; index < seed.length; index++) state = (state * 31 + seed.charCodeAt(index)) >>> 0
  return Array.from({ length: 120 }, (_, index) => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    const noise = (state / 4_294_967_296) * 0.32
    return Math.min(1, 0.18 + noise + 0.24 * Math.abs(Math.sin(index * 0.19 + (state % 17))) + 0.18 * Math.abs(Math.sin(index * 0.61)))
  })
}

// SoundCloud-style bar waveform. Click or drag to seek.
export default function Waveform({ peaks, waveformUrl, progress, onSeek, height = 64, markers = [], active = false, seed, preview = false, seekLabel, duration = 0 }: Props) {
  const bars = peaks?.length ? peaks : fallbackPeaks(seed)
  const count = bars.length
  const pct = Math.min(1, Math.max(0, progress))
  const at = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    onSeek?.(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)))
  }
  const keyboard = seekLabel && onSeek ? {
    role: 'slider',
    tabIndex: 0,
    'aria-label': seekLabel,
    'aria-valuemin': 0,
    'aria-valuemax': duration || 100,
    'aria-valuenow': pct * (duration || 100),
    'aria-valuetext': duration ? `${fmt(pct * duration)} of ${fmt(duration)}` : `${Math.round(pct * 100)}%`,
    onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const step = (event.shiftKey ? 10 : 1) / (duration || 100)
      onSeek(event.key === 'Home' ? 0 : event.key === 'End' ? 1 : Math.max(0, Math.min(1, pct + (event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -step : step))))
    },
  } : {}
  if (preview) return <div className={`relative w-full overflow-hidden border-y border-[#3e473d] bg-[#090b09] select-none touch-none ${onSeek ? 'cursor-pointer' : ''}`} style={{ height }}
    {...keyboard}
    onPointerDown={e => { if (!onSeek) return; e.currentTarget.setPointerCapture(e.pointerId); at(e) }}
    onPointerMove={e => { if (onSeek && e.currentTarget.hasPointerCapture(e.pointerId)) at(e) }}>
    <span className="absolute inset-0 opacity-70 [background:repeating-linear-gradient(90deg,#4a5149_0,#4a5149_2px,transparent_2px,transparent_5px)]" />
    <span className="absolute inset-y-[18%] left-0 right-0 opacity-70 [background:repeating-linear-gradient(90deg,transparent_0,transparent_8px,#78883d_8px,#78883d_10px,transparent_10px,transparent_16px)]" />
  </div>
  return (
    <div className={`relative w-full overflow-hidden border-y border-[#3e473d] bg-[#090b09] select-none touch-none ${onSeek ? 'cursor-pointer' : ''}`} style={{ height }}
      {...keyboard}
      onPointerDown={e => { if (!onSeek) return; e.currentTarget.setPointerCapture(e.pointerId); at(e) }}
      onPointerMove={e => { if (onSeek && e.currentTarget.hasPointerCapture(e.pointerId)) at(e) }}>
      {waveformUrl ? <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={waveformUrl} alt="" className="absolute inset-0 h-full w-full object-fill opacity-70 grayscale contrast-125 [filter:brightness(1.8)]" />
        <span className="absolute inset-y-0 left-0 bg-[#d8ff16]/20 mix-blend-screen" style={{ width: `${pct * 100}%` }} />
      </> : <svg viewBox={`0 0 ${count * 3} 100`} preserveAspectRatio="none" className="relative h-full w-full">
        {bars.map((p, i) => {
          const h = Math.max(4, p * 96)
          const played = i / count < pct
          return <rect key={i} x={i * 3} y={(100 - h) / 2} width={2} height={h} className={played ? 'fill-[#d8ff16]' : active ? 'fill-[#78883d]' : 'fill-[#4a5149]'} />
        })}
      </svg>}
      {progress > 0 && <span className="absolute top-0 bottom-0 w-px bg-[#d8ff16] shadow-[0_0_8px_#d8ff16]" style={{ left: `${pct * 100}%` }} />}
      {markers.map((m, i) => (
        <span key={i} className="absolute inset-y-0 w-px bg-[#ff5a36]" style={{ left: `${m * 100}%` }} />
      ))}
    </div>
  )
}
