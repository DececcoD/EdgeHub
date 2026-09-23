# EdgeHub

Read-only sports-betting market-intelligence SaaS. Compares licensed sportsbook prices, converts odds into comparable probabilities, explains opportunity and risk, and lets users track bets and bankroll performance. **EdgeHub never places wagers, holds funds, or guarantees results.**

Built from `EdgeHub_Product_Requirements_Document.docx` (v1.0, Sep 16 2026).

## Status

This is a **working prototype**, not the full 12-week MVP the PRD specs. Everything runs against seeded, deterministic mock data instead of a live odds provider, real auth, real billing, or a live database — but every screen, calculation, and gate is real, wired end-to-end, and ready to have a live data source dropped in behind it.

What's real:
- The full calculation engine (Section 6) - odds conversion, no-vig, edge, EV, Kelly with the mandatory 2%-bankroll cap, CLV, ROI, drawdown, Opportunity Score, freshness gating. **Every Appendix B golden vector passes exactly.**
- The Postgres schema (`prisma/schema.prisma`, Section 8), validated and ready to migrate.
- All 9 in-app screens (Dashboard, Markets, Opportunities, Analyzer, Tracker, Portfolio, Alerts, Learn, Account) plus Admin and the full public site (landing, pricing, FAQ, methodology, responsible-use, privacy, terms, calculator).
- Freshness gating end-to-end: stale/partial/mapping-review/unavailable quotes are excluded from ranking, never shown as current.
- AI explanations (Section 9) with a real evidence contract, schema validation, and a deterministic fallback template so nothing ever reaches the user unvalidated.
- Plan entitlements (Free/Pro/Elite) enforced on every quota-bearing action (AI calls, tracked bets, alerts, exports).
- CSV import with a validation report that rejects bad rows without dropping good ones (TRK-06), and CSV export.

What's mocked and clearly marked as such in code comments:
- **Odds data (what the running app reads from)**: seeded, deterministic fixtures (`lib/mock/store.ts`) standing in for a licensed provider. A "Simulate market tick" button on Markets re-quotes a sample of outcomes and recomputes consensus/edge/score, so the freshness-pulse/tick-flash UI has something honest to react to - and now pushes that update live to every open tab/window via Server-Sent Events, not just the tab that clicked the button. See "Real-time push" below.
- **Auth**: an in-memory, no-password session (`lib/auth/`) standing in for Supabase Auth/Clerk. Resets on server restart.
- **Billing**: plan switching is a direct mock PATCH. Real Stripe Checkout/Portal/webhook integration is built - see "Real billing (Stripe)" below.
- **AI**: runs a deterministic evidence-grounded template unless `OPENAI_API_KEY` is set, in which case it calls OpenAI and falls back to the template on any schema-validation failure.

**Odds data (the write side, already built, not yet wired to the running app)**: a real ingestion pipeline against The Odds API's actual documented v4 schema lives in `lib/providers/the-odds-api/` (client + normalizer, fully unit-tested against fixture JSON matching their real response shape) and `lib/ingest/` (identity resolution with a mapping-exception queue, ingestion orchestration writing to the Postgres schema). Run it via `npm run ingest -- --league nfl` once `DATABASE_URL` points at a real, migrated + seeded (`npm run db:seed`) Postgres instance and `ODDS_PROVIDER_API_KEY` is real. **What this doesn't do yet:** recompute consensus/edge/opportunity scores or serve reads - the app's screens still read from `lib/mock/store.ts`'s in-memory data regardless of whether this pipeline has run. Porting the read-side query layer to Postgres is the next piece of this swap, not included here.

## Getting started

```bash
npm install
npm test        # 84 tests: golden vectors, mock store invariants, CSV validator, AI schema, odds-provider adapter + identity resolution
npm run dev      # http://localhost:3000
```

No environment variables are required to run the app - it's fully usable out of the box with the seeded `demo@edgehub.app` account (log in with that email, no password, on `/login`), or sign up fresh.

