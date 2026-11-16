'use client'
import { useEffect, useState } from 'react'
import { timeAgo, timeUntil } from '@/lib/format'

const dateFormat = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })

export default function RelativeTime({ value, future = false, referenceTime }: { value: string, future?: boolean, referenceTime?: string }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const baseline = referenceTime ? Date.parse(referenceTime) : Date.now()
    const started = performance.now()
    const update = () => setNow(baseline + performance.now() - started)
    update()
    const timer = setInterval(update, 60_000)
    return () => clearInterval(timer)
  }, [value, referenceTime])

  const date = new Date(value)
  return <time dateTime={value} title={date.toUTCString()}>
    {now === null ? dateFormat.format(date) : future ? timeUntil(value, now) : timeAgo(value, now)}
  </time>
}
