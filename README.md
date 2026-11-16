
# SolidSoundZ - TR/\2HY Platform
SoundCloud power, half the price ($5.99/mo), with Master + Mix Studio + Voloco Lab built in.

## Phase 1 MVP Included
- Upload Dropzone (client-side File API)
- Waveform with Canvas / Wavesurfer.js
- Timed comments (timestamp_ms)
- Clean playback with BYPASS by default

## Quick Start
1. npm install
2. cp .env.example .env
3. npx prisma db push
4. npm run dev -> http://localhost:3000

## Stack
- Next.js 14 App Router
- FastAPI (planned) for audio processing
- Cloudflare R2 for storage (S3 compatible)
- Postgres + Prisma
- Stripe $5.99 Pro plan
- Clerk auth

## Deploy to solidsoundz.vercel.app
- Vercel or Hetzner + Cloudflare
- Set R2 keys in env
- Set Stripe price_id for $5.99 yearly / $7.99 monthly
- Set `REPLICATE_API_TOKEN` to enable AI music generation. `REPLICATE_MODEL` is optional and defaults to Stable Audio Open 1.0.
- Set `STRIPE_WEBHOOK_SECRET` and point Stripe's webhook at `/api/stripe/webhook` so completed Pro subscriptions unlock Creator. Pro includes 10 Creator previews per rolling 30 days.

Built for TR/\2HY
