import { cookies } from 'next/headers'

const COOKIE = 'ssz_lid'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// Anonymous listener id (httpOnly cookie) used for likes/follows until real accounts exist.
// Creating requires a route handler or server action, where cookies can be set.
export function listenerId(create: true): string
export function listenerId(create?: false): string | null
export function listenerId(create = false) {
  const jar = cookies()
  const existing = jar.get(COOKIE)?.value
  if (existing && UUID.test(existing)) return existing
  if (!create) return null
  const id = crypto.randomUUID()
  jar.set(COOKIE, id, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 730, path: '/' })
  return id
}
