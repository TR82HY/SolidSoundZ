import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession, passwordMatches } from '@/lib/account'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const email = String(body.email ?? '').trim().toLowerCase().slice(0, 254)
  const password = String(body.password ?? '')
  const user = await db.user.findUnique({ where: { email } })
  if (!user || !(await passwordMatches(password, user.passwordHash))) return NextResponse.json({ error: 'email or password is incorrect' }, { status: 401 })
  await createSession(user.id)
  return NextResponse.json({ handle: user.handle })
}