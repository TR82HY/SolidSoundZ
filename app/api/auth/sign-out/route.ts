import { NextResponse } from 'next/server'
import { deleteSession } from '@/lib/account'

export async function POST() {
  try {
    await deleteSession()
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Sign-out failed', error instanceof Error ? error.name : 'unknown error')
    return NextResponse.json({ error: 'Could not sign out. Please try again.' }, { status: 503 })
  }
}