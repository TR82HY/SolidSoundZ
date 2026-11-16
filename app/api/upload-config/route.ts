import { NextResponse } from 'next/server'
import { blobConfigured } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({ direct: blobConfigured() })
}
