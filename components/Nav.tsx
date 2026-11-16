'use client'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import BrandLogo from './BrandLogo'
import AdminBadge from './AdminBadge'

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/charts', label: 'Charts' },
  { href: '/discover', label: 'Discover' },
  { href: '/stream', label: 'Stream' },
]

type AccountSummary = { handle: string, slug: string, isAdmin: boolean }

function accountFromResponse(data: unknown): AccountSummary | null {
  if (!data || typeof data !== 'object' || !('user' in data)) throw new Error('Invalid account response')
  const user = data.user
  if (user === null) return null
  if (!user || typeof user !== 'object' || !('handle' in user) || !('slug' in user)
    || typeof user.handle !== 'string' || !user.handle || typeof user.slug !== 'string' || !user.slug) {
    throw new Error('Invalid account response')
  }
  if ('isAdmin' in user && typeof user.isAdmin !== 'boolean') throw new Error('Invalid account role')
  return { handle: user.handle, slug: user.slug, isAdmin: 'isAdmin' in user && user.isAdmin === true }
}

export default function Nav() {
  const path = usePathname()
  const router = useRouter()
  const params = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [account, setAccount] = useState<AccountSummary | null>(null)
  const [unread, setUnread] = useState(0)
  const [accountError, setAccountError] = useState('')
  const [notificationError, setNotificationError] = useState('')
  const [signOutError, setSignOutError] = useState('')
  const [signingOut, setSigningOut] = useState(false)
  const [revision, setRevision] = useState(0)
  const accountRequest = useRef<AbortController | null>(null)
  const notificationRequest = useRef<AbortController | null>(null)
  const signOutPending = useRef(false)
  useEffect(() => {
    const refreshAccount = () => setRevision(value => value + 1)
    window.addEventListener('ssz:account-updated', refreshAccount)
    return () => window.removeEventListener('ssz:account-updated', refreshAccount)
  }, [])
  useEffect(() => { setQ(params.get('q') ?? '') }, [params])
  useEffect(() => {
    if (signOutPending.current) return
    const controller = new AbortController()
    accountRequest.current = controller
    setAccountError('')
    const load = async () => {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('Session lookup failed')
        let nextAccount = accountFromResponse(await response.json())
        if (controller.signal.aborted) return
        let restored = false
        if (!nextAccount) {
          const response = await fetch('/api/auth/restore-soundcloud', { method: 'POST', signal: controller.signal })
          if (response.status !== 401 && response.status !== 404) {
            if (!response.ok) throw new Error('Session restoration failed')
            nextAccount = accountFromResponse(await response.json())
            restored = nextAccount !== null
          }
        }
        if (controller.signal.aborted || signOutPending.current) return
        setAccount(nextAccount)
        if (!nextAccount) setSignOutError('')
        if (restored) router.refresh()
      } catch {
        if (!controller.signal.aborted) setAccountError('Could not verify your sign-in status. Please try again.')
      } finally {
        if (accountRequest.current === controller) accountRequest.current = null
      }
    }
    void load()
    return () => controller.abort()
  }, [path, router, revision])
  useEffect(() => {
    if (!account) { setUnread(0); setNotificationError(''); return }
    if (signOutPending.current) return
    const controller = new AbortController()
    notificationRequest.current = controller
    setNotificationError('')
    const load = async () => {
      try {
        const response = await fetch('/api/notifications/unread', { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('Activity lookup failed')
        const data: unknown = await response.json()
        if (!data || typeof data !== 'object' || !('count' in data)
          || typeof data.count !== 'number' || !Number.isSafeInteger(data.count) || data.count < 0) throw new Error('Invalid activity response')
        if (!controller.signal.aborted && !signOutPending.current) setUnread(data.count)
      } catch {
        if (!controller.signal.aborted) setNotificationError('Could not update your activity count. Please try again.')
      } finally {
        if (notificationRequest.current === controller) notificationRequest.current = null
      }
    }
    void load()
    return () => controller.abort()
  }, [account, path, revision])
  const signOut = async () => {
    if (signOutPending.current) return
    signOutPending.current = true
    setSigningOut(true)
    setSignOutError('')
    accountRequest.current?.abort()
    notificationRequest.current?.abort()
    try {
      const response = await fetch('/api/auth/sign-out', { method: 'POST' })
      if (!response.ok) throw new Error('Sign-out failed')
      const data: unknown = await response.json()
      if (!data || typeof data !== 'object' || !('ok' in data) || data.ok !== true) throw new Error('Invalid sign-out response')
      setAccount(null)
      setUnread(0)
      setAccountError('')
      setNotificationError('')
      router.push('/')
      router.refresh()
    } catch {
      setSignOutError('Could not sign out. Please try again.')
    } finally {
      signOutPending.current = false
      setSigningOut(false)
      setRevision(value => value + 1)
    }
  }
  const error = signOutError || accountError || notificationError
  const accountControls = account && <>
    <Link href="/notifications" className="shrink-0 text-[10px] font-bold uppercase tracking-[0.08em] text-[#cbd1c9] hover:text-[#d8ff16]">Activity{unread > 0 ? ` ${unread > 99 ? '99+' : unread}` : ''}</Link>
    <Link href={`/artist/${account.slug}`} className="min-w-0 max-w-24 truncate text-xs font-bold uppercase tracking-[0.08em] text-[#d8ff16]">{account.handle}</Link>
    {account.isAdmin && <AdminBadge />}
    <Link href="/settings" className="shrink-0 text-[10px] font-bold uppercase tracking-[0.08em] text-[#cbd1c9] hover:text-[#d8ff16]">Settings</Link>
    <button type="button" onClick={signOut} disabled={signingOut} aria-busy={signingOut} className="shrink-0 text-[10px] font-bold uppercase tracking-[0.08em] text-[#cbd1c9] hover:text-white disabled:opacity-50">{signingOut ? 'Signing out...' : 'Sign out'}</button>
  </>

  return (
    <header className="sticky top-0 z-40 overflow-hidden border-b border-[#4a5149] bg-[#090a0a]/95 shadow-[0_12px_36px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="max-w-6xl mx-auto flex min-h-16 flex-wrap items-center gap-1.5 px-4 py-2 sm:gap-x-4">
        <Link href="/" aria-label="SolidSoundZ home" className="mr-auto flex min-h-11 shrink-0 items-center rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d8ff16]">
          <BrandLogo className="h-8 w-auto min-[360px]:h-10 sm:h-12" priority />
        </Link>
        <nav className="hidden xl:flex items-stretch h-12 gap-1">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} className={`flex items-center px-3 border-b-2 text-xs font-bold uppercase tracking-[0.12em] ${path === l.href ? 'border-[#d8ff16] text-[#d8ff16]' : 'border-transparent text-[#9ea59f] hover:border-[#6d756e] hover:text-white'}`}>{l.label}</Link>
          ))}
        </nav>
        <Link href="/artist-hq" className="hidden lg:block text-[11px] px-3 py-2 border border-[#586055] text-[#d5ddd2] font-bold uppercase tracking-[0.08em] hover:border-[#d8ff16] hover:text-[#d8ff16] whitespace-nowrap">Artist HQ</Link>
        <Link href="/studio" className="hidden lg:block text-[11px] px-3 py-2 border border-[#ff5a36] text-[#ff7b5e] font-bold uppercase tracking-[0.08em] hover:bg-[#ff5a36] hover:text-black whitespace-nowrap">Studio</Link>
        <Link href="/create" className="hidden lg:block text-[11px] px-3 py-2 border border-[#d8ff16] text-[#d8ff16] font-bold uppercase tracking-[0.08em] hover:bg-[#d8ff16] hover:text-black whitespace-nowrap">Create</Link>
        <Link href="/upload" className="shrink-0 text-xs px-2 py-2 bg-[#d8ff16] text-black font-bold uppercase tracking-[0.1em] transition-colors hover:bg-white sm:px-3">Upload</Link>
        {!account && <Link href="/sign-in" className="shrink-0 whitespace-nowrap text-xs text-[#cbd1c9] hover:text-[#d8ff16] font-bold uppercase tracking-[0.1em]">Sign in</Link>}
        <form role="search" className="w-full min-w-0" onSubmit={e => { e.preventDefault(); router.push(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : '/search') }}>
          <input aria-label="Search artists, tracks, genres" value={q} onChange={e => setQ(e.target.value)} placeholder="Search artists, tracks, genres" maxLength={100}
            className="w-full border border-[#3d453f] bg-[#141715]/80 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-[#707870] focus:border-[#d8ff16]" />
        </form>
      </div>
      {account && <nav aria-label="Account" className="max-w-6xl mx-auto flex flex-wrap items-center justify-end gap-3 px-4 pb-2">{accountControls}</nav>}
      {error && <div role="alert" className="max-w-6xl mx-auto flex items-start gap-3 px-4 pb-2 text-xs text-[#ff9d89]">
        <span className="min-w-0 flex-1">{error}</span>
        <button type="button" disabled={signingOut} onClick={signOutError ? signOut : () => setRevision(value => value + 1)} className="shrink-0 font-bold underline disabled:opacity-50">Retry</button>
      </div>}
      <nav className="xl:hidden box-border flex w-full min-w-0 gap-1 px-4 pb-2 overflow-x-auto">
        {[...LINKS, { href: '/create', label: 'Create' }, { href: '/studio', label: 'Studio' }, { href: '/you', label: 'Library' }].map(l => (
          <Link key={l.href} href={l.href} className={`px-3 py-1 border text-xs font-bold uppercase tracking-[0.1em] whitespace-nowrap ${path === l.href ? 'border-[#d8ff16] text-[#d8ff16]' : 'border-[#303630] text-[#9ea59f]'}`}>{l.label}</Link>
        ))}
      </nav>
    </header>
  )
}
