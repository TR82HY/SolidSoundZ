import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { refreshDueSoundCloud, SOUNDCLOUD_SYNC_INTERVAL } from '@/lib/soundcloudSync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  try {
    const refreshed = await refreshDueSoundCloud()
    const connections = await db.soundCloudSync.findMany({
      where: { enabled: true, user: { profileClaimed: true } }, take: 20, orderBy: { userId: 'asc' },
      select: { syncedAt: true, error: true, nextSyncAt: true },
    })
    return NextResponse.json({
      refreshed, intervalSeconds: SOUNDCLOUD_SYNC_INTERVAL / 1000,
      revision: connections.map(connection => connection.syncedAt?.toISOString() ?? 'pending').join('|'),
      error: connections.find(connection => connection.error)?.error ?? null,
      connected: connections.length > 0,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('SoundCloud refresh status failed.', error instanceof Error ? error.name : 'Unknown error')
    return NextResponse.json({ error: 'Could not check SoundCloud updates. Please try again.' }, { status: 503 })
  }
}
