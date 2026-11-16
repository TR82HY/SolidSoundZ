'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function AccountForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const signUp = mode === 'sign-up'
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) })
      const data: unknown = await response.json()
      if (!response.ok) {
        setError(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' && data.error
          ? data.error : 'Could not continue. Please try again.')
        return
      }
      if (!data || typeof data !== 'object' || !('handle' in data) || typeof data.handle !== 'string' || !data.handle) {
        setError('Could not confirm your sign-in. Please try again.')
        return
      }
      router.push('/you'); router.refresh()
    } catch {
      setError('Could not complete your request. Please try again.')
    } finally { setBusy(false) }
  }
  return <main className="min-h-screen flex items-center justify-center px-4">
    <form onSubmit={submit} className="w-full max-w-sm border border-[#586055] bg-[#111511] p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#d8ff16]">SolidSoundZ account</p>
      <h1 className="mt-2 text-4xl">{signUp ? 'Claim your artist page.' : 'Welcome back.'}</h1>
      {signUp && <label className="mt-6 block text-sm font-bold">Artist name<input required autoComplete="nickname" value={name} onChange={event => setName(event.target.value)} maxLength={40} className="mt-2 w-full border border-[#4c554b] bg-[#090b09] px-3 py-3 text-white outline-none focus:border-[#d8ff16]" /></label>}
      <label className="mt-4 block text-sm font-bold">Email<input type="email" required autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} className="mt-2 w-full border border-[#4c554b] bg-[#090b09] px-3 py-3 text-white outline-none focus:border-[#d8ff16]" /></label>
      <label className="mt-4 block text-sm font-bold">Password<input type="password" required autoComplete={signUp ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} minLength={10} className="mt-2 w-full border border-[#4c554b] bg-[#090b09] px-3 py-3 text-white outline-none focus:border-[#d8ff16]" /></label>
      {error && <p role="alert" className="mt-4 text-sm text-[#ff9d89]">{error}</p>}
      <button disabled={busy} className="mt-6 w-full bg-[#d8ff16] px-4 py-3 text-sm font-bold uppercase tracking-[0.1em] text-black disabled:opacity-40">{busy ? 'Please wait...' : signUp ? 'Create account' : 'Sign in'}</button>
      <p className="mt-4 text-sm text-[#b8c1b6]">{signUp ? 'Already have an account?' : 'New to SolidSoundZ?'} <Link href={signUp ? '/sign-in' : '/sign-up'} className="text-[#d8ff16] underline">{signUp ? 'Sign in' : 'Create one'}</Link></p>
      <a href="/api/soundcloud/connect" className="mt-6 block border border-[#ff8b72] px-4 py-3 text-center text-sm font-bold text-[#ff8b72]">Continue with SoundCloud</a>
    </form>
  </main>
}