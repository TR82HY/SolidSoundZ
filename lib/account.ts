import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto'
import { promisify } from 'util'
import { cookies } from 'next/headers'
import { db } from './db'

const scrypt = promisify(scryptCallback)
const COOKIE = 'ssz_session'
const SESSION_DAYS = 30

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = await scrypt(password, salt, 64) as Buffer
  return `${salt}:${hash.toString('hex')}`
}

export async function passwordMatches(password: string, stored: string | null) {
  if (!stored) return false
  const [salt, expected] = stored.split(':')
  if (!salt || !expected) return false
  const hash = await scrypt(password, salt, 64) as Buffer
  const expectedBuffer = Buffer.from(expected, 'hex')
  return expectedBuffer.length === hash.length && timingSafeEqual(expectedBuffer, hash)
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000)
  await db.session.create({ data: { userId, tokenHash: tokenHash(token), expiresAt } })
  cookies().set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', expires: expiresAt, path: '/' })
}

export async function deleteSession() {
  const jar = cookies()
  const token = jar.get(COOKIE)?.value
  if (token) await db.session.deleteMany({ where: { tokenHash: tokenHash(token) } })
  clearAccountCookies()
}

export function clearAccountCookies() {
  const jar = cookies()
  for (const name of [COOKIE, 'soundcloud_access_token', 'soundcloud_oauth_state', 'soundcloud_oauth_verifier', 'soundcloud_oauth_account']) {
    jar.set(name, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0, path: '/' })
  }
}

export async function currentAccount() {
  const token = cookies().get(COOKIE)?.value
  if (!token) return null
  const session = await db.session.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } })
  if (!session || session.expiresAt <= new Date()) {
    if (session) await db.session.delete({ where: { id: session.id } })
    return null
  }
  return session.user
}