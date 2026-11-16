import { NextResponse } from 'next/server'
import { currentAccount } from '@/lib/account'
import { isSiteAdmin } from '@/lib/access'

export async function GET() {
  const user = await currentAccount()
  return NextResponse.json({ user: user ? { handle: user.handle, slug: user.slug, isAdmin: isSiteAdmin(user) } : null })
}