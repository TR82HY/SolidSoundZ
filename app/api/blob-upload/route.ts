import { NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { getArtist } from '@/lib/artist'
import { blobConfigured } from '@/lib/storage'

const RULES: Record<'tracks' | 'art', { allowedContentTypes: string[], maximumSizeInBytes: number }> = {
  tracks: { allowedContentTypes: ['audio/*'], maximumSizeInBytes: 300 * 1024 * 1024 },
  art: { allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'], maximumSizeInBytes: 5 * 1024 * 1024 },
}

// Issues short-lived tokens so the browser can upload big audio files straight to Vercel Blob.
export async function POST(request: Request) {
  if (!blobConfigured()) return NextResponse.json({ error: 'cloud storage not connected' }, { status: 503 })
  const body = (await request.json()) as HandleUploadBody
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async pathname => {
        if (!(await getArtist())) throw new Error('sign in required')
        const m = pathname.match(/^(tracks|art)\/[\w.-]{1,120}$/)
        if (!m) throw new Error('invalid file name')
        return { ...RULES[m[1] as keyof typeof RULES], addRandomSuffix: true }
      },
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'upload failed' }, { status: 400 })
  }
}
