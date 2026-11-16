'use client'
import { useEffect, useRef } from 'react'

const DB_MIN = -48
const toY = (db: number, h: number) => h - (Math.max(DB_MIN, Math.min(0, db)) - DB_MIN) / -DB_MIN * h

// Stereo peak/RMS meters with peak hold + clip lights, and a log-frequency spectrum.
export default function Meters({ left, right, spectrum, running }: { left: AnalyserNode | null, right: AnalyserNode | null, spectrum: AnalyserNode | null, running: boolean }) {
  const levelRef = useRef<HTMLCanvasElement>(null)
  const specRef = useRef<HTMLCanvasElement>(null)
  const phaseRef = useRef<HTMLCanvasElement>(null)
  const hold = useRef({ l: DB_MIN, r: DB_MIN, clipL: 0, clipR: 0 })

  useEffect(() => {
    if (!running || !left || !right || !spectrum) return
    const td = new Float32Array(left.fftSize)
    const fd = new Float32Array(spectrum.frequencyBinCount)
    const leftData = new Float32Array(left.fftSize), rightData = new Float32Array(right.fftSize)
    let id = 0
    const read = (a: AnalyserNode) => {
      a.getFloatTimeDomainData(td)
      let peak = 0, sum = 0
      for (let i = 0; i < td.length; i++) { const v = Math.abs(td[i]); if (v > peak) peak = v; sum += td[i] * td[i] }
      return { peak: 20 * Math.log10(peak || 1e-9), rms: 10 * Math.log10(sum / td.length || 1e-12) }
    }
    const draw = () => {
      const lv = levelRef.current?.getContext('2d'), sp = specRef.current?.getContext('2d'), ph = phaseRef.current?.getContext('2d')
      if (lv) {
        const { width: w, height: h } = lv.canvas
        const L = read(left), R = read(right), H = hold.current
        H.l = Math.max(L.peak, H.l - 0.4); H.r = Math.max(R.peak, H.r - 0.4)
        if (L.peak > -0.1) H.clipL = 60
        if (R.peak > -0.1) H.clipR = 60
        H.clipL = Math.max(0, H.clipL - 1); H.clipR = Math.max(0, H.clipR - 1)
        lv.clearRect(0, 0, w, h)
        const barW = (w - 40) / 2
        ;[[L, H.l, H.clipL, 0], [R, H.r, H.clipR, 1]].forEach(([m, pk, clip, i]) => {
          const meter = m as { peak: number, rms: number }, x = 30 + (i as number) * (barW + 4)
          const grad = lv.createLinearGradient(0, h, 0, 0)
          grad.addColorStop(0, '#4d7a00'); grad.addColorStop(0.7, '#ccff00'); grad.addColorStop(0.9, '#ffaa00'); grad.addColorStop(1, '#ff3030')
          lv.fillStyle = '#1a1a1a'; lv.fillRect(x, 10, barW, h - 10)
          lv.fillStyle = grad; lv.fillRect(x, toY(meter.peak, h - 10) + 10, barW, h - 10 - toY(meter.peak, h - 10))
          lv.fillStyle = 'rgba(255,255,255,0.35)'; lv.fillRect(x, toY(meter.rms, h - 10) + 10, barW, 2)
          lv.fillStyle = '#fff'; lv.fillRect(x, toY(pk as number, h - 10) + 10, barW, 2)
          lv.fillStyle = (clip as number) > 0 ? '#ff3030' : '#330000'; lv.fillRect(x, 0, barW, 7)
        })
        lv.fillStyle = '#888'; lv.font = '9px monospace'; lv.textAlign = 'right'
        for (const db of [0, -6, -12, -18, -24, -36, -48]) lv.fillText(String(db), 26, toY(db, h - 10) + 13)
      }
      if (sp) {
        const { width: w, height: h } = sp.canvas
        spectrum.getFloatFrequencyData(fd)
        sp.clearRect(0, 0, w, h)
        const bands = 72, nyq = spectrum.context.sampleRate / 2
        for (let b = 0; b < bands; b++) {
          const f0 = 20 * Math.pow(1000, b / bands), f1 = 20 * Math.pow(1000, (b + 1) / bands)
          const i0 = Math.floor(f0 / nyq * fd.length), i1 = Math.max(i0 + 1, Math.floor(f1 / nyq * fd.length))
          let m = -140
          for (let i = i0; i < i1 && i < fd.length; i++) m = Math.max(m, fd[i])
          const v = Math.max(0, Math.min(1, (m + 90) / 80))
          const bw = w / bands
          sp.fillStyle = `hsl(${75 - v * 75}, 100%, ${35 + v * 20}%)`
          sp.fillRect(b * bw, h - v * h, bw - 1, v * h)
        }
        sp.fillStyle = '#777'; sp.font = '9px monospace'
        for (const [f, label] of [[50, '50'], [200, '200'], [1000, '1k'], [5000, '5k'], [15000, '15k']] as const) sp.fillText(label, Math.log(f / 20) / Math.log(1000) * w + 2, h - 2)
      }
      if (ph) {
        const { width: w, height: h } = ph.canvas
        left.getFloatTimeDomainData(leftData); right.getFloatTimeDomainData(rightData)
        let dot = 0, leftPower = 0, rightPower = 0
        for (let i = 0; i < leftData.length; i++) { dot += leftData[i] * rightData[i]; leftPower += leftData[i] ** 2; rightPower += rightData[i] ** 2 }
        const correlation = dot / Math.sqrt(leftPower * rightPower || 1)
        ph.clearRect(0, 0, w, h)
        ph.fillStyle = '#0a0a0a'; ph.fillRect(0, 0, w, h)
        const x0 = 18, trackW = w - 36, y = 20
        ph.fillStyle = '#5b1d18'; ph.fillRect(x0, y, trackW / 2, 8)
        ph.fillStyle = '#496300'; ph.fillRect(x0 + trackW / 2, y, trackW / 2, 8)
        const x = x0 + ((correlation + 1) / 2) * trackW
        ph.fillStyle = correlation < 0 ? '#ff5a36' : '#d8ff16'; ph.fillRect(x - 2, y - 5, 4, 18)
        ph.fillStyle = '#aeb8ab'; ph.font = '9px monospace'; ph.textAlign = 'left'; ph.fillText('PHASE', 4, 48); ph.textAlign = 'right'; ph.fillText(correlation.toFixed(2), w - 4, 48)
      }
      id = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(id)
  }, [running, left, right, spectrum])

  return (
    <div role="group" aria-label="Live preview meters" className="space-y-2">
      <p className="text-[11px] text-[#999]">{running ? 'Live preview levels before monitor volume' : 'Play to view preview levels, spectrum, and phase'}</p>
      <div className="flex gap-3">
      <canvas ref={levelRef} role="img" aria-label="Stereo peak and RMS meters" width={90} height={160} className="bg-[#0a0a0a] rounded border border-[#333]" />
      <div className="flex-1 min-w-0 space-y-2"><canvas ref={specRef} role="img" aria-label="Frequency spectrum" width={520} height={120} className="w-full bg-[#0a0a0a] rounded border border-[#333]" /><canvas ref={phaseRef} role="img" aria-label="Stereo phase correlation" width={520} height={58} className="w-full bg-[#0a0a0a] rounded border border-[#333]" /></div>
      </div>
      <details className="text-xs leading-relaxed text-[#aaa]">
        <summary className="cursor-pointer text-[#ccc] underline underline-offset-2">How to read these meters</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li><strong className="text-[#ddd]">Level bars:</strong> show the left and right channels. The bars follow peaks; the pale lines show average energy (RMS) and recent peak holds. Red lights flag levels near the digital maximum.</li>
          <li><strong className="text-[#ddd]">Spectrum:</strong> shows where the energy sits, from bass on the left to treble on the right. It is a guide, not a target shape.</li>
          <li><strong className="text-[#ddd]">Phase:</strong> compares the two channels. Negative values can mean parts of the sound cancel when played in mono. Try less Stereo Width if needed.</li>
        </ul>
      </details>
    </div>
  )
}
