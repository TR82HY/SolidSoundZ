export const compact = (x: number) =>
  x >= 1_000_000 ? `${(x / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
    : x >= 10_000 ? `${(x / 1000).toFixed(1).replace(/\.0$/, '')}K`
      : x.toLocaleString('en-US')

export function timeAgo(iso: string, now = Date.now()) {
  const s = (now - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  const units: [number, string][] = [[31_536_000, 'year'], [2_592_000, 'month'], [604_800, 'week'], [86_400, 'day'], [3600, 'hour'], [60, 'minute']]
  for (const [secs, name] of units) {
    const v = Math.floor(s / secs)
    if (v >= 1) return `${v} ${name}${v > 1 ? 's' : ''} ago`
  }
  return 'just now'
}

export function timeUntil(iso: string, now = Date.now()) {
  const s = (new Date(iso).getTime() - now) / 1000
  if (s <= 0) return 'now'
  const units: [number, string][] = [[31_536_000, 'year'], [2_592_000, 'month'], [604_800, 'week'], [86_400, 'day'], [3600, 'hour'], [60, 'minute']]
  for (const [secs, name] of units) {
    const v = Math.floor(s / secs)
    if (v >= 1) return `in ${v} ${name}${v > 1 ? 's' : ''}`
  }
  return 'in under a minute'
}
