/**
 * Postgres-backed profile store for real auth (Section 7.1). Clerk owns
 * identity/credentials; this owns the local `users`/`user_profiles`/
 * `subscriptions` rows an authenticated Clerk user maps to. Mirrors
 * lib/auth/user-store.ts's function names so lib/auth/session.ts's switch
 * doesn't need special-casing per function.
 *
 * Note: this does NOT populate the `entitlements` table (Section 8.1) -
 * the app already derives entitlements from `plan` at read time via the
 * static config in lib/billing/entitlements.ts, matching the mock path.
 * That table exists in the schema for a future move to persisted,
 * independently-adjustable entitlements; not needed for this pass.
 */
import { prisma } from "./prisma";
import type { MockSession, Plan, UserPreferences } from "../types";

const DEFAULT_PREFERENCES: UserPreferences = {
  oddsFormat: "american",
  favoriteLeagues: [],
  favoriteBooks: [],
  timezone: "UTC",
  onboardedAt: null
};

function toSession(user: {
  id: string;
  email: string;
  role: string;
  subscription: { plan: Plan } | null;
  profile: {
    oddsFormat: string;
    favoriteLeagues: string[];
    favoriteBooks: string[];
    timezone: string;
    onboardedAt: Date | null;
  } | null;
}): MockSession {
  return {
    userId: user.id,
    email: user.email,
    plan: user.subscription?.plan ?? "free",
    role: user.role as MockSession["role"],
    preferences: user.profile
      ? {
          oddsFormat: user.profile.oddsFormat as UserPreferences["oddsFormat"],
          favoriteLeagues: user.profile.favoriteLeagues as UserPreferences["favoriteLeagues"],
          favoriteBooks: user.profile.favoriteBooks as UserPreferences["favoriteBooks"],
          timezone: user.profile.timezone,
          onboardedAt: user.profile.onboardedAt?.toISOString() ?? null
        }
      : DEFAULT_PREFERENCES
  };
}

const withRelations = { profile: true, subscription: true } as const;

export async function findByClerkUserId(clerkUserId: string): Promise<MockSession | null> {
  const user = await prisma.user.findUnique({ where: { clerkUserId }, include: withRelations });
  return user ? toSession(user) : null;
}

export async function getUserCount(): Promise<number> {
  return prisma.user.count();
}

/**
 * Creates the local profile row for a Clerk identity. Called from the
 * webhook (primary path) and defensively from session resolution (fallback
 * for the window before a webhook delivery lands - Clerk's own docs are
 * explicit that "webhook deliveries are not guaranteed").
 */
export async function createFromClerkUser(params: { clerkUserId: string; email: string }): Promise<MockSession> {
  const existing = await prisma.user.findUnique({ where: { clerkUserId: params.clerkUserId }, include: withRelations });
  if (existing) return toSession(existing);

  const user = await prisma.user.upsert({
    where: { email: params.email },
    update: { clerkUserId: params.clerkUserId },
    create: {
      email: params.email,
      clerkUserId: params.clerkUserId,
      profile: { create: { oddsFormat: "american", favoriteLeagues: [], favoriteBooks: [] } },
      subscription: { create: { plan: "free" } }
    },
    include: withRelations
  });

  return toSession(user);
}

export async function updatePreferences(userId: string, patch: Partial<UserPreferences>): Promise<MockSession | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: withRelations });
  if (!user) return null;

  await prisma.userProfile.upsert({
    where: { userId },
    update: {
      ...(patch.oddsFormat !== undefined && { oddsFormat: patch.oddsFormat }),
      ...(patch.favoriteLeagues !== undefined && { favoriteLeagues: patch.favoriteLeagues }),
      ...(patch.favoriteBooks !== undefined && { favoriteBooks: patch.favoriteBooks }),
      ...(patch.timezone !== undefined && { timezone: patch.timezone }),
      ...(patch.onboardedAt !== undefined && { onboardedAt: patch.onboardedAt ? new Date(patch.onboardedAt) : null })
    },
    create: {
      userId,
      oddsFormat: patch.oddsFormat ?? "american",
      favoriteLeagues: patch.favoriteLeagues ?? [],
      favoriteBooks: patch.favoriteBooks ?? [],
      timezone: patch.timezone ?? "UTC",
      onboardedAt: patch.onboardedAt ? new Date(patch.onboardedAt) : null
    }
  });

  const updated = await prisma.user.findUnique({ where: { id: userId }, include: withRelations });
  return updated ? toSession(updated) : null;
}

export async function updatePlan(userId: string, plan: Plan): Promise<MockSession | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  await prisma.subscription.upsert({
    where: { userId },
    update: { plan },
    create: { userId, plan }
  });

  const updated = await prisma.user.findUnique({ where: { id: userId }, include: withRelations });
  return updated ? toSession(updated) : null;
}
