# SolidSoundZ: site-wide comparison and commercial development plan

**Assessment date:** October 13, 2026  
**Comparison target:** SoundCloud's publicly documented and observable product  
**Verdict:** SolidSoundZ has a working music-platform foundation, but is not yet a feature-complete SoundCloud alternative or ready for aggressive paid acquisition.

The most credible opportunity is a focused **original-audio -> browser mastering -> review -> release -> fan support** workflow. Competing on catalog size, distribution reach, or an unverified "half the price" claim is not a defensible starting position.

This is a product, implementation, and commercial-readiness assessment. It is **not** a completed security audit, legal opinion, payment certification, perceptual audio-quality benchmark, or revenue forecast.

## 1. Evidence and limits

Evidence reviewed:

- 20 application page templates, 32 API route files, and 18 Prisma models.
- 22 anonymous production HTTP probes: 21 returned 200; `/settings` returned 404.
- Representative requests covered 19 of the 20 page templates. A public playlist instance was not available in the sample; its implementation was reviewed separately.
- `/api/upload-config` returned `{ "direct": true }`, confirming that production advertises direct Blob uploads. This does not prove a large authenticated upload succeeds.
- The Studio's actual browser-rendered entry screen was inspected. Its empty server-rendered HTML was not incorrectly classified as a broken page.
- Earlier real-browser tests verified native player controls and actual SoundCloud playback, including cross-origin embeds. Those tests do not certify every track, region, device, or future provider change.
- Current official SoundCloud pricing, listener, DJ, and distribution pages were inspected in a browser. Some Help Center requests returned 403, and older creator URLs redirected to the newsroom. Unsupported search-summary claims were not treated as verified facts.
- Payment credentials, paid SoundCloud accounts, real purchases, refunds, bank payouts, and paid generation jobs were not exercised.

Status vocabulary:

| Status | Meaning |
|---|---|
| Live-observed | A public page or response was observed in production. HTTP 200 alone is not a functional pass. |
| Functionally verified | A named user flow has been exercised; the scope and environment matter. |
| Code-present | Implementation exists, but the complete flow has not been proven here. |
| Configuration-dependent | Requires a provider, credentials, billing setup, or other operational prerequisite not verified here. |
| Not found | No implementation was found in the inspected routes/models; this is not a claim about private external systems. |
| Proposed | Future development, not an existing feature. |

## 2. SoundCloud benchmark

### Observed public pricing

The following were displayed on official pages in an English-US browser session. Dollar symbols are reproduced as displayed. Country eligibility, taxes, app-store billing, promotions, and final checkout terms must be checked before publishing a price comparison.

| Product | Observed displayed offer | Important distinction |
|---|---|---|
| Artist | $39 billed yearly; displayed as $3.25/month | Not a verified month-to-month charge. |
| Artist Pro | $99 billed yearly; displayed as $8.25/month | Not a verified month-to-month charge. |
| SoundCloud Go | $4.99/month | Ad-free and offline listening; full catalog and high-quality audio are not included in the displayed comparison. |
| SoundCloud Go+ | $11.99/month | Full catalog, ad-free/offline listening, high-quality audio, and supported DJ integrations. |
| SoundCloud DJ | $19.99/month | Adds offline use inside supported DJ apps. |

Sources: [artist plans][SC1], [listener plans][SC3], [DJ plans][SC4].

The artist page specifically advertises:

- Artist: 3 hours of uploads, 3 track replacements/month, 2 distributed/monetized tracks/month, and a mastering credit.
- Artist Pro: unlimited uploads and monetization, three mastering credits/month, advanced insights, and distribution.

The distribution page advertises delivery to 60+ platforms and a 100% royalty share following its November 2025 change, **with payout-processing fees**. It also advertises fan-support links and a merchandise program. Availability and fulfillment terms for that merchandise program were not independently tested. "Zero platform percentage" is therefore not, by itself, a unique SolidSoundZ advantage. [SC2]

### Product comparison

SoundCloud paid/account-gated workflows were not transactionally re-executed. The benchmark below distinguishes observed official offers from implementation questions.

