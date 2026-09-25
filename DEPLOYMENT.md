# Deployment runbook

How to actually run EdgeHub somewhere, and how to move it off mock data once
you're ready. Unlike the Clerk/Stripe/hosted-Postgres integrations
elsewhere in this repo, this one **was** actually exercised end-to-end in
this environment, against a real (locally containerized) Postgres, not
just type-checked:

- `docker compose build` / `up` - real image build, real container, real second Postgres container
- `npx prisma migrate dev --name init` - generated `prisma/migrations/20260921040125_init/` for real (it didn't exist before this) and applied it
- `npx prisma migrate deploy` - confirmed the production-safe command correctly no-ops once that migration's applied
- `npm run db:seed` - ran for real against that database
- A second container booted with `USE_MOCK_DATA=false` against that seeded database - `/api/health` returned `{"status":"ok","mode":"real"}` (a real `SELECT 1` succeeding), and `/dashboard`, `/markets`, `/admin` all returned 200 with empty-but-correct data (no ingestion had run, so zero markets - the point was confirming the real read path doesn't crash on a real, empty, real-schema database, which it never had before)
- `persistDerivedSnapshots()` (the snapshot-persistence work from the previous pass) ran directly against that same real database with zero markets present and returned `{marketsSnapshotted: 0, outcomesSnapshotted: 0}` cleanly

One real bug this caught: `node:20-slim`'s base image ships no OpenSSL at
all, so Prisma's binary-target auto-detection failed and silently defaulted
to the wrong query-engine build (`debian-openssl-1.1.x` instead of the
`3.0.x` this image actually has) - harmless in mock mode since it never
queries anything, but it would have hard-failed the instant real mode ran
its first query. Fixed by installing `openssl` explicitly in both the
`deps` and `runner` stages of the `Dockerfile` - confirmed fixed by the
real-mode run above actually succeeding.

What's still never been run against a real *cloud* provider - only a local
container: managed Postgres (RDS/Supabase/etc.), and of course
Clerk/Stripe/The Odds API, which need real accounts that can't be created
in this environment. A real CI run has happened, though - see "CI" below
for what that actually caught.

Real-time push (`lib/realtime/bus.ts`) got the same treatment: a real
multi-tab Playwright run confirmed the in-process default actually pushes
a tick from one browser tab to another, and a temporary Redis container
confirmed the cross-process path (a separate Node process publishing,
received by the running web server) - see README.md's "Real-time push"
section for what that caught.

**Where that streak briefly broke, and how it got closed the same day:**
the admin RBAC/MFA pass (Section 12.3) added a `role` column to `User`,
needing a new migration - but Docker's daemon was stuck (multiple
duplicate processes, unresponsive to `docker info`/`docker ps`) when that
was built, so `prisma/migrations/20260922014747_add_user_role/` was
hand-written to match Prisma's own conventions rather than generated
against a live database. Rather than leave that unverified, the daemon
was cleanly restarted (killed the stray processes, relaunched) once the
circuit-breaker pass needed its own new migration anyway. Against a fresh
Postgres container, `prisma migrate deploy` applied *both* pending
migrations - the init one and the hand-written `add_user_role` one -
cleanly in one run, retroactively confirming the hand-written SQL was
correct. `prisma migrate dev --name add_circuit_breaker_fields` then
generated and applied the new `consecutiveFailures` column for real.

With that database up, the circuit breaker's actual Prisma queries (not
just the fake-Prisma unit tests in `lib/ingest/circuit-breaker.test.ts`)
were exercised directly: forced 3 consecutive failures via `recordFailure()`,
confirmed `shouldSkip()` returned `true` and the real `ProviderHealth` row
showed `circuitBreakerOpen: true, consecutiveFailures: 3`; backdated
`updatedAt` past the cooldown window and confirmed the half-open trial
opened back up; called `recordSuccess()` and confirmed it reset cleanly.
Separately, called `ingestLeague()` itself with the breaker forced open -
with no `ODDS_PROVIDER_API_KEY` set in this environment, a real attempt to
fetch would have thrown a config error, so getting back a clean
`{ circuitBreakerOpen: true }` summary (and an `IngestionRun` row with
`status: "skipped"`) proves it skipped *before* ever trying to reach the
provider, not just that it reported skipping.

