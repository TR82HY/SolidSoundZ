import { NextResponse } from 'next/server'
import { getArtist } from '@/lib/artist'
import { db } from '@/lib/db'

export async function GET() {
  const artist = await getArtist()
  if (!artist) return NextResponse.json({ count: 0 })
  const count = await db.notification.count({ where: { userId: artist.id, readAt: null } })
  return NextResponse.json({ count })
}