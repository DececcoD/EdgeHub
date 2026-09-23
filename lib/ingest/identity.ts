/**
 * Canonical identity resolution - Section 7.3 step 3 ("Map source sport,
 * league, participant, event, market, outcome, and book to canonical
 * IDs") and Section 11.1's Mapping Review admin module. Ambiguous or
 * unmatched provider data becomes a MappingException row, never a guess -
 * "suppress ambiguous mappings" per the Section 16.1 risk register.
 *
 * Requires the canonical catalog to already be seeded (prisma/seed.ts) -
 * team/league resolution has nothing to match against on an empty database.
 */
import type { PrismaClient } from "@prisma/client";
import type { NormalizedEvent, NormalizedQuote } from "../providers/the-odds-api/normalize";

const TEAM_MATCH_CONFIDENCE = 1.0;
const MAPPING_REVIEW_THRESHOLD = 0.8; // matches lib/calc/freshness.ts default

export interface ResolvedEvent {
  eventId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
}

async function recordMappingException(
  prisma: PrismaClient,
  providerId: string,
  entityType: string,
  sourceKey: string,
  reason: string
): Promise<void> {
  const existing = await prisma.mappingException.findFirst({
    where: { providerId, entityType, sourceKey, status: "open" }
  });
  if (existing) return; // don't spam duplicate exceptions for the same unresolved key
  await prisma.mappingException.create({ data: { providerId, entityType, sourceKey, reason, status: "open" } });
}

/**
 * Resolves one provider team name to a canonical Team ID, caching the
 * result in ProviderMapping so repeated ingestion runs don't redo the
 * name-matching work. Returns null (and records a MappingException)
 * instead of guessing when the match is ambiguous or absent.
 */
export async function resolveTeam(
  prisma: PrismaClient,
  providerId: string,
  leagueId: string,
  providerTeamName: string
): Promise<string | null> {
  const cached = await prisma.providerMapping.findFirst({
    where: { providerId, entityType: "team", sourceKey: providerTeamName },
    orderBy: { confidence: "desc" }
  });
  if (cached && cached.confidence >= MAPPING_REVIEW_THRESHOLD) return cached.canonicalId;

  const candidates = await prisma.team.findMany({ where: { leagueId } });
  const normalized = providerTeamName.trim().toLowerCase();
  const matches = candidates.filter((team) => `${team.city} ${team.name}`.trim().toLowerCase() === normalized);

  if (matches.length !== 1) {
    await recordMappingException(
      prisma,
      providerId,
      "team",
      providerTeamName,
      matches.length === 0 ? `No canonical team matched "${providerTeamName}".` : `Ambiguous: ${matches.length} teams matched "${providerTeamName}".`
    );
    return null;
  }

  const team = matches[0]!;
  await prisma.providerMapping.create({
    data: { providerId, entityType: "team", sourceKey: providerTeamName, canonicalId: team.id, confidence: TEAM_MATCH_CONFIDENCE }
  });
  return team.id;
}

/**
 * Resolves (or creates) the canonical Event for one normalized provider
 * event, using SourceEntity as the idempotency anchor so re-running
 * ingestion against the same provider event never creates a duplicate.
 */
export async function resolveEvent(prisma: PrismaClient, providerId: string, normalized: NormalizedEvent): Promise<ResolvedEvent | null> {
  const league = await prisma.league.findUnique({ where: { key: normalized.league } });
  if (!league) {
    throw new Error(
      `League "${normalized.league}" is not seeded. Run "npm run db:seed" before ingesting - identity resolution has nothing to match against on an empty catalog.`
    );
  }

  const [homeTeamId, awayTeamId] = await Promise.all([
    resolveTeam(prisma, providerId, league.id, normalized.homeTeamName),
    resolveTeam(prisma, providerId, league.id, normalized.awayTeamName)
  ]);
  if (!homeTeamId || !awayTeamId) return null; // mapping exception already recorded for whichever side failed

  const existingSource = await prisma.sourceEntity.findUnique({
    where: { providerId_sourceKey_entityType: { providerId, sourceKey: normalized.providerEventId, entityType: "event" } }
  });
  if (existingSource?.canonicalEntityId) {
    return { eventId: existingSource.canonicalEntityId, homeTeamId, awayTeamId, homeTeamName: normalized.homeTeamName, awayTeamName: normalized.awayTeamName };
  }

  const event = await prisma.event.create({
    data: {
      leagueId: league.id,
      canonicalStartAt: new Date(normalized.commenceTime),
      status: "scheduled",
      sourceConfidence: 1.0,
      participants: {
        create: [
          { teamId: homeTeamId, side: "home" },
          { teamId: awayTeamId, side: "away" }
        ]
      }
    }
  });

  await prisma.sourceEntity.create({
    data: { providerId, sourceKey: normalized.providerEventId, entityType: "event", canonicalEntityId: event.id, confidence: 1.0 }
  });

  return { eventId: event.id, homeTeamId, awayTeamId, homeTeamName: normalized.homeTeamName, awayTeamName: normalized.awayTeamName };
}

function outcomeLabel(quote: NormalizedQuote, resolved: ResolvedEvent): string {
  if (quote.marketType === "total") return quote.side === "over" ? "Over" : "Under";
  const teamName = quote.side === "home" ? resolved.homeTeamName : resolved.awayTeamName;
  return quote.marketType === "spread" ? `${teamName} (spread)` : teamName;
}

/**
 * Resolves (or creates) the Market + Outcome for one normalized quote.
 * Point value is NOT part of the Market/Outcome identity - a market
 * represents "the spread for this event," not "the spread at this exact
 * line," since the line moves. Each odds_snapshots row carries its own
 * point (Section 8.2), so line movement is tracked there, not by minting a
 * new Market every time a book adjusts its number.
 *
 * lineKey is deliberately the literal string "current" rather than null:
 * Postgres treats every NULL as distinct in a unique index, so a compound
 * unique constraint with a null column never enforces uniqueness and the
 * upsert below would silently insert a new row on every ingestion run
 * instead of finding the existing one. A stable sentinel value keeps the
 * upsert idempotent; revisit if/when alternate lines are tracked as
 * separate markets.
 */
const CURRENT_LINE_KEY = "current";

export async function resolveMarketAndOutcome(
  prisma: PrismaClient,
  resolved: ResolvedEvent,
  quote: NormalizedQuote
): Promise<{ marketId: string; outcomeId: string }> {
  const market = await prisma.market.upsert({
    where: {
      eventId_marketType_period_lineKey: {
        eventId: resolved.eventId,
        marketType: quote.marketType,
        period: "full_game",
        lineKey: CURRENT_LINE_KEY
      }
    },
    update: {},
    create: {
      eventId: resolved.eventId,
      marketType: quote.marketType,
      period: "full_game",
      lineKey: CURRENT_LINE_KEY,
      status: "open",
      rulesVersion: "v1"
    }
  });

  const participantId = quote.side === "home" ? resolved.homeTeamId : quote.side === "away" ? resolved.awayTeamId : null;
  const canonicalKey = quote.side;

  const outcome = await prisma.outcome.upsert({
    where: { marketId_canonicalKey: { marketId: market.id, canonicalKey } },
    update: {},
    create: {
      marketId: market.id,
      participantId,
      side: quote.side,
      label: outcomeLabel(quote, resolved),
      canonicalKey
    }
  });

  return { marketId: market.id, outcomeId: outcome.id };
}
