'use client'
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  label: string
  title: string
  description?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  size?: 'sm' | 'lg'
}

export default function ActionPopover({ label, title, description, open, onOpenChange, children, size = 'sm' }: Props) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<CSSProperties | null>(null)
  const visible = open && position !== null

  const dismiss = () => { onOpenChange(false); trigger.current?.focus() }

  useEffect(() => {
    if (!open) { setPosition(null); return }
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect()
      if (!anchor) return
      const width = document.documentElement.clientWidth
      const height = Math.min(document.documentElement.clientHeight, window.visualViewport?.height ?? innerHeight)
      const margin = 12, gap = 8, panelWidth = Math.min(320, width - margin * 2)
      const above = Math.max(0, anchor.top - gap - margin)
      const below = Math.max(0, height - anchor.bottom - gap - margin)
      const centered = Math.max(above, below) < 180
      const down = below >= Math.min(280, above)
      setPosition({
        width: panelWidth,
        left: Math.max(margin, Math.min(anchor.left, width - panelWidth - margin)),
        maxHeight: Math.max(1, centered ? height - margin * 2 : down ? below : above),
        ...(centered ? { top: margin } : down ? { top: anchor.bottom + gap } : { bottom: innerHeight - anchor.top + gap }),
      })
    }
    const outside = (event: Event) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) onOpenChange(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onOpenChange(false)
      trigger.current?.focus()
    }
    const scroll = (event: Event) => {
      if (event.target instanceof Node && panel.current?.contains(event.target)) return
      place()
    }
    place()
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', escape)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', scroll, true)
    window.visualViewport?.addEventListener('resize', place)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', scroll, true)
      window.visualViewport?.removeEventListener('resize', place)
    }
  }, [open, onOpenChange])

  useEffect(() => { if (visible) panel.current?.focus({ preventScroll: true }) }, [visible])

  return <>
    <button ref={trigger} type="button" onClick={() => onOpenChange(!open)} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      className={`shrink-0 rounded border border-[#555] text-[#ddd] hover:border-[#d8ff16] hover:text-white font-bold ${size === 'lg' ? 'min-h-11 px-4 py-2 text-sm' : 'min-h-9 px-2.5 py-1 text-xs'}`}>{label}</button>
    {visible && createPortal(
      <div ref={panel} id={id} role="dialog" aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined} tabIndex={-1}
        className="fixed z-[80] overflow-y-auto overscroll-contain rounded-xl border border-[#586055] bg-[#141914] p-3 text-white shadow-2xl" style={position}
        onKeyDown={event => {
          if (event.key !== 'Tab') return
          const controls = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled)')
          if (!controls?.length) return
          if (event.shiftKey && (document.activeElement === panel.current || document.activeElement === controls[0])) {
            event.preventDefault(); dismiss()
          } else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) dismiss()
        }}>
        <div className="mb-3 flex items-start justify-between gap-3 border-b border-[#394039] pb-2">
          <h2 id={`${id}-title`} className="min-w-0 break-words text-xl text-[#d8ff16]">{title}</h2>
          <button type="button" onClick={dismiss} aria-label={`Close ${title}`} className="min-h-9 shrink-0 px-2 text-xs font-bold text-[#ccc] underline">Close</button>
        </div>
        {description && <p id={`${id}-description`} className="mb-3 text-xs leading-relaxed text-[#b9c1b6]">{description}</p>}
        {children}
      </div>, document.body
    )}
  </>
}
