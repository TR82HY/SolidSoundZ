---
name: review-pitfalls
description: "Review a file, folder, or uncommitted changes against SolidSoundZ's known pitfalls (auth, track visibility, notifications, case sensitivity, storage, schema)"
disable-model-invocation: true
argument-hint: "<file or folder path> (leave blank to review uncommitted changes)"
---
# Review against repo pitfalls

Target: ${input:target:file or folder path to review}. If no target was given, run `git diff` and `git diff --staged` to find the changed files and review those instead.

Check the target against the conventions in [AGENTS.md](../../AGENTS.md), focused on the pitfalls below. Skip any item that doesn't apply (e.g. no notification code in this change) — don't pad the report with items that aren't relevant.

## Checklist

1. **Auth** — sign-in state resolved via `getArtist()` (`lib/artist.ts`) or `currentAccount()` (`lib/account.ts`). Flag any direct call to Clerk's `auth()`/`currentUser()`.
2. **Track visibility** — public track reads go through `lib/queries.ts` (`listTracks`, `trendingTracks`, `getTrackCard`, `relatedTracks`, `feedTracks`). Flag raw `db.track.findMany`/`findUnique`/`findFirst` calls outside that file — they skip the `published` filter and the `publishDueTracks()` sweep.
3. **Self-notifications** — any new like/repost/comment/follow action checks the actor isn't the content owner before calling `db.notification.create`.
4. **Case sensitivity** — Prisma `contains`/`startsWith`/`equals` filters on user-typed text (search, handles, titles) include `mode: 'insensitive'`. Ignore false-positive `tsc --noEmit` errors on these lines — the local SQLite client doesn't type `mode`, but it's required and correct for the real Postgres build.
5. **Storage backend** — upload/download code goes through `lib/storage.ts`'s `saveFile()` fallback chain (Vercel Blob → R2 → local), and handles both a returned URL and `null`, rather than assuming one backend.
6. **Prisma schema** — no hand-edits to the `datasource` block in `prisma/schema.prisma` (managed by `scripts/prisma-provider.mjs`); no `@unique` added to a field on a table that may already have production rows without checking for duplicates first.

## Output format

One section per affected file:

```
### path/to/file.ts
- ✅ Auth: uses getArtist()
- ❌ Track visibility (line 42): raw db.track.findMany, bypasses published filter — use queries.ts helper instead
```

Don't edit any files — this is a review only. If the user wants fixes applied after seeing the report, do that as a normal follow-up turn.
