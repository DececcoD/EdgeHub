/**
 * Client-side auth mode. Server components/routes check AUTH_PROVIDER
 * directly (see lib/auth/session.ts); client components need the
 * NEXT_PUBLIC_ variant since server-only env vars aren't available in the
 * browser. Keep both in sync in .env - nothing enforces that automatically.
 */
export const AUTH_MODE: "mock" | "clerk" = process.env.NEXT_PUBLIC_AUTH_PROVIDER === "clerk" ? "clerk" : "mock";
