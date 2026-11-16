export function encodeWav(buf: AudioBuffer, bits: 16 | 24 | 32 = 16): Blob {
  const ch = buf.numberOfChannels, len = buf.length, rate = buf.sampleRate
  const bytes = bits / 8, dataSize = len * ch * bytes
  const view = new DataView(new ArrayBuffer(44 + dataSize))
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); str(8, 'WAVE'); str(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, bits === 32 ? 3 : 1, true) // 3 = IEEE float, 1 = PCM
  view.setUint16(22, ch, true)
  view.setUint32(24, rate, true); view.setUint32(28, rate * ch * bytes, true); view.setUint16(32, ch * bytes, true); view.setUint16(34, bits, true)
  str(36, 'data'); view.setUint32(40, dataSize, true)
  const data = Array.from({ length: ch }, (_, i) => buf.getChannelData(i))
  let o = 44
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) {
    const s = Math.max(-1, Math.min(1, data[c][i]))
    if (bits === 32) view.setFloat32(o, s, true)
    else if (bits === 24) {
      const v = Math.round(s < 0 ? s * 0x800000 : s * 0x7fffff)
      view.setUint8(o, v & 0xff); view.setUint8(o + 1, (v >> 8) & 0xff); view.setUint8(o + 2, (v >> 16) & 0xff)
    } else view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    o += bytes
  }
  return new Blob([view], { type: 'audio/wav' })
}

async function encodeMp3(buf: AudioBuffer, kbps: number): Promise<Blob> {
  const { Mp3Encoder } = await import('@breezystack/lamejs')
  const ch = Math.min(2, buf.numberOfChannels)
  const enc = new Mp3Encoder(ch, buf.sampleRate, kbps)
  const toInt16 = (f: Float32Array) => {
    const out = new Int16Array(f.length)
    for (let i = 0; i < f.length; i++) { const s = Math.max(-1, Math.min(1, f[i])); out[i] = s < 0 ? s * 0x8000 : s * 0x7fff }
    return out
  }
  const left = toInt16(buf.getChannelData(0))
  const right = ch > 1 ? toInt16(buf.getChannelData(1)) : undefined
  const parts: Uint8Array<ArrayBuffer>[] = []
  for (let i = 0; i < left.length; i += 1152) {
    const chunk = enc.encodeBuffer(left.subarray(i, i + 1152), right?.subarray(i, i + 1152))
    if (chunk.length) parts.push(new Uint8Array(chunk))
  }
  parts.push(new Uint8Array(enc.flush()))
  return new Blob(parts, { type: 'audio/mpeg' })
}

export const FORMATS = [
  { id: 'wav16', label: 'WAV 16-bit / 44.1k (CD)', ext: 'wav', rate: 44100 },
  { id: 'wav24', label: 'WAV 24-bit / 48k (HD)', ext: 'wav', rate: 48000 },
  { id: 'wav32', label: 'WAV 32-bit float / 96k (Ultra HD)', ext: 'wav', rate: 96000 },
  { id: 'mp3', label: 'MP3 320 kbps', ext: 'mp3', rate: 44100 },
] as const
export type FormatId = typeof FORMATS[number]['id']

export async function resample(buf: AudioBuffer, rate: number): Promise<AudioBuffer> {
  if (buf.sampleRate === rate) return buf
  const off = new OfflineAudioContext(buf.numberOfChannels, Math.ceil(buf.duration * rate), rate)
  const src = off.createBufferSource()
  src.buffer = buf
  src.connect(off.destination)
  src.start()
  return off.startRendering()
}

export async function exportAudio(buf: AudioBuffer, format: FormatId, name: string, signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Export canceled', 'AbortError')
  const f = FORMATS.find(x => x.id === format)!
  const out = await resample(buf, f.rate)
  if (signal?.aborted) throw new DOMException('Export canceled', 'AbortError')
  const blob = format === 'mp3' ? await encodeMp3(out, 320)
    : encodeWav(out, format === 'wav32' ? 32 : format === 'wav24' ? 24 : 16)
  if (signal?.aborted) throw new DOMException('Export canceled', 'AbortError')
  downloadBlob(blob, `${name}.${f.ext}`)
}

export const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`

export function downloadBlob(blob: Blob, name: string) {
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}

export const baseName = (name: string) => name.replace(/\.[^.]+$/, '')

export function computePeaks(buf: AudioBuffer, count = 200) {
  const step = Math.max(1, Math.floor(buf.length / count))
  const chans = Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i))
  const peaks: number[] = []
  for (let i = 0; i < count; i++) {
    let max = 0
    for (const d of chans) for (let j = i * step, end = Math.min(d.length, j + step); j < end; j += 8) { const v = Math.abs(d[j]); if (v > max) max = v }
    peaks.push(max)
  }
  const top = Math.max(...peaks, 0.001)
  return peaks.map(p => Math.round((p / top) * 1000) / 1000)
}

export async function decodeFile(file: Blob) {
  const ctx = new AudioContext()
  try { return await ctx.decodeAudioData(await file.arrayBuffer()) } finally { ctx.close() }
}

export type PublishMeta = { title: string, genre?: string, description?: string, art?: File | null, artFromUrl?: string | null, scUrl?: string, scPlays?: number, importedTrackId?: string, published?: boolean }

const blobName = (prefix: 'tracks' | 'art', name: string) => `${prefix}/${name.replace(/[^\w.-]/g, '_').slice(-80) || 'file'}`

let directUpload: Promise<boolean> | null = null
const usesDirectUpload = () => (directUpload ??= fetch('/api/upload-config').then(r => r.json()).then(d => !!d.direct).catch(() => false))

// On Vercel, files go straight from the browser to Blob storage (server requests are size-limited); locally they're posted to our API.
export async function publishTrack(file: File, meta: PublishMeta, decoded?: AudioBuffer) {
  const buf = decoded ?? await decodeFile(file).catch(() => null)
  const body = new FormData()
  try {
    if (await usesDirectUpload()) {
      const { upload } = await import('@vercel/blob/client')
      body.append('audioUrl', (await upload(blobName('tracks', file.name), file, { access: 'public', handleUploadUrl: '/api/blob-upload', contentType: file.type })).url)
      if (meta.art) body.append('artUrl', (await upload(blobName('art', meta.art.name), meta.art, { access: 'public', handleUploadUrl: '/api/blob-upload', contentType: meta.art.type })).url)
    } else {
      body.append('file', file)
      if (meta.art) body.append('art', meta.art)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'upload failed'
    return { ok: false, status: /sign in/i.test(msg) ? 401 : 400, id: undefined, url: undefined, error: msg }
  }
  body.append('title', meta.title)
  body.append('duration', String(buf?.duration ?? 0))
  if (buf) body.append('peaks', JSON.stringify(computePeaks(buf)))
  if (meta.genre) body.append('genre', meta.genre)
  if (meta.description) body.append('description', meta.description)
  if (!meta.art && meta.artFromUrl) body.append('artFromUrl', meta.artFromUrl)
  if (meta.scUrl) body.append('scUrl', meta.scUrl)
  if (meta.scPlays) body.append('scPlays', String(meta.scPlays))
  if (meta.importedTrackId) body.append('importedTrackId', meta.importedTrackId)
  body.append('published', String(meta.published !== false))
  const res = await fetch('/api/tracks', { method: 'POST', body })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, id: data.id as string | undefined, url: data.url as string | undefined, error: data.error as string | undefined }
}