| Area | SoundCloud benchmark | SolidSoundZ evidence | Competitive conclusion / next gate |
|---|---|---|---|
| Brand and responsive shell | Established cross-platform identity | Shared vector wordmark, browser mark, responsive navigation; record animation added in this batch | Keep the Z readable and motion optional. Brand polish is not a substitute for product reliability. |
| Public listening and track pages | Core product | Live-observed home and track pages; native/global player and real SoundCloud controls previously functionally verified | Maintain regression coverage for playback, navigation, queue, and failures. |
| Discovery and charts | Established recommendation ecosystem; Pro promotion/insights advertised | Live pages; genre-from-likes recommendations and play-based ranking in code | Current recommendations are heuristic, not a demonstrated personalized recommender or guaranteed audience. |
| Following feed | Established social listening workflow | Follow/repost feed exists; actor-based repost selection was fixed | Verify meaningful release ordering and measure repeat listening, not imported totals. |
| Likes, reposts, timed comments | Established social product baseline; not every logged-in action retested | Models/routes/UI present, including anonymous listener identities | Abuse controls, failure feedback, identity merging, and moderation remain launch work. |
| Search | Full catalog search | Case-insensitive text/genre/artist search; literal-backslash handling verified earlier | Add relevance, pagination, typo tolerance, and useful empty states only after query metrics exist. |
| Artist profiles | Established public identity and fan tools | Live-observed profiles, editable profile data, sharing | Investigate duplicate-looking identities and claimed-profile eligibility before scaling discovery. |
| Playlists | Established listener/creator workflow | Playlist model, creation/edit APIs, owner controls, and public page | This batch replaces a divergent public-track mapper with shared visibility/storage/scheduling logic. Preserve playlist order and test all visibility cases. |
| Uploads | Published artist-plan upload allowances | Authenticated upload path, direct Blob mode, 300 MB audio and 5 MB artwork caps | Per-file caps exist; no per-account storage/egress entitlement was found in the upload path. Measure and cap total cost. |
| Drafts and scheduling | Private/scheduled releases are an established capability; current plan gating not re-verified | Draft and scheduled timestamps; opportunistic `publishDueTracks()` sweep | Not a guaranteed wall-clock scheduler. Add an idempotent scheduled worker and release-time tests before selling precise scheduling. |
| Browser audio work | Paid mastering is advertised | Single-buffer browser mastering with EQ, dynamics, saturation, width, A/B, loudness analysis, and export code | A promising workflow wedge. It is not yet a verified multitrack DAW or a proven quality improvement over SoundCloud mastering. |
| AI creation | No equivalent offer established from the reviewed public sources | Pro-gated Replicate integration, 10 previews in a rolling 30-day window, 10-47 second requests | Configuration, actual output quality, provider schema, commercial rights, and unit cost must be verified before selling this benefit. |
| SoundCloud migration | Not a like-for-like competitor capability | OAuth metadata/playlist import and original-file matching | Do not promise transfer of followers, ownership, royalties, or original audio that the API does not provide. |
| Embeds and sharing | Established embed/distribution channel | Shared branding; real SoundCloud cross-origin embed tests passed earlier | A useful opt-in acquisition loop. Maintain permissions, no-autoplay behavior, and track ownership. |
| Library/history | Established saved-listening behavior | Likes/reposts/playlists and listening-history model/UI present | Verify cross-device behavior and all playback transports' history/reporting. |
| Analytics | Advanced insights advertised on Artist Pro | Basic totals, weekly growth, top track, and native play events | Not equivalent to audience geography/referrers/cohort analytics. SoundCloud transport reporting needs specific attention. |
| Creator subscriptions | Artist/Artist Pro bundles | Stripe subscription Checkout and a `User.plan` flag | Billing lifecycle and self-service management are incomplete; see P0 gates below. |
| Fan support and payouts | Fan-support links, royalty payouts, and merchandise program advertised | Stripe Connect Express + destination-charge contributions + ledger UI | Present code does not establish positive platform margin or verified bank-payout reporting. |
| Distribution and royalty accounting | Distribution to 60+ platforms and royalty share advertised | No distribution delivery, collaborator split ledger, or royalty accounting implementation found | Do not label contributions as streaming royalties or promise DSP delivery. Partner rather than build a distributor prematurely. |
| Native mobile/offline/casting | Web, iOS, Android and other platforms advertised; offline listener plans verified in public copy | Responsive web app; no native app/offline-download/DRM/casting implementation found | A responsive website is not native/offline parity. |
| DJ integrations | Supported DJ-app streaming and DJ offline tier advertised | No DJ-service integrations or licensed offline-streaming workflow found | The rotating disc is branding, not a claim of DJ-platform functionality. |
| Account lifecycle | Mature account-management baseline; full competitor settings not audited | Native/SoundCloud sign-in; local logout/restoration fixes; `/settings` currently 404 | Password recovery, verified email, deletion/export, session/device management, and billing controls need explicit scope. |
| Safety, rights, and support | Public legal/help surfaces are visible | No comparable legal/help/report/block/moderation route set found in the inventory | Establish ownership terms, privacy, takedown/reporting, escalation, rate limits, and retention rules before open growth. This is not a completed security review. |