## The short version

The app needs **zero configuration** to run in its default, fully-mocked
state - every env var defaults to mock/safe behavior when unset (verified:
`npm run build` succeeds with no `.env` file at all). Moving to real data
is opt-in, one integration at a time, exactly as described in README.md's
"Moving off mock data" table. This doc is about the *mechanics* of running
it somewhere (Docker, CI, migrations) - not repeating what each integration
does, which is already covered there.

## Local smoke test (Docker + a real Postgres, still serving mock data)

```bash
docker compose up --build
curl http://localhost:3000/api/health       # {"status":"ok","mode":"mock"}
```

This builds the image (`Dockerfile`), starts a real Postgres alongside it,
and points `DATABASE_URL` at that Postgres - but leaves `USE_MOCK_DATA=true`,
so the running app still serves mock data regardless. This lets you safely
rehearse the real-data commands below (`db:migrate:deploy`, `db:seed`,
`ingest`) against a real database without touching what's actually being
served, before ever flipping `USE_MOCK_DATA=false` for real.

```bash
# from a second terminal, against the same compose Postgres:
DATABASE_URL=postgresql://edgehub:edgehub@localhost:5432/edgehub npx prisma migrate deploy
DATABASE_URL=postgresql://edgehub:edgehub@localhost:5432/edgehub npm run db:seed
```

The initial migration (`prisma/migrations/20260921040125_init/`) is already
committed in this repo, generated and applied for real against exactly
this compose setup - `migrate deploy` has something to apply. If you add
schema changes later, generate the next migration the normal Prisma way
(`prisma migrate dev --name <whatever>` against a real dev database - not
possible in this environment, so this was a one-time bootstrap here) and
commit the result; `migrate deploy` only ever applies migrations that are
already committed, it never generates them.

## CI

`.github/workflows/ci.yml` has two jobs. `build-and-test` runs lint,
typecheck, the full unit test suite, and a production build on every
push/PR to `main`. `e2e` runs after it passes, installs Playwright's
Chromium binary (`npx playwright install --with-deps`), and runs the 50-spec
suite in `e2e/` against a real production server that job builds and starts
itself - see README.md's "End-to-end tests" section for what it covers. On
failure it uploads the HTML Playwright report as a build artifact. Neither
job needs any secrets - same "defaults to mock, needs nothing" property as
local dev.

This repo is now pushed to GitHub, and CI has actually run - not a
theoretical claim. The very first run **failed**, on the `lint` step,
which caught two real gaps that type-checking alone never would have:
ESLint had never actually been configured for this project (`next lint`
was hitting its interactive first-run setup prompt, which just hangs/fails
non-interactively in CI) - neither `eslint` nor `eslint-config-next` were
even installed. Fixed by installing both (pinned to `eslint@8` +
`eslint-config-next@14.2.35`, matching the Next version - Next 14's
"Strict" preset needs ESLint 8's classic config format, not 9's flat
config) and adding `.eslintrc.json` (`{ "extends": "next/core-web-vitals" }`)
directly rather than answering the interactive prompt. That surfaced 24
real `react/no-unescaped-entities` errors (raw `'`/`"` inside JSX text
across 11 files, mostly this project's own quoted phrases like "lock" and
contractions like "sportsbook's") - fixed by replacing them with
`&apos;`/`&quot;`, not by disabling the rule. Verified the fix renders
correctly, not just that it compiles: checked the actual served HTML for
one of the entity-escaped pages and confirmed the browser-facing output is
the correct escaped form (`&quot;`/`&#x27;`), which every browser renders
as a normal `"`/`'`. `npm run lint` now passes cleanly, and the full
CI sequence (lint → typecheck → test → build) passes locally end to end.

## Moving to real data, in order

Each step is independently optional and reversible by flipping the env var
back - see `.env.example` for the full variable list and README.md's
"Moving off mock data" / "Real auth (Clerk)" / "Real billing (Stripe)"
sections for what each one actually does. The mechanical steps to activate
each, once you have real credentials:

