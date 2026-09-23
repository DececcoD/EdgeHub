/**
 * Client-side billing mode. Server routes check BILLING_PROVIDER directly
 * (see app/api/v1/account/plan/route.ts); client components need the
 * NEXT_PUBLIC_ variant since server-only env vars aren't available in the
 * browser. Keep both in sync in .env - nothing enforces that automatically.
 */
export const BILLING_MODE: "mock" | "stripe" = process.env.NEXT_PUBLIC_BILLING_PROVIDER === "stripe" ? "stripe" : "mock";