## 3. Commercial blockers: fix before aggressive acquisition

### P0-A. Contribution economics are not yet a business model

Current [contribution creation](../app/api/contributions/route.ts) uses destination charges with `transfer_data.destination` and no `application_fee_amount` or reduced transfer amount.

Stripe's official documentation says destination-charge processing fees, refunds, and chargebacks debit the platform balance. [ST1] Thus:

`platform contribution margin = explicit platform revenue - processing - Connect/payout charges - refunds/chargebacks - operating cost`

With no explicit fee, a contribution can cost the platform money. A subscription could deliberately subsidize this, but that must be modeled and capped; it must not be an accidental promise.

**Decision needed:** choose and disclose a fee/subsidy policy. Options include a transparent application fee, a bounded Pro subsidy, or a reviewed alternative Connect charge model. Do not silently change artist economics.

**Acceptance gate:** test-mode reconciliation proves exactly what the fan pays, what the artist receives, what the platform retains, and who funds processing/refunds/disputes.

### P0-B. A checkout record is not a payout

[Earnings](../app/(site)/earnings/page.tsx) totals come from `Contribution.status`, not Stripe bank-payout confirmation. Pending rows can include abandoned checkout attempts.

This batch changes misleading "Paid out"/"Processing"/royalty wording to contribution-record language and directs users to Stripe for actual settlement and payout status.

**Still required:** a reconciled payment ledger covering paid, pending, expired, failed, refunded, and disputed states, plus duplicate/out-of-order event handling.

### P0-C. Subscription lifecycle is incomplete

[Checkout](../app/api/checkout/route.ts) creates a subscription session. The [webhook](../app/api/stripe/webhook/route.ts) upgrades on `checkout.session.completed` and downgrades on `customer.subscription.deleted`.

The inspected schema has no customer/subscription reference or billing-event ledger. No subscriber billing portal route was found.

Release gates:

- Strict monthly/yearly plan validation and verified display of the actual configured price.
- One intended active subscription per customer; safe repeat checkout.
- Entitlements based on actual subscription/payment state, including delayed payment, delinquency, cancellation, renewal, and recovery.
- Idempotent webhook processing and safe out-of-order delivery.
- Self-service cancellation/payment updates, receipts, refund policy, and reconciliation.
- Test-mode evidence before any real charge. No prices or fee policies were changed in this batch.

### P0-D. Paid Creator generation needs a real provider acceptance test

The [generation route](../app/api/generate/route.ts) defaults to `stability-ai/stable-audio-open-1.0`. Its public Replicate model URL returned 404 during this assessment. That is a validation warning, not proof that the deployed override is broken: `REPLICATE_MODEL` can change the actual model.

Before selling "10 previews":

1. Verify the configured model exists and its input schema matches the request.
2. Produce and download a real result; test failed jobs and provider outages.
3. Validate instrumental/vocal claims and commercial-output licensing.
4. Reserve credits atomically so concurrent requests cannot exceed the budget.
5. Measure actual cost per successful output, including failed/abandoned jobs.
6. Define rolling-window versus billing-month usage clearly.

The UI currently offers "Lyrics + vocals", but passing lyrics inside a prompt is not proof of reliable vocal generation. Do not market that as a guaranteed capability.

### P0-E. Commercial hosting eligibility must be confirmed

The Vercel CLI authorization check on October 13, 2026 confirmed that the active project team is on Hobby.

Vercel's current Hobby documentation restricts Hobby to non-commercial personal use. [V1] Confirm a permitted commercial plan before monetized launch. An upgrade requires owner approval; none was purchased here.

### P0-F. Trust and measurement gaps

- Account/logout fixes are now deployed after local build, route-contract, real local HTTP, and mocked browser failure/race tests. Anonymous production endpoints were verified; signed-in server integration used temporary local accounts, not real production credentials.
- Native play reporting lives in `PlayerProvider.onTimeUpdate`; the SoundCloud progress path updates playback state but does not call that reporting path. Consequently, do not treat current on-platform growth/history as complete across transports.
- Imported SoundCloud play totals are not newly acquired SolidSoundZ listeners or revenue.
- The public Discover sample was dominated by one catalog and duplicate-looking profiles. Its artist query also counts all tracks and does not apply claimed-profile filtering.
- Private-file access semantics, abuse limits, reporting/takedown, privacy, account recovery, and account deletion/export require dedicated tests and policy work.

