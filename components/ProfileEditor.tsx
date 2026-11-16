'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'

type Props = { id: string, handle: string, slug: string, bio: string | null, location: string | null, avatarUrl: string | null }

export default function ProfileEditor({ id, handle, slug, bio, location, avatarUrl }: Props) {
  const router = useRouter()
  const formId = useId()
  const [preview, setPreview] = useState(avatarUrl)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState(handle)
  const [text, setText] = useState(bio ?? '')
  const [place, setPlace] = useState(location ?? '')
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const objectUrl = useRef<string | null>(null)
  const uploadedUrl = useRef<string | null>(null)
  const pending = useRef(false)
  const releasePreview = () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); objectUrl.current = null }
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current) }, [])
  const changed = () => { setSaved(false); setError('') }

  const pick = (nextFile?: File | null) => {
    if (!nextFile || pending.current) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(nextFile.type)) { setError('Avatar must be JPG, PNG or WEBP.'); return }
    if (!nextFile.size || nextFile.size > 5 * 1024 * 1024) { setError('Choose a non-empty avatar image up to 5 MB.'); return }
    releasePreview()
    objectUrl.current = URL.createObjectURL(nextFile)
    uploadedUrl.current = null
    setFile(nextFile); setPreview(objectUrl.current); setRemoveAvatar(false); changed()
  }

  const save = async () => {
    if (pending.current) return
    if (!name.trim()) { setError('Enter an artist name.'); return }
    pending.current = true
    setBusy(true); setError(''); setSaved(false)
    const body = new FormData()
    body.append('profileId', id); body.append('handle', name.trim()); body.append('bio', text); body.append('location', place)
    try {
      if (removeAvatar) body.append('removeAvatar', 'true')
      else if (file) {
        const response = await fetch('/api/upload-config', { cache: 'no-store' })
        if (!response.ok) throw new Error('Could not check avatar storage. Please retry.')
        const config: unknown = await response.json()
        if (!config || typeof config !== 'object' || !('direct' in config) || typeof config.direct !== 'boolean') throw new Error('Avatar storage returned an invalid response. Please retry.')
        if (config.direct) {
          if (!uploadedUrl.current) {
            const { upload } = await import('@vercel/blob/client')
            const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'
            const uploaded = await upload(`art/avatar-${id}-${Date.now()}.${ext}`, file, { access: 'public', handleUploadUrl: '/api/blob-upload', contentType: file.type })
            uploadedUrl.current = uploaded.url
          }
          body.append('avatarUrl', uploadedUrl.current)
        } else body.append('avatar', file)
      }
      const response = await fetch('/api/artists/me', { method: 'PATCH', body })
      const data: unknown = await response.json()
      if (!response.ok) throw new Error(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'Could not save your profile. Please retry.')
      if (!data || typeof data !== 'object' || !('ok' in data) || data.ok !== true || !('profile' in data)) throw new Error('Your save could not be confirmed. Reload settings before trying again.')
      const profile = data.profile
      if (!profile || typeof profile !== 'object' || !('id' in profile) || profile.id !== id
        || !('handle' in profile) || typeof profile.handle !== 'string' || !('avatarUrl' in profile) || profile.avatarUrl !== null && typeof profile.avatarUrl !== 'string'
        || !('bio' in profile) || profile.bio !== null && typeof profile.bio !== 'string'
        || !('location' in profile) || profile.location !== null && typeof profile.location !== 'string') throw new Error('Your save returned incomplete profile data. Reload settings to check it.')
      setName(profile.handle); setText(profile.bio ?? ''); setPlace(profile.location ?? ''); setPreview(profile.avatarUrl)
      releasePreview(); uploadedUrl.current = null
      setFile(null); setRemoveAvatar(false); setSaved(true)
      window.dispatchEvent(new Event('ssz:account-updated'))
      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save your profile. Your edits are still here.')
    } finally { pending.current = false; setBusy(false) }
  }

  return <section aria-labelledby={`${formId}-heading`} className="rounded-xl border border-[#394039] bg-[#111511] p-4 sm:p-6">
    <h2 id={`${formId}-heading`} className="text-2xl text-[#d8ff16]">Edit profile</h2>
    <p className="mt-1 text-sm text-[#aaa]">Update your public artist name, photo, bio and location. Your profile link and track links stay the same.</p>
    <form onSubmit={event => { event.preventDefault(); void save() }} className="mt-5">
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <legend className="sr-only">Public profile details</legend>
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" aria-label="Choose profile photo" onClick={() => input.current?.click()} className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#586055] bg-[#222] text-sm font-bold text-[#d8ff16]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : 'Add photo'}
          </button>
          <div className="min-w-0 space-y-2">
            <label className="block text-sm font-bold text-[#ddd]" htmlFor={`${formId}-avatar`}>Profile photo</label>
            <p id={`${formId}-avatar-help`} className="text-xs text-[#aaa]">JPG, PNG or WEBP, up to 5 MB.</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => input.current?.click()} className="min-h-9 text-xs font-bold text-[#d8ff16] underline">Choose photo</button>
              {preview && <button type="button" onClick={() => { releasePreview(); uploadedUrl.current = null; setPreview(null); setFile(null); setRemoveAvatar(true); changed() }} className="min-h-9 text-xs text-[#ccc] underline">Remove photo</button>}
            </div>
          </div>
          <input ref={input} id={`${formId}-avatar`} type="file" accept="image/jpeg,image/png,image/webp" aria-describedby={`${formId}-avatar-help`} className="hidden" onChange={event => { pick(event.target.files?.[0]); event.target.value = '' }} />
        </div>
        <label className="block text-sm font-bold text-[#ddd]">Artist name
          <input value={name} onChange={event => { setName(event.target.value); changed() }} required maxLength={40} autoComplete="nickname" className="mt-1 min-h-11 w-full rounded border border-[#586055] bg-[#090d09] px-3 py-2 text-sm text-white" />
        </label>
        <label className="block text-sm font-bold text-[#ddd]">Bio
          <textarea value={text} onChange={event => { setText(event.target.value); changed() }} maxLength={500} rows={3} placeholder="Tell listeners about your music" className="mt-1 w-full rounded border border-[#586055] bg-[#090d09] px-3 py-2 text-sm text-white placeholder:text-[#899185]" />
          <span className="mt-1 block text-xs font-normal text-[#aaa]">{text.length}/500 characters</span>
        </label>
        <label className="block text-sm font-bold text-[#ddd]">Location (optional)
          <input value={place} onChange={event => { setPlace(event.target.value); changed() }} maxLength={100} placeholder="City, country" className="mt-1 min-h-11 w-full rounded border border-[#586055] bg-[#090d09] px-3 py-2 text-sm text-white placeholder:text-[#899185]" />
        </label>
        <p className="break-words text-xs text-[#aaa]">Profile link: <Link href={`/artist/${slug}`} className="text-[#d8ff16] underline">/artist/{slug}</Link></p>
        <button type="submit" disabled={busy || !name.trim()} className="min-h-11 rounded bg-[#d8ff16] px-4 py-2 text-sm font-bold text-black disabled:opacity-50">{busy ? 'Saving profile...' : 'Save profile'}</button>
      </fieldset>
      {error && <p role="alert" className="mt-3 text-sm text-[#ffb9a8]">{error}</p>}
      {saved && <p role="status" className="mt-3 text-sm text-[#d8ff16]">Profile saved.</p>}
    </form>
  </section>
}
