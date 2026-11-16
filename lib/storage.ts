import { mkdir, writeFile, stat } from 'fs/promises'
import { createReadStream } from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { put } from '@vercel/blob'
import { uploadToR2 } from './r2'

const STORAGE_DIR = path.join(process.cwd(), 'storage')
export const KEY_PATTERN = /^(tracks|art)\/[\w.-]+$/

export const r2Configured = () => {
  const e = process.env.R2_ENDPOINT
  return !!e && !/PASTE_|\.\.\.|<account>/.test(e) && !!process.env.R2_ACCESS_KEY && !/PASTE_|\.\.\./.test(process.env.R2_ACCESS_KEY)
}

export const blobConfigured = () => !!process.env.BLOB_READ_WRITE_TOKEN

// Public Vercel Blob URLs; anything else is rejected when a client hands us a URL.
export const BLOB_URL = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/(tracks|art)\/[\w.\-]+$/i

// Vercel Blob when connected, else Cloudflare R2, else the local ./storage folder.
// Returns a public URL for hosted storage, or null when served through /api/audio.
export async function saveFile(key: string, body: Buffer, contentType: string): Promise<string | null> {
  if (!KEY_PATTERN.test(key)) throw new Error('bad key')
  if (blobConfigured()) return (await put(key, body, { access: 'public', contentType, addRandomSuffix: true })).url
  if (r2Configured()) { await uploadToR2(key, body, contentType); return null }
  const file = path.join(STORAGE_DIR, key)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, body)
  return null
}

export async function localFile(key: string) {
  if (!KEY_PATTERN.test(key)) return null
  const file = path.join(STORAGE_DIR, key)
  if (!file.startsWith(STORAGE_DIR + path.sep)) return null
  try {
    const s = await stat(file)
    return { file, size: s.size }
  } catch {
    return null
  }
}

export const streamFile = (file: string, start?: number, end?: number) =>
  Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream

export const audioUrl = (key: string) => `/api/audio/${key}`
export const artUrl = (key: string | null) => key ? `/api/audio/${key}` : null

export const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
export const imageTypeForKey = (key: string) => Object.keys(IMAGE_TYPES).find(t => key.endsWith(`.${IMAGE_TYPES[t]}`)) ?? 'application/octet-stream'
