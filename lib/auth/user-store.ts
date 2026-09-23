/**
 * Mock user store - stands in for Supabase Auth/Clerk (Section 7.1) plus the
 * `users`/`user_profiles`/`subscriptions` tables (Section 8.1) until a real
 * auth provider and Postgres are wired up. Session state lives in a plain
 * in-memory Map for this prototype: it resets on server restart and is NOT
 * how production auth should work. Swap this module out, not its callers,
 * when moving to Clerk/Supabase.
 */

import type { MockSession, Plan, UserPreferences } from "../types";

interface StoredUser extends MockSession {
  createdAt: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  oddsFormat: "american",
  favoriteLeagues: [],
  favoriteBooks: [],
  timezone: "UTC",
  onboardedAt: null
};

const usersById = new Map<string, StoredUser>();
const userIdByEmail = new Map<string, string>();
let nextUserSeq = 1;

function newUserId(): string {
  const id = `user_${nextUserSeq.toString(36)}`;
  nextUserSeq += 1;
  return id;
}

export function createUser(email: string, plan: Plan = "free"): StoredUser {
  const existingId = userIdByEmail.get(email.toLowerCase());
  if (existingId) {
    const existing = usersById.get(existingId);
    if (existing) return existing;
  }

  const id = newUserId();
  const user: StoredUser = {
    userId: id,
    email,
    plan,
    role: "user", // never self-service - only ensureDemoUser() below grants admin in mock mode
    preferences: { ...DEFAULT_PREFERENCES },
    createdAt: new Date().toISOString()
  };
  usersById.set(id, user);
  userIdByEmail.set(email.toLowerCase(), id);
  return user;
}

export function getUserCount(): number {
  return usersById.size;
}

export function getUserById(id: string): StoredUser | null {
  return usersById.get(id) ?? null;
}

export function getUserByEmail(email: string): StoredUser | null {
  const id = userIdByEmail.get(email.toLowerCase());
  return id ? usersById.get(id) ?? null : null;
}

export function updatePreferences(id: string, patch: Partial<UserPreferences>): StoredUser | null {
  const user = usersById.get(id);
  if (!user) return null;
  user.preferences = { ...user.preferences, ...patch };
  return user;
}

export function updatePlan(id: string, plan: Plan): StoredUser | null {
  const user = usersById.get(id);
  if (!user) return null;
  user.plan = plan;
  return user;
}

// ---------------------------------------------------------------------------
// Seed a demo account so the app is populated on first load without forcing
// a signup flow, matching "Start free" being explorable immediately.
// ---------------------------------------------------------------------------

export const DEMO_USER_EMAIL = "demo@edgehub.app";

export function ensureDemoUser(): StoredUser {
  const existing = getUserByEmail(DEMO_USER_EMAIL);
  if (existing) return existing;

  const user = createUser(DEMO_USER_EMAIL, "pro");
  user.role = "admin"; // the one mock-mode exception - keeps the demo account able to view /admin, exactly like before this existed
  updatePreferences(user.userId, {
    favoriteLeagues: ["nfl", "nba"],
    favoriteBooks: ["fanduel", "draftkings"],
    onboardedAt: new Date().toISOString()
  });
  return user;
}

// Build the demo user immediately so it exists before the first request.
ensureDemoUser();