## 4. Full route coverage

Anonymous HTTP observations are availability checks, not proof of signed-in functionality.

| Surface | Observation | Remaining verification |
|---|---|---|
| `/` | 200; public catalog rendered | Activation, performance and real new-listener metrics |
| `/charts` | 200 | Native-versus-imported metrics, ranking fairness and abuse resistance |
| `/discover` | 200 | Personalization quality, public/claimed artist counts and duplicate identity handling |
| `/stream` | 200; starter feed | Followed-user cohorts, release ordering and sustained activity |
| `/search` | 200 | Relevance, pagination, spelling/genre normalization, latency |
| `/t/[id]` | Representative public track 200 | Owned-upload/download permissions and wider device matrix |
| `/artist/[slug]` | Representative public artist 200 | Editing, claim/link edge cases, public counters |
| `/playlist/[id]` | Template reviewed; no production sample captured | Local visibility/order/scheduling regressions and production sample |
| `/studio` | 200; browser-hydrated entry UI observed | Export fidelity, long-file memory use, loudness/true-peak accuracy and target devices |
| `/create` | 200; Pro upsell and controls visible | Configured provider, real output/license/cost, quota races |
| `/upload` | 200; 300 MB copy; direct-upload config true | Signed-in small/large uploads, failures, resumes, quotas and cleanup |
| `/move` | 200; original-audio requirement explained | Owned catalog import/matching/retry and repeat-import behavior |
| `/you` | 200; guest prompt | Authenticated library/history, playlist creation and drafts |
| `/artist-hq` | 200; guest gate | Private analytics correctness and creator onboarding |
| `/earnings` | 200; guest gate | Sandbox payment/settlement/refund/reconciliation |
| `/notifications` | 200; guest path | Ownership, read/unread, retry and anti-spam behavior |
| `/sign-in`, `/sign-up` | 200 | Recovery, verification, abuse limits and broader device coverage |
| `/settings` | 404 | Build actual account/billing/privacy settings; do not disguise missing features with a redirect |
| `/ad` | 200 | Accurate offer, measured campaign conversion |
| `/embed/[id]` | Representative track 200; real-stream tests previously passed | Maintain copied-code permissions and transport/device regressions |
| `/robots.txt`, `/sitemap.xml` | 200 | Index coverage, canonical/private URL rules and search-console validation |

API inventory covers auth, artist/profile actions, audio delivery, uploads, track interactions, playlists, generation, SoundCloud OAuth/import support, Stripe, contributions, notifications, and autoplay. **It is not a certification of all 32 endpoints.**

## 5. How to outperform in a defensible niche

### Positioning hypothesis

**"Finish, review, and release your original track without juggling five tools."**

Start with independent producers and small artist collectives that release frequently and already bring their own listeners. Do not try to buy your way into SoundCloud-scale discovery.

Potential advantages to validate:

1. **Faster release workflow:** a guided path from original file to measured master, versioned review, artwork/metadata checks, and release.
2. **Client-side processing:** lower server cost and a clear explanation of when a file leaves the device. Do not claim complete offline/privacy guarantees until verified.
3. **Creator-owned relationships:** explicit opt-in fan signup, exportable contacts, and clear consent. Anonymous follows are not permission to email.
4. **Actionable release analytics:** distinguish imported totals, qualified plays here, share-link visits, repeat listeners, and fan-support conversion.
5. **Portable promotion:** reliable branded embeds and useful share pages that earn opt-in attribution, rather than forced audio watermarks.

Do not claim unique mastering quality, guaranteed plays, guaranteed earnings, a full DAW, or native/offline/DJ integration parity without evidence.

### Aggressive but legitimate acquisition experiments

| Experiment | Small initial cohort | Success signal | Stop/adjust rule |
|---|---|---|---|
| Concierge release sprint | 10 independently recruited artists with an imminent release | Original upload -> useful master/review -> shared release; repeat use | Stop selling the workflow if users still need manual rescue for core steps |
| Genre-specific release room | One scene, ~30 verified creators, invited listeners | Repeat creator activity and real listener return, not imported play counts | Fix identity/discovery quality before expanding to another scene |
| Opt-in embed attribution | Participating creators' own sites/newsletters | Attributed visits -> completed signup -> first release | Remove intrusive branding if it reduces creator sharing |
| Referral credits | Small capped group; reward only verified activation or a settled paid conversion | Incremental retained creators at acceptable acquisition cost | Block self-referrals/duplicates; reverse rewards for refunds/abuse |
| Studio-to-release conversion | Existing Studio users who choose to publish | More successful exports become owned published releases | Do not gate a working export behind surprise payment |
| Workflow Pro price test | One clearly described beta offer at a time | Voluntary paid retention and positive contribution margin | Stop acquisition if usage cost/refunds exceed the margin budget |

