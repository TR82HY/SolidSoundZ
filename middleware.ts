import { authMiddleware } from '@clerk/nextjs'
import { NextResponse } from 'next/server'

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''
const secretKey = process.env.CLERK_SECRET_KEY ?? ''
const hasClerkKeys = /^pk_(live|test)_/.test(publishableKey) && /^sk_(live|test)_/.test(secretKey)
const clerkEnabled = process.env.ENABLE_CLERK_MIDDLEWARE === 'true' && hasClerkKeys

// Every page is browsable signed-out; APIs that change an artist's data check getArtist() themselves.
const clerkMiddleware = authMiddleware({
  publicRoutes: ['/(.*)'],
})

export default clerkEnabled ? clerkMiddleware : () => NextResponse.next()

// /embed is skipped so third-party iframes never hit Clerk's auth handshake.
export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next|embed).*)', '/', '/(api|trpc)(.*)'],
}
