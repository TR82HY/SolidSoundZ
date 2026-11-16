'use client'
import { FORMATS, type FormatId } from '@/lib/audio'

export function FormatSelect({ value, onChange }: { value: FormatId, onChange: (v: FormatId) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value as FormatId)} className="max-w-full bg-[#222] border border-[#555] text-white rounded-lg px-3 py-2 text-sm font-bold">
      {FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
    </select>
  )
}

export function Seg<T extends string>({ label, options, value, onChange }: { label: string, options: T[], value: T, onChange: (v: T) => void }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-[#aaa] mb-1">{label}</div>
      <div className="flex rounded-lg overflow-hidden border border-[#555]">
        {options.map(o => (
          <button key={o} onClick={() => onChange(o)} className={`px-3 py-2 text-sm font-bold ${o === value ? 'bg-[#ccff00] text-black' : 'bg-[#222] text-white hover:bg-[#333]'}`}>{o}</button>
        ))}
      </div>
    </div>
  )
}

export function Toggle({ on, onClick, children }: { on: boolean, onClick: () => void, children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-4 py-2 rounded-lg text-sm font-bold border ${on ? 'bg-[#ccff00] text-black border-[#ccff00]' : 'bg-[#222] text-white border-[#555] hover:bg-[#333]'}`}>
      {children}
    </button>
  )
}

export function Panel({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#333] bg-[#111] p-4">
      <div className="text-sm font-bold text-[#ccff00] mb-3">{title}</div>
      {children}
    </div>
  )
}
