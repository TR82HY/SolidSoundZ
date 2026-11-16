import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { db } from './db'

const API = 'https://api.soundcloud.com'
const AUTH = 'https://secure.soundcloud.com/oauth/token'

export class SoundCloudRequestError extends Error {
  constructor(readonly status: number) {
    super(`SoundCloud request failed (${status})`)
    this.name = 'SoundCloudRequestError'
  }
}

export class SoundCloudBusyError extends Error {
  constructor() { super('Another SoundCloud refresh is already in progress.'); this.name = 'SoundCloudBusyError' }
}

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid SoundCloud response.')
  return Object.fromEntries(Object.entries(value))
}

export function soundCloudId(value: unknown, kind: 'users' | 'tracks' | 'playlists'): string {
  const data = record(value)
  if (typeof data.urn === 'string') {
    const match = new RegExp(`^soundcloud:${kind}:(\\d+)$`).exec(data.urn)
    if (match) return match[1]
  }
  if (typeof data.id === 'number' && Number.isSafeInteger(data.id) && data.id > 0) return String(data.id)
  throw new Error(`Invalid SoundCloud ${kind} identifier.`)
}

export async function soundcloudFetch(path: string, token: string, signal?: AbortSignal): Promise<unknown> {
  const endpoint = new URL(path, API)
  if (endpoint.origin !== API || endpoint.username || endpoint.password) throw new Error('Unexpected SoundCloud API host.')
  const response = await fetch(endpoint, {
    headers: { Authorization: `OAuth ${token}`, Accept: 'application/json' },
    cache: 'no-store', signal: signal ?? AbortSignal.timeout(12_000),
  })
  if (!response.ok) throw new SoundCloudRequestError(response.status)
  return response.json()
}

type Tokens = { accessToken: string, refreshToken: string | null }

function encrypt(tokens: Tokens, key: Buffer) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.')
}

function decrypt(value: string, key: Buffer): Tokens {
  const parts = value.split('.')
  if (parts.length !== 3) throw new Error('Invalid stored SoundCloud authorization.')
  const [iv, tag, encrypted] = parts.map(part => Buffer.from(part, 'base64url'))
  const cipher = createDecipheriv('aes-256-gcm', key, iv)
  cipher.setAuthTag(tag)
  const tokens = record(JSON.parse(Buffer.concat([cipher.update(encrypted), cipher.final()]).toString('utf8')))
  if (typeof tokens.accessToken !== 'string' || !tokens.accessToken
    || (tokens.refreshToken !== null && typeof tokens.refreshToken !== 'string')) throw new Error('Invalid stored SoundCloud authorization.')
  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }
}

export async function getSoundCloudAppToken() {
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID
  const secret = process.env.SOUNDCLOUD_CLIENT_SECRET
  if (!clientId || !secret) throw new Error('SoundCloud API credentials are not configured.')
  const key = createHash('sha256').update(`ssz-soundcloud-tokens:${clientId}:${secret}`).digest()
  const id = createHash('sha256').update(`ssz-soundcloud-session:${clientId}:${secret}`).digest('hex')
  try {
    await db.soundCloudApiSession.upsert({ where: { id }, create: { id }, update: {} })
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error
  }
  const existing = await db.soundCloudApiSession.findUniqueOrThrow({ where: { id } })
  const now = new Date()
  if (existing.retryAfter && existing.retryAfter > now) throw new SoundCloudBusyError()
  let saved: Tokens | null = null
  if (existing.encryptedTokens) saved = decrypt(existing.encryptedTokens, key)
  if (saved && existing.expiresAt && existing.expiresAt.getTime() > Date.now() + 60_000) return saved.accessToken

  const lockId = randomUUID()
  const claimed = await db.soundCloudApiSession.updateMany({
    where: { id, AND: [{ OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] }, { OR: [{ retryAfter: null }, { retryAfter: { lte: now } }] }] },
    data: { lockId, lockedUntil: new Date(Date.now() + 35_000) },
  })
  if (!claimed.count) throw new SoundCloudBusyError()
  try {
    const latest = await db.soundCloudApiSession.findUniqueOrThrow({ where: { id } })
    saved = latest.encryptedTokens ? decrypt(latest.encryptedTokens, key) : null
    if (saved && latest.expiresAt && latest.expiresAt.getTime() > Date.now() + 60_000) {
      await db.soundCloudApiSession.updateMany({ where: { id, lockId }, data: { lockId: null, lockedUntil: null } })
      return saved.accessToken
    }
    const exchange = (refreshToken: string | null) => fetch(AUTH, {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(refreshToken ? { grant_type: 'refresh_token', refresh_token: refreshToken } : { grant_type: 'client_credentials' }),
    })
    let response = await exchange(saved?.refreshToken ?? null)
    if (saved?.refreshToken && (response.status === 400 || response.status === 401)) response = await exchange(null)
    if (!response.ok) throw new SoundCloudRequestError(response.status)
    const data = record(await response.json())
    if (typeof data.access_token !== 'string' || !data.access_token || typeof data.expires_in !== 'number'
      || !Number.isFinite(data.expires_in) || data.expires_in <= 60
      || (data.refresh_token !== undefined && typeof data.refresh_token !== 'string')) throw new Error('Invalid SoundCloud token response.')
    const tokens = { accessToken: data.access_token, refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : null }
    const updated = await db.soundCloudApiSession.updateMany({
      where: { id, lockId },
      data: { encryptedTokens: encrypt(tokens, key), expiresAt: new Date(Date.now() + data.expires_in * 1000), retryAfter: null, lockedUntil: null, lockId: null },
    })
    if (!updated.count) throw new SoundCloudBusyError()
    return tokens.accessToken
  } catch (error) {
    await db.soundCloudApiSession.updateMany({ where: { id, lockId }, data: { lockId: null, lockedUntil: null, retryAfter: new Date(Date.now() + 5 * 60_000) } })
    throw error
  }
}
