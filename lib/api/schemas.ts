/**
 * Zod schemas for every API route that accepts a body (Section 14 QA
 * pass) - mirrors the union types in lib/types.ts exactly, so a route
 * schema and its downstream consumer can never quietly drift apart.
 */
import { z } from "zod";

export const leagueKeySchema = z.enum(["nfl", "nba", "mlb", "nhl"]);
export const sportsbookKeySchema = z.enum(["fanduel", "draftkings", "betmgm", "caesars"]);
export const marketTypeSchema = z.enum(["moneyline", "spread", "total"]);
export const oddsFormatSchema = z.enum(["american", "decimal"]);
export const planSchema = z.enum(["free", "pro", "elite"]);
export const alertConditionTypeSchema = z.enum(["odds_threshold", "edge_threshold", "book_spread", "movement", "start_reminder"]);
export const alertChannelSchema = z.enum(["in_app", "email"]);
export const alertStatusSchema = z.enum(["active", "paused", "expired"]);
export const betStatusSchema = z.enum(["open", "won", "lost", "push", "void", "partial_cash_out", "full_cash_out"]);

// Non-zero, per americanToDecimal()'s own InvalidOddsError contract - a
// 0 would have hit an uncaught throw (500) several calls downstream
// instead of a clean 400 here.
const americanOddsSchema = z.number().finite().refine((v) => v !== 0, "American odds cannot be 0");

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required")
});

export const signupSchema = z.object({
  email: z.string().trim().email("A valid email is required"),
  oddsFormat: oddsFormatSchema.optional(),
  favoriteLeagues: z.array(leagueKeySchema).optional(),
  favoriteBooks: z.array(sportsbookKeySchema).optional(),
  timezone: z.string().optional()
});

export const updatePreferencesSchema = z.object({
  oddsFormat: oddsFormatSchema.optional(),
  favoriteLeagues: z.array(leagueKeySchema).optional(),
  favoriteBooks: z.array(sportsbookKeySchema).optional(),
  timezone: z.string().min(1).optional(),
  onboardedAt: z.string().datetime().nullable().optional()
});

export const updatePlanSchema = z.object({
  plan: planSchema
});

export const checkoutSchema = z.object({
  plan: z.enum(["pro", "elite"])
});

export const watchlistSchema = z.object({
  outcomeId: z.string().trim().min(1, "outcomeId is required")
});

export const createAlertSchema = z.object({
  subjectLabel: z.string().trim().min(1, "subjectLabel is required"),
  subjectType: z.enum(["outcome", "market"]),
  subjectId: z.string().optional(),
  conditionType: alertConditionTypeSchema,
  threshold: z.number().finite(),
  channel: alertChannelSchema.optional().default("in_app"),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:MM").optional().default("23:00"),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:MM").optional().default("07:00"),
  cooldownSeconds: z.number().int().nonnegative().optional().default(1800)
});

export const updateAlertStatusSchema = z.object({
  status: alertStatusSchema
});

export const createBetSchema = z.object({
  eventId: z.string().trim().min(1),
  eventLabel: z.string().trim().min(1),
  leagueKey: leagueKeySchema,
  marketType: marketTypeSchema,
  selectionLabel: z.string().trim().min(1),
  sportsbookKey: sportsbookKeySchema,
  placedAt: z.string().datetime().optional(),
  oddsAmerican: americanOddsSchema,
  stakeAmount: z.number().positive("stakeAmount must be greater than 0"),
  notes: z.string().optional()
});

export const settleBetSchema = z.object({
  status: betStatusSchema,
  cashOutAmount: z.number().finite().optional(),
  cashOutStakePortion: z.number().min(0).max(1).optional(),
  closingDecimalOdds: z.number().positive().optional()
});

export const importCsvSchema = z.object({
  csv: z.string().trim().min(1, "csv text is required")
});
