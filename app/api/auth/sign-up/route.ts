import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession, hashPassword } from '@/lib/account'

const slugify = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'artist'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const email = String(body.email ?? '').trim().toLowerCase().slice(0, 254)
  const password = String(body.password ?? '')
  const name = String(body.name ?? '').trim().slice(0, 40)
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'enter a valid email address' }, { status: 400 })
  if (password.length < 10) return NextResponse.json({ error: 'use at least 10 characters for your password' }, { status: 400 })
  if (!name) return NextResponse.json({ error: 'enter an artist name' }, { status: 400 })
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) return NextResponse.json({ error: 'an account already uses that email' }, { status: 409 })

  const base = slugify(name)
  let suffix = 0
  let handle = name
  let slug = base
  while (await db.user.findFirst({ where: { OR: [{ handle }, { slug }] }, select: { id: true } })) {
    suffix++
    handle = `${name} ${suffix}`.slice(0, 40)
    slug = `${base}-${suffix}`
  }
  const user = await db.user.create({ data: { email, handle, slug, passwordHash: await hashPassword(password), profileClaimed: true } })
  await createSession(user.id)
  return NextResponse.json({ handle: user.handle })
}