1. **Database.** Provision a real Postgres, set `DATABASE_URL`, then:
   ```bash
   npm run db:migrate:deploy   # NOT db:migrate - that's `prisma migrate dev`,
                                # which prompts interactively and is dev-only.
                                # migrate deploy is the non-interactive,
                                # production-safe equivalent.
   npm run db:seed              # idempotent - safe to re-run
   ```
2. **Odds ingestion.** Set `ODDS_PROVIDER_API_KEY`, run `npm run ingest -- --league nfl,nba,mlb,nhl` once by hand to confirm it works, then set `USE_MOCK_DATA=false`. The CLI is one-shot - schedule it on a recurring cadence with whatever job runner you use (Section 7.1 names Trigger.dev/Inngest; a plain cron calling the same command works too). There is no built-in scheduler.
3. **Auth.** Create a real Clerk project, set `AUTH_PROVIDER=clerk` + `NEXT_PUBLIC_AUTH_PROVIDER=clerk` + the Clerk keys, and point a webhook at `<your-domain>/api/webhooks/clerk` for `CLERK_WEBHOOK_SIGNING_SECRET`. `NEXT_PUBLIC_*` vars are baked in at build time (see Dockerfile's `ARG`s) - rebuild the image after changing them, a runtime env var alone won't take effect.
   - **For the admin console's MFA check to mean anything** (Section 12.3, `lib/auth/require-admin.ts`'s `auth.protect({ reverification: "strict_mfa" })`): enable "Require MFA" for users in the Clerk Dashboard under your project's Auth settings. The app-level check only verifies a session *recently completed* a second factor - it can't force an account to have one configured at all; that's this Dashboard setting, not app code.
   - **To actually grant someone admin access**: there's no self-service UI. Run `UPDATE users SET role = 'admin' WHERE email = '...'` directly against Postgres.
4. **Billing.** Create a real Stripe account + products/prices, set `BILLING_PROVIDER=stripe` + `NEXT_PUBLIC_BILLING_PROVIDER=stripe` + the Stripe keys/price IDs, and point a webhook at `<your-domain>/api/webhooks/stripe` for `STRIPE_WEBHOOK_SECRET`. Same build-time-bake caveat as auth applies to `NEXT_PUBLIC_BILLING_PROVIDER`.
5. **AI.** Set `OPENAI_API_KEY` - no rebuild needed, this one's read at runtime only.
6. **Real-time push across processes.** Only needed once something other than a single web server instance needs to publish or receive ticks - e.g. `scripts/ingest.ts` notifying a separately-running server, or more than one web server instance behind a load balancer. Provision Redis, set `REDIS_URL`, no rebuild needed. Without it, ingestion's tick publish is a harmless no-op and mock mode's tick button still works fine within a single instance (the in-process default).
7. **Error tracking.** Create a real Sentry project, set `SENTRY_DSN` (server/edge) and `NEXT_PUBLIC_SENTRY_DSN` (browser - same build-time-bake caveat as auth/billing above, rebuild after changing it). That alone gets you runtime exception capture. For readable stack traces (build-time source map upload), also set `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` - without all three, `next.config.mjs` deliberately skips the upload step entirely rather than attempting one with no credentials. See README.md's "Observability & error tracking" for what's verified vs. not (no Sentry account exists in this environment to test delivery against).

## Health check

`GET /api/health` - `{"status":"ok","mode":"mock"}` in mock mode (pure liveness, no database to check); in real mode it also runs a trivial `SELECT 1` against Postgres, so a broken `DATABASE_URL` fails the check instead of silently serving a broken app. Point your load balancer/orchestrator's health probe here.

## Known gaps in this runbook

- No staging environment or blue/green rollout strategy - `db:migrate:deploy` runs directly against whatever `DATABASE_URL` points at. Test migrations against a copy of production data before running them for real, same as you would for any Postgres deployment.
- No secrets manager integration (Vault, AWS Secrets Manager, etc.) - env vars are assumed to be injected by whatever platform runs the container.
