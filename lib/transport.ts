'use client'
import { useEffect, useRef, type RefObject } from 'react'

const STOP_ALL = 'ssz:stop-all'
const TOGGLE = 'ssz:toggle'

export function stopAll() {
  window.dispatchEvent(new Event(STOP_ALL))
  document.querySelectorAll('audio').forEach(a => a.pause())
}

// Space toggles the visible player; ignored while typing or when a control has focus (it handles Space itself).
export function useSpaceToToggle() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      if ((e.target as HTMLElement).closest('input, textarea, select, button, summary, audio, [contenteditable]')) return
      e.preventDefault()
      window.dispatchEvent(new Event(TOGGLE))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

// Hidden tabs have no offsetParent, so only the player on screen reacts to Space.
// A `global` player (the site-wide bar) yields Space to any visible [data-local-transport] player, e.g. the Studio.
export function useTransport(root: RefObject<HTMLElement>, handlers: { toggle: () => void, stop: () => void }, opts: { global?: boolean } = {}) {
  const h = useRef(handlers)
  h.current = handlers
  useEffect(() => {
    const onStop = () => h.current.stop()
    const onToggle = () => {
      if (opts.global) {
        const local = Array.from(document.querySelectorAll<HTMLElement>('[data-local-transport]')).some(el => el.offsetParent)
        if (!local) h.current.toggle()
      } else if (root.current?.offsetParent) h.current.toggle()
    }
    window.addEventListener(STOP_ALL, onStop)
    window.addEventListener(TOGGLE, onToggle)
    return () => {
      window.removeEventListener(STOP_ALL, onStop)
      window.removeEventListener(TOGGLE, onToggle)
    }
  }, [root, opts.global])
}

// Click or drag anywhere on an element to seek.
export function scrub(seekTo: (fraction: number) => void) {
  const at = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    seekTo(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)))
  }
  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => { e.currentTarget.setPointerCapture(e.pointerId); at(e) },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) at(e) },
  }
}

export const transportBtn = 'px-4 py-2 rounded font-bold text-sm disabled:opacity-40'