## Moving off mock data

Each integration point is isolated so you can swap it without touching callers:

| Concern | Mock implementation | Swap in |
|---|---|---|
| Odds data | `lib/mock/store.ts` | Both sides now built: write side in `lib/providers/the-odds-api/` + `lib/ingest/` (run via `npm run ingest`), read side in `lib/db/queries.ts`. Set `USE_MOCK_DATA=false` once `DATABASE_URL` points at a real, migrated + seeded Postgres instance - every screen and API route already reads through `lib/data-source.ts`, the single switch between the two. |
| Auth | `lib/auth/user-store.ts` | Real Clerk integration built: `middleware.ts`, `lib/auth/providers/clerk.ts`, webhook sync at `app/api/webhooks/clerk/`. Set `AUTH_PROVIDER=clerk` **and** `NEXT_PUBLIC_AUTH_PROVIDER=clerk` (both - one drives server session resolution, the other drives which sign-in/sign-up UI renders) plus real Clerk keys. See "Real auth" below for what's actually wired vs. still needed. |
| Billing | `lib/billing/entitlements.ts` + `/api/v1/account/plan` | Real Stripe Checkout/Portal/webhook built: `lib/billing/checkout.ts`, `app/api/webhooks/stripe/`. Set `BILLING_PROVIDER=stripe` **and** `NEXT_PUBLIC_BILLING_PROVIDER=stripe` (same client/server split as auth) plus real Stripe keys. See "Real billing" below. |
| AI | `lib/ai/explain.ts` | Already calls OpenAI when `OPENAI_API_KEY` is set - see `.env.example` |
| Database | `prisma/schema.prisma` | Point `DATABASE_URL` at Postgres, run `npm run db:migrate:deploy` (applies the committed initial migration) then `npm run db:seed`. See `DEPLOYMENT.md` - this exact sequence has been run for real against a containerized Postgres, not just type-checked. |

See `.env.example` for every variable and what it unlocks.