No scraped contact lists, mass unsolicited messages, fake plays/followers, manufactured reviews, or invented payout claims.

## 6. Revenue model: assumptions, not promises

The current production Stripe price amounts were not retrieved. The following is **illustrative only**, not a price change or a forecast.

Let:

- `P` = net subscription revenue per paid creator/month, excluding collected taxes.
- `C` = per-creator processing, storage/egress, generation, support, and refund reserve.
- `D` = any fan-contribution fee subsidy borne by the platform.
- `F` = fixed operating cost.
- `N` = paying creators.

`Operating contribution = N * (P - C - D) - F`

Illustration with `P = $12`, `C = $4`, `D = $0`, `F = $500`:

| Paying creators | Monthly subscription revenue | Variable costs | Fixed budget | Operating contribution |
|---:|---:|---:|---:|---:|
| 50 | $600 | $200 | $500 | -$100 |
| 100 | $1,200 | $400 | $500 | $300 |
| 250 | $3,000 | $1,000 | $500 | $1,500 |

These figures exclude acquisition spending, founder compensation, taxes, and unmodeled liabilities. They are not profit predictions. If `C` rises to $10 or contribution subsidies are uncapped, the model changes dramatically.

At an $8 pre-fixed-cost contribution, a $24 acquisition cost implies a three-month payback **only if the customer remains paid and those costs are real**. Measure retention before using lifetime-value claims.

Track:

- Actual active subscriptions and normalized recurring revenue, not simply the number of `plan = pro` users.
- Cohort activation, paid conversion, retained paid creators, cancellations and failed payments.
- Provider cost per successful generation and cost of failures.
- Stored bytes, streamed bytes and request costs per creator and listening hour.
- Contribution processing/refund/dispute costs separately from creator receipts.
- Support time and abuse/moderation workload.

Do not increase paid acquisition until there is a measured positive margin, a refund/abuse buffer, and a repeatable activation path.

## 7. Development sequence and acceptance gates

Time boxes below are planning hypotheses for a focused small team, not delivery promises.

### Phase 0: commercial correctness and reliability

- Finish the current account, playlist visibility, motion, and truthful-copy release checks.
- Verify permitted commercial hosting, provider configuration and actual published pricing.
- Implement the subscription/payment ledger, lifecycle handling, portal, and reconciliation gates.
- Choose the contribution fee/subsidy policy explicitly.
- Add ownership/terms/privacy/support/takedown and account-recovery/deletion paths.
- Instrument qualified plays consistently across native and SoundCloud transports; keep imported counts separate.

**Exit:** no unresolved P0 commercial blocker; sandbox payment lifecycle and primary account/upload/playback journeys pass.

### Phase 1: a release workflow people return to

- Original and mastered versions with clear provenance.
- Private, revocable review links with explicit access semantics and timestamped feedback.
- Release checklist, reliable scheduled job, and retryable upload/publish states.
- Useful share page, accurate metadata, and opt-in fan capture.

**Exit:** observe design partners completing a release without assistance; measure time-to-first-value and repeat use.

### Phase 2: package recurring value

- Price-test workflow value, not an unverified comparison discount.
- Candidate paid benefits: bounded storage/version history, batch workflows, review/collaboration, deeper first-party release analytics, and clearly capped provider credits.
- Keep entitlements, limits, cancellation and billing terms visible.

**Exit:** settled paid conversions, retained cohorts, measured usage costs, and positive contribution margin.

### Phase 3: scale one proven channel

- Expand the best-performing creator/scene cohort.
- Add capped referral/partner programs with fraud and refund controls.
- Consider distribution partnerships, integrations, or mobile investment only when retained demand justifies their licensing and support cost.

**Exit:** repeatable acquisition economics, sufficient creator supply, and stable listener retention. Do not scale based on imported catalog counts.

## 8. This implementation batch versus future work

Implemented in the working copy:

