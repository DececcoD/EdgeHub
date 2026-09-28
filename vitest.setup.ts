/**
 * Runs before every test file's own imports. Forces mock mode for the
 * entire suite, regardless of the local .env's USE_MOCK_DATA setting.
 *
 * Real, previously-undiscovered bug this fixes (found 2026-09-27 while
 * investigating "flaky" failures in lib/alerts/evaluate.test.ts): unlike
 * bare tsx scripts, vitest never loads .env on its own - but @prisma/client
 * bundles dotenv and auto-loads .env as a side effect the moment anything
 * imports it (confirmed directly against node_modules/@prisma/client's
 * runtime, not assumed). lib/data-source.ts imports lib/db/prisma.ts at
 * module scope, so any test that goes through lib/data-source.ts (even
 * indirectly, e.g. lib/alerts/evaluate.ts) silently picks up whatever
 * USE_MOCK_DATA happens to be sitting in the developer's local .env -
 * "false" while this project had a real Postgres wired up for live
 * verification, which flipped affected tests into querying a real
 * database that doesn't have any of the mock store's seeded IDs. That
 * made failures depend on which test file happened to import Prisma
 * first (process.env is shared across a whole worker process), not on
 * any actual bug in the code under test - genuinely non-deterministic
 * across machines/local .env state, not just "some tests are slow."
 *
 * dotenv does not override already-set variables by default (confirmed
 * against node_modules/dotenv's actual `override` handling, defaults to
 * false), so setting this here first is enough to win regardless of
 * import order or .env's contents.
 */
process.env.USE_MOCK_DATA = "true";