**On `USE_MOCK_DATA=false`:** consensus/edge/EV/score are computed at *read time* directly from `CurrentOdds`, using the exact same `lib/calc/*` functions the mock path uses. `ConsensusSnapshot`/`OpportunitySnapshot` are separately persisted as a lineage/audit trail after each ingestion run (`lib/ingest/recompute.ts`) but not read back here - a deliberate, stated scope boundary (see `lib/db/queries.ts`'s header), not an oversight: recomputing at read time is fully correct and always at least as fresh, just not the "compute once at ingestion, read cheaply forever" architecture a higher-traffic production system should eventually move to. This path **has** been smoke-tested against a real, locally containerized Postgres - migrated, seeded, and queried with `USE_MOCK_DATA=false` (see `DEPLOYMENT.md`) - though not yet with actual odds data flowing through it, since that needs a real `ODDS_PROVIDER_API_KEY`.

### Real auth (Clerk)

Uses `@clerk/nextjs@6.39.7` specifically - not the current major (`7.x`), which requires Next.js 15+/16+. Upgrading Next.js as a side effect of adding auth would have been a much bigger, riskier change than asked for, so this pins to the last version compatible with this project's Next 14. That also means the API used here is Clerk's pre-"Core 3" custom-flow API (`signUp.create()` / `prepareEmailAddressVerification()` / `attemptEmailAddressVerification()` / `setActive()`), verified directly against the installed package's type definitions - not Clerk's newest documented API, which uses different method names (`signUp.password()` / `.finalize()`) and only ships in the Next-15+ major.

What's built: `middleware.ts` (route protection, no-op in mock mode), `lib/auth/providers/clerk.ts` (server-side session resolution via `auth()`, with a defensive fallback for the window before a webhook lands), `app/api/webhooks/clerk/` (`user.created`/`user.updated` sync into the local `users` table), `lib/db/user-profile.ts` (the Postgres-backed counterpart to `lib/auth/user-store.ts`), and full custom sign-up (age gate → email/password → email-code verification → preferences → worked example) and sign-in flows in `components/onboarding/*-clerk.tsx`, styled identically to the mock flow rather than Clerk's generic prebuilt components.

**Not integration-tested against a real Clerk project** - there's no way to create one or obtain live keys in this environment. Verified by: type-checking every call against the actual installed SDK's type definitions (not memory/docs), and a full Playwright smoke test confirming mock mode's behavior is completely unchanged (middleware no-ops, mock sign-in/sign-up/logout components render and the full logout→login round trip works exactly as before).

**Still needed before this can go live:** a real Clerk project + keys, `CLERK_WEBHOOK_SIGNING_SECRET` from that project's webhook config pointed at `/api/webhooks/clerk`, and a decision on what happens to `lib/auth/user-store.ts`'s seeded demo account once real auth is the default (it's mock-only and never appears in Clerk mode, by design - see `lib/auth/session.ts`).

### Real billing (Stripe)

Uses the `stripe` npm package (v22.6.2), verified directly against the installed SDK's type definitions rather than trained knowledge - notably, `current_period_end` is **not** a field on the top-level `Subscription` object in this SDK version, it lives on `subscription.items.data[0].current_period_end`, and the webhook handler reads it from there.

The core design principle, mirroring the auth security fix: **the webhook is the sole writer of `plan`** in real billing mode. `app/api/v1/account/checkout/route.ts` only starts a Stripe Checkout session - it never grants access itself. `app/api/v1/account/plan/route.ts`'s direct PATCH is disabled (returns 403) whenever `BILLING_PROVIDER=stripe`, so a user can never grant themselves a paid plan without Stripe actually confirming payment first. Only `app/api/webhooks/stripe/route.ts`, after verifying Stripe's signature against the **raw** request body, calls `syncSubscriptionFromStripe()` and writes the plan.

What's built: `lib/billing/stripe.ts` (client singleton), `lib/billing/subscription-store.ts` (Postgres-backed Stripe customer/subscription state), `lib/billing/checkout.ts` (`createCheckoutSession` / `createPortalSession`), `app/api/webhooks/stripe/route.ts` (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`), and `app/api/v1/account/{checkout,billing-portal}/route.ts`. `components/account/plan-selector.tsx` branches on `lib/billing/client-mode.ts`: mock mode keeps the original direct-PATCH buttons unchanged; Stripe mode routes upgrades through Checkout, routes downgrades-to-free and a new "Manage billing" button through the Stripe-hosted Portal, and surfaces errors inline instead of failing silently.

**Not integration-tested against a real Stripe account** - there's no way to create Checkout/Portal sessions or receive webhooks without live keys in this environment. Verified by: type-checking every call against the actual installed SDK's type definitions, the full test suite (84 tests) passing unchanged, a production build succeeding with both new routes registered, and a Playwright smoke test confirming mock mode is completely unchanged (no "Manage billing" button appears, the mock subtitle text is unchanged, and switching plans via the original PATCH path still works exactly as before).

**Still needed before this can go live:** a real Stripe account, products/prices for Pro and Elite (`STRIPE_PRICE_ID_PRO`/`STRIPE_PRICE_ID_ELITE`), a webhook endpoint pointed at `/api/webhooks/stripe` for `STRIPE_WEBHOOK_SECRET`, and a decision on how existing mock-plan users are migrated onto real Stripe customers the first time `BILLING_PROVIDER=stripe` is flipped on (today `ensureStripeCustomer()` just creates a fresh Stripe customer for anyone who doesn't have one yet - it doesn't reconcile a pre-existing mock `plan` value).

### Real-time push

Every open tab/window now gets odds updates live, not just the one that triggered them. `lib/realtime/bus.ts` is a pub/sub abstraction with two implementations: an in-process `EventEmitter` (default - fine for one running instance, which is all mock mode or a single-container deployment has), or Redis pub/sub when `REDIS_URL` is set (the only way this can work across processes - the ingestion CLI and the web server, or multiple web server instances behind a load balancer, are never the same process). `app/api/v1/stream/route.ts` exposes it to the browser as Server-Sent Events - a plain streamed Route Handler response, not WebSockets, since this only ever pushes server->browser and SSE needs no custom server or `ws` upgrade handling. `components/realtime/live-indicator.tsx`, mounted in the top bar, shows connection state and calls `router.refresh()` on every tick, which is what actually pulls fresh data into whatever page is open.

Unlike most "real mode" work in this project, **this one got a genuine live test, not just type-checking**: a real multi-tab Playwright run confirmed clicking "Simulate market tick" in one tab auto-refreshes a second, untouched tab within ~3 seconds (tick-flash highlights and all) via the in-process bus; separately, a temporary Redis container confirmed a completely different Node process publishing was received by the running web server's SSE stream, validating the cross-process path real ingestion will need. One real bug this caught: the SSE route didn't flush any bytes - not even response headers - until either a tick happened or the first 20-second heartbeat fired, leaving the browser's `EventSource` stuck in "connecting" that whole time; fixed by enqueueing an immediate `: connected` comment on stream open.

**What's not wired up yet:** `scripts/ingest.ts` publishes a tick after every real ingestion run, but that only reaches anyone if `REDIS_URL` is set - without it, a real ingestion run's publish is a harmless no-op into an in-process bus nothing else shares. There's also no per-market/per-league filtering - every connected client gets notified of every tick anywhere and does a full `router.refresh()`, which is fine at this data volume but not what a high-traffic production system should scale to.

### Alert evaluation

Alerts were pure CRUD until now: `AlertDef`/`AlertEvent` existed in the schema and Alerts was one of the 9 core screens, but nothing ever checked whether a condition was met. `lib/alerts/evaluate.ts` runs on every odds tick (the same trigger real-time push already reacts to) and evaluates every active alert's condition - `odds_threshold`, `edge_threshold`, `book_spread`, `movement`, and `start_reminder` (the 5 types the create-alert form actually exposes) - against current market state, respecting each alert's cooldown and quiet hours. A fired alert gets pushed live through `lib/realtime/bus.ts` as a new `alert_fired` event type, shown as a toast via `components/realtime/live-indicator.tsx` and logged to a new "Recent triggers" panel on the Alerts page.

**A real privacy consideration this surfaced:** unlike `odds_tick` (public market data, safe to broadcast to every connection), `alert_fired` carries one user's private content. `app/api/v1/stream/route.ts` now resolves the requesting browser's session and filters `alert_fired` events to that `userId` before forwarding - without that check, one user's alert would leak to every other open tab on the shared bus/channel.

Also fixed along the way: the two seeded demo alerts pointed at `seed_outcome_1`/`seed_outcome_2` - placeholder IDs that never resolved to anything, so they could never actually have fired even with an evaluator. They now point at real outcome IDs pulled from `listOpportunities()`, with thresholds set just under each outcome's real current value so both are realistic to trigger on the very next tick.

Genuinely live-tested: a two-tab Playwright run created a real alert via the API (with quiet hours explicitly disabled - the API already supports overriding them, only the UI form doesn't expose it) on a real outcome, triggered a tick from tab A, and confirmed the toast rendered on tab B - completely untouched - along with the Recent triggers panel picking it up. That same run visibly demonstrated quiet hours working correctly too: it happened to run inside the default 23:00-07:00 window, and the two seeded alerts (which use that default) correctly stayed silent while the test alert (quiet hours disabled) fired.

**Update: this gap is now closed.** `lib/alerts/tick-listener.ts`'s `subscribeAlertsToTicks()` reacts to every `odds_tick` on the bus - local or remote - with the same `evaluateAlerts()` call, so a real ingestion run's tick now triggers evaluation too, once `REDIS_URL` bridges the two processes. The old direct call from `app/api/v1/simulate-tick/route.ts` was removed (not left alongside the new listener) - keeping both would double-evaluate every local tick, since publishing loops straight back through the same listener.

**A real Next.js architecture constraint discovered while building this, worth recording since it's non-obvious:** the first attempt wired this subscription up via `instrumentation.ts`, Next's official "run once when the server boots" hook - the obviously-correct-looking place for exactly this kind of setup. It didn't work. Verified empirically (a real multi-process Redis test, not a guess): `instrumentation.ts` compiles into its own isolated bundle that does **not** share a module singleton with route handlers, even within the same running Node.js process - a subscription set up there never received events a route handler's `realtimeBus.publish()` call published. Route handlers reliably share module state with *each other* (that's the entire basis real-time push was already built on), so the fix was to move the subscription to module scope inside `app/api/v1/stream/route.ts` instead - a route every authenticated page already loads via `live-indicator.tsx`'s `EventSource` connection, so the subscription is live from the first real page load. Getting this wrong the first time also surfaced a separate, real webpack issue along the way: enabling `instrumentationHook` made Next compile `instrumentation.ts` for the Edge runtime too, which pulled `ioredis` (Node-only: `net`/`dns`/`crypto`/`stream`) into that build and broke it outright - since `instrumentation.ts` is gone now, so is that workaround.

Live-verified end to end for real this time, for both paths: a two-tab Playwright run confirmed the local path still fires correctly; separately, a genuinely external Node process (mimicking the ingestion CLI) published a tick via a real Redis container, and a connected browser's alert fired and showed a toast from that remote publish - the exact scenario this gap was about.

### Admin access (RBAC + MFA, Section 12.3)

The admin console used to be reachable by anyone with a session (mock or real), with just an on-page notice saying so. `lib/auth/require-admin.ts` now gates it for real, with two independent checks:

- **RBAC** (works in both modes): `session.role === "admin"`, an app-level concept - not a Clerk Organization role, since Orgs are a multi-tenant feature this single-tenant app has no use for. `MockSession.role` is `"user"` by default; nothing anywhere makes it self-service. The seeded demo account is the one exception, kept as `"admin"` so the demo experience can still reach `/admin` exactly like before this existed. Non-admins get a real 404 (via Next's `notFound()`), not just a warning banner.
- **MFA** (real Clerk mode only): additionally calls `auth.protect({ reverification: "strict_mfa" })`, requiring the session to have recently verified a second factor - verified directly against the installed SDK's type definitions (`SessionVerificationTypes = 'strict_mfa' | 'strict' | 'moderate' | 'lax'`), not assumed from memory. This only checks the *current session's* recent verification - it doesn't force any account to have 2FA configured. That's a Clerk *project-level* setting ("Require MFA," a Dashboard config step, not app code) - see `DEPLOYMENT.md`. Mock mode has no equivalent at all, by design: mock auth has no password or any other first factor to begin with, so simulating a second factor on top of nothing would be fiction, not a meaningful stand-in.

**To grant admin for real:** there's no UI for this anywhere, deliberately. In mock mode, only the seeded demo account has it. In real (Postgres) mode, grant it directly: `UPDATE users SET role = 'admin' WHERE email = '...'`.

**Live-tested in mock mode**, not just type-checked: a Playwright run confirmed the demo account still reaches `/admin` (200, full panel visible) while a freshly signed-up account - `role` defaulting to `"user"` - gets a real 404. The MFA check itself is not integration-tested, same reason as every other real-Clerk-mode path in this project: no live Clerk project to test against here. The Postgres migration adding the `role` column (`prisma/migrations/20260922014747_add_user_role/`) was hand-written (Docker's daemon was stuck when this was built) rather than generated against a live database like every other migration - but unlike that gap staying open, it got closed the same day: once Docker recovered, `prisma migrate deploy` against a fresh container applied it cleanly, retroactively confirming the hand-written SQL was correct.

## Project layout

```
lib/calc/       Pure calculation engine (Section 6) + golden-vector tests
lib/mock/       Seeded fixture data + query API (the default data source - USE_MOCK_DATA=true)
lib/providers/  Real odds-provider adapters (The Odds API client, types, normalizer)
lib/ingest/     Identity resolution + ingestion pipeline writing to Postgres (Section 7.3) - run via `npm run ingest`.
                recompute.ts persists ConsensusSnapshot/OpportunitySnapshot lineage rows after each run.
                circuit-breaker.ts (Section 11.2) skips a run entirely after repeated provider failures.
lib/db/         Postgres-backed read layer (lib/db/queries.ts) + Prisma client singleton
lib/data-source.ts  The one switch every screen/route reads through - USE_MOCK_DATA picks mock vs. Postgres
lib/auth/       Session switch (lib/auth/session.ts) - mock user-store, or providers/clerk.ts in real mode.
                require-admin.ts gates /admin on role="admin" + MFA reverification in real mode.
lib/db/user-profile.ts  Postgres-backed profile/plan store for real-auth mode
lib/billing/    Plan entitlements (Section 3.3) + Stripe client, checkout/portal, subscription store for real billing
lib/realtime/   Odds-tick pub/sub (in-process EventEmitter, or Redis when REDIS_URL is set) - app/api/v1/stream exposes it as SSE
lib/ai/         Evidence contract, output schema, explanation generator (Section 9)
lib/tracker/    CSV import/export validation
lib/alerts/     Condition evaluation (odds/edge/spread/movement/start-reminder) - runs on every odds tick, fires via lib/realtime/bus.ts.
                tick-listener.ts subscribes app/api/v1/stream/route.ts to ticks - NOT wired via instrumentation.ts, see "Alert evaluation" above for why.
prisma/         Full DB schema (Section 8) + the committed initial migration (prisma/migrations/)
Dockerfile, docker-compose.yml, .github/workflows/ci.yml, DEPLOYMENT.md  Deployment/ops - see DEPLOYMENT.md
middleware.ts   Clerk route protection (no-op in mock mode) + the CSP header (Section 14)
lib/security/   Rate limiting (Section 14) - in-process only, see rate-limit.ts's header
lib/api/        error.ts's apiError/parseBody (shared response shape + zod-validated body parsing) + schemas.ts (every route's body schema)
app/api/webhooks/clerk/   Clerk user.created/user.updated -> local `users` table sync
app/api/webhooks/stripe/  Stripe subscription events -> local `Subscription` table sync (sole writer of `plan` in real billing mode)
app/(public)/   Marketing site - landing, pricing, FAQ, methodology, responsible-use, privacy, terms, calculator
app/(app)/      Authenticated app shell + all 9 screens + admin
app/api/        Route handlers backing every screen
components/     UI primitives, nav, charts, per-feature form components. Auth-facing ones
                (signup-flow, login-form, logout-button) each have -mock/-clerk variants
                behind a client-side dispatcher, since Clerk's hooks require a ClerkProvider
                ancestor that only exists in real-auth mode.
```

## Design system

Dense "market-blotter" tables in-app (hairlines, not cards - more rows visible = faster scanning, which is the product's value prop), spacious editorial layout on the public site. Space Grotesk for headlines, IBM Plex Sans for UI text, **IBM Plex Mono with tabular numerals for every price/percent/timestamp** in the product. The one signature element is the freshness-pulse status dot + tick-flash on price changes (`components/ui/freshness-badge.tsx`, `components/ui/odds-cell.tsx`), dramatizing the PRD's own principle: "Freshness before flash - stale data must never look current."

## Accessibility, security & performance (Section 14)

A real audit, not a checklist claim - automated where a tool exists, live-verified where it doesn't.

**Accessibility.** Ran `@axe-core/playwright` against all 20 routes (every app screen, every public page, the dynamic `/analyzer/[outcomeId]`) tagged for WCAG 2.0/2.1/2.2 AA. Found exactly one violation class, `color-contrast`, on every screen except the pure-marketing pages: the accent palette (`signal`/`caution`/`risk`/`info`) measured 1.82-3.82:1 as text against white or its own `-soft` background - all fail AA's 4.5:1 normal-text threshold, several fail even the 3:1 large-text one. Fixed by adding a separate, darker `-text` variant of each color (`tailwind.config.ts`) specifically for text usage - `text-signal` → `text-signal-text`, etc., across ~30 files - while leaving the vibrant original DEFAULTs untouched for decorative use (the freshness-pulse dot, tick-flash, dark-mode CTA buttons), since those aren't subject to the same contrast rule and changing them would have altered the design system's signature look for no accessibility benefit. Re-ran the full audit after the fix: **zero violations across every page.** Also manually checked what axe can't automate: the alert toast (`live-indicator.tsx`) already used `role="status"` (an implicit live region), so screen readers are already notified when one appears - no fix needed there.

**Security.** Found and fixed real, previously-unflagged gaps:
- **No security headers at all.** Added `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and `Strict-Transport-Security` (`next.config.mjs`), plus a `Content-Security-Policy` (`middleware.ts`). CSP's `script-src` was supposed to use a per-request nonce - Next.js's documented mechanism, and the installed version genuinely wires a nonce through its whole render pipeline (verified by reading `app-render.js`) - but it broke live: several routes here are statically generated at build time (marketing pages, login, signup, calculator), and a nonce baked into HTML at build time can never match a fresh per-request nonce from middleware. This is a real, documented Next.js limitation, not a mistake in this setup - forcing every static page dynamic just to support nonces would trade away real performance for a property this app has low residual risk for anyway (no `dangerouslySetInnerHTML` anywhere in the codebase). Settled on `'unsafe-inline'` for `script-src`, live-verified across all 20 routes plus real interaction (SSE connection, the tick button, form input) with zero CSP violations and zero console errors - every other directive (`frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`) stays strict.
- **Session cookie missing `Secure`.** `httpOnly`/`sameSite` were already set, but not `secure` - meaning the cookie could theoretically be sent over a plain HTTP connection once deployed. Fixed with `secure: process.env.NODE_ENV === "production"` (unconditional `true` would have broken local dev, since browsers only attach `Secure` cookies over HTTPS). Verified live: `Secure; HttpOnly; SameSite=lax` all present in a real production-mode response.
- **No rate limiting anywhere**, including on login/signup - a scripted loop could probe the login endpoint's "no account found" response to enumerate registered emails, or spam signups, with zero resistance. Added `lib/security/rate-limit.ts` (10 requests/60s per client, in-process only - see its header for why that's a stated scope boundary, not an oversight) to both routes. Live-verified: the 11th request in a burst gets a real `429` with `Retry-After`, not just a claimed limit.
- **The unused `danger` button variant** (`components/ui/primitives.tsx`) had the same contrast problem as the text-color issue above - `bg-risk text-paper-0` measures 3.67:1, failing AA for its 14px/medium-weight label. Fixed alongside the text-color pass even though nothing renders this variant yet, since shipping it broken would be a latent bug the moment someone uses it.
- **Update: the validation gap is now closed too.** At the time this was written, `zod` was only used in `lib/ai/schema.ts`; every route that accepts a body now goes through `lib/api/error.ts`'s `parseBody()` against a real schema (`lib/api/schemas.ts`) instead of ad-hoc field-presence checks or, in a couple of cases, no validation at all. Real bugs this actually catches, not hypothetical ones: `app/api/v1/account/preferences/route.ts` used to cast an unvalidated body straight to `any` - a client could send `favoriteLeagues: "not an array"` and every downstream `.map()` call on it would throw; `app/api/v1/alerts/route.ts` never checked `conditionType` was one of the 5 real values, so a typo'd condition would silently never evaluate, forever; several routes did `Number(body.someField)`, which produces `NaN` on non-numeric input instead of a clean 400 - `NaN` then propagates through every downstream calculation instead of failing where the bad input actually entered. Live-verified, not just type-checked: fired the exact payload shapes the real client forms send at every one of the 11 updated routes through a running server (all succeeded), then fired 3 deliberately invalid payloads (a bogus `conditionType`, a bogus league key, `oddsAmerican: 0`) and confirmed all 3 got a clean 400 instead of a 500 or silent corruption. `Prisma.BetEntry.notesEncrypted` implying encryption at rest that was never implemented is a separate, remaining finding - not fixed, since the Tracker has never been wired to real Postgres in any pass this project, so there's no live code path to fix.

**Performance.** Reviewed and found no action needed: the app has zero `<img>`/`next/image` usage anywhere (a data-dense, typography-driven design with no decorative imagery - genuinely nothing to optimize), fonts already load via `next/font/google` (self-hosted, `font-display: swap`, no render-blocking external requests), and the hot read path (`getAllMarketViewsWithScores`) is a single batched Prisma query with a nested `include` - not N+1 - wrapped in React's `cache()` for request-level deduplication. The ingestion pipeline does issue one or more queries per quote inside a loop, which is N+1-shaped, but that's a periodic background batch job, not a live user-facing request path, so it doesn't carry the same latency cost that pattern would in a hot path.

## Known gaps vs. the full PRD

Deliberately out of scope for this pass (flagged, not forgotten):
- Kalshi/Polymarket adapters (Phase 2, intentionally gated per the PRD).
- Native mobile/PWA, arbitrage scanner, backtesting (Phase 3+, intentionally gated).

Closed since the last pass:
- `zod`-based input validation on every API route that accepts a body (`lib/api/schemas.ts`, `lib/api/error.ts`'s new `parseBody()`) - see "Accessibility, security & performance" above for what this actually caught (an alert's `conditionType` accepted any string forever, preferences accepted anything at all, several numeric fields silently produced `NaN`).
- Cross-process alert evaluation - a real ingestion tick now triggers evaluation too, not just a local one. See "Alert evaluation" above for both the fix and a real Next.js architecture constraint (`instrumentation.ts` doesn't share module state with route handlers) discovered while building it.
- Ingestion circuit breaker (Section 11.2) - `lib/ingest/circuit-breaker.ts`, wired into `lib/ingest/pipeline.ts`'s `ingestLeague()`. 3 consecutive failures opens it; a run is then skipped entirely - never even calls the provider - until a 5-minute cooldown elapses and allows a half-open trial. `ProviderHealth.consecutiveFailures` (new column) and the existing `circuitBreakerOpen` are both surfaced on the admin console.
- Admin console RBAC + MFA (Section 12.3) - see "Admin access" above.
- `ConsensusSnapshot`/`OpportunitySnapshot` are now persisted after every ingestion run (`lib/ingest/recompute.ts`'s `persistDerivedSnapshots()`, called from `scripts/ingest.ts` once all leagues finish) - a genuine append-only lineage/audit trail, per Section 8.1. The live read path (`lib/db/queries.ts`) still recomputes at read time rather than reading these rows back - that's an intentional remaining choice, not an oversight: recomputing is always at least as fresh as the latest snapshot, and switching reads to consume snapshots instead is a further optimization, not a correctness fix. See `lib/db/queries.ts`'s header for the full reasoning.
- `ProviderHealth` is now queried and rendered live on the admin console in real mode (`getProviderHealth()` in `lib/db/queries.ts`, wired through `lib/data-source.ts`) - status/quota/latency/circuit-breaker come straight from the table the ingestion pipeline already writes to. Mock mode shows a static, always-healthy stand-in row instead, clearly labeled as such.
- The three foreign-key-shaped Prisma fields that were plain columns (`SourceEntity.providerId`, `Outcome.participantId`, `Event.venueId`) are now real `@relation`s, so a future read path can `include` across them.