- Original spinning DJ-record artwork behind the stationary Z in both shared SVG assets.
- Eight-second rotation behind a fixed Z, plus an explicit static picture source for reduced-motion users. Browser tabs may display a static icon frame depending on browser support.
- Removal of unsupported comparative price claims and misleading payout/royalty labels.
- Clearer distinction between Studio monitoring and export levels.
- Public playlist cards routed through shared visibility, scheduling, storage, and waveform handling.
- Previously pending account/logout error and stale-response handling, with route-contract, real local HTTP, and mocked browser failure/race/form checks.

Not silently implemented or purchased:

- New subscription prices, contribution fees, hosting upgrades, paid ads, paid model calls, real payment tests, or new recurring charges.
- Distribution, royalty splits, native apps, offline/DJ licensing, complete moderation/legal workflows, or a full multitrack DAW.

Local validation for this batch passed: the full build; 27 route-contract runner results; 8 real local account/financial-page HTTP results; the playlist visibility/order/scheduling/interaction regression; 27 mocked browser account/form/failure/race scenarios; and rotation, fixed-Z, centered-disc and reduced-motion checks for both SVGs. Test records and browser mocks were removed.

Production rollout was verified on October 13, 2026 at [SolidSoundZ](https://solidsoundz.vercel.app), deployment `solidsoundz-j2sxul2xv-swnelson26-4729.vercel.app`. The local and Vercel builds passed. Fifteen live runner results covered the four SVG assets, public routes, anonymous account behavior, and the report's non-public URL. Edge verified actual header-image pixel movement, fixed-Z/centered rotation, a pixel-stable reduced-motion source, and responsive sizing at seven widths. Static and animated artwork geometry matches.

**This completes the refinement batch, not the entire product. The commercial launch gates above remain, including the confirmed Hobby hosting plan and unresolved billing/provider/measurement decisions.**

## 9. Owner decisions required before monetized launch

| Decision | Required input |
|---|---|
| Contribution economics | Fee/subsidy policy, supported countries/currencies, refund/dispute responsibility |
| Paid offer | Approved price, billing cadence, included value/limits, cancellation/refund terms |
| Hosting | Confirmation of a commercially permitted plan and spending alerts |
| Generation | Approved provider/model, commercial rights, budget and failure-credit policy |
| Growth | Initial creator niche, outreach consent, acquisition budget and measurement period |
| Trust | Terms/privacy/rights policies, support ownership, abuse escalation and retention/deletion rules |

## Sources and code evidence

Official sources observed:

- [SC1: Artist plans and annual offers][SC1]
- [SC2: Distribution, royalty-share terms, fan support and merchandise][SC2]
- [SC3: Go and Go+ listener offers][SC3]
- [SC4: DJ offer and supported-app/offline distinctions][SC4]
- [ST1: Stripe destination-charge fee/refund/chargeback responsibility][ST1]
- [V1: Vercel Hobby limits and non-commercial-use restriction][V1]
- [R1: Default Replicate model URL checked; returned 404][R1]

Relevant implementation:

- [Public track visibility, scheduling and discovery helpers](../lib/queries.ts)
- [Discover](../app/(site)/discover/page.tsx), [Charts](../app/(site)/charts/page.tsx), [Playlists](../app/(site)/playlist/[id]/page.tsx)
- [Player](../components/player/PlayerProvider.tsx), [SoundCloud transport](../components/player/SoundCloudWidget.tsx), [Embeds](../components/EmbedPlayer.tsx)
- [Studio](../components/studio/Studio.tsx), [DSP chain](../lib/studioChain.ts), [Loudness](../lib/loudness.ts)
- [Upload](../app/api/tracks/route.ts), [Direct-upload configuration](../app/api/upload-config/route.ts)
- [Creator UI](../components/CreateTrack.tsx), [Generation API](../app/api/generate/route.ts)
- [Checkout](../app/api/checkout/route.ts), [Contributions](../app/api/contributions/route.ts), [Stripe webhook](../app/api/stripe/webhook/route.ts)
- [Schema](../prisma/schema.prisma), [Play reporting](../app/api/tracks/[id]/play/route.ts)

[SC1]: https://soundcloud.com/getstarted/pricing/
[SC2]: https://soundcloud.com/distribution/all-in-one/
[SC3]: https://checkout.soundcloud.com/go
[SC4]: https://checkout.soundcloud.com/dj
[ST1]: https://docs.stripe.com/connect/destination-charges.md?platform=web&ui=stripe-hosted
[V1]: https://vercel.com/docs/plans/hobby
[R1]: https://replicate.com/stability-ai/stable-audio-open-1.0
