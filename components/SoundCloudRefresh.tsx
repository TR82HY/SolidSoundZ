'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export default function SoundCloudRefresh() {
  const router = useRouter()
  const previous = useRef<string | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let request: AbortController | null = null
    const check = async () => {
      if (document.visibilityState !== 'visible' || request) return
      const controller = new AbortController()
      request = controller
      try {
        const response = await fetch('/api/soundcloud/sync', { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('Could not check SoundCloud updates.')
        const data: unknown = await response.json()
        if (!data || typeof data !== 'object' || !('revision' in data) || typeof data.revision !== 'string'
          || !('refreshed' in data) || typeof data.refreshed !== 'boolean' || !('error' in data)
          || (data.error !== null && typeof data.error !== 'string')) throw new Error('Invalid SoundCloud update status.')
        if (controller.signal.aborted) return
        setError(data.error ?? '')
        if (data.refreshed || previous.current !== null && previous.current !== data.revision) router.refresh()
        previous.current = data.revision
      } catch {
        if (!controller.signal.aborted) setError('Could not check SoundCloud updates. Showing the last saved counts; checking again automatically.')
      } finally { if (request === controller) request = null }
    }
    const visible = () => { if (document.visibilityState === 'hidden') { request?.abort(); request = null } else void check() }
    void check()
    const timer = setInterval(() => void check(), 60_000)
    document.addEventListener('visibilitychange', visible)
    return () => { clearInterval(timer); request?.abort(); document.removeEventListener('visibilitychange', visible) }
  }, [router])
  return error ? <p role="status" className="mx-auto mt-3 max-w-6xl px-4 text-xs text-[#ffcf79]">{error}</p> : null
}
