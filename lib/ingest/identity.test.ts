/**
 * Tests the resolution LOGIC (ambiguous-match handling, exception dedup,
 * mapping-cache idempotency) against a minimal in-memory fake standing in
 * for Prisma - not a real Postgres. It implements only the exact query
 * shapes identity.ts actually calls, so a passing suite here proves the
 * decision logic is sound; it does not prove the real Prisma queries are
 * wired correctly (that needs a real database, which this project doesn't
 * have access to in this environment - see lib/ingest/pipeline.ts's header
 * comment for that boundary).
 */
import { describe, expect, it } from "vitest";
import { resolveEvent, resolveMarketAndOutcome, resolveTeam } from "./identity";
import type { NormalizedEvent, NormalizedQuote } from "../providers/the-odds-api/normalize";

let idSeq = 0;
function newId(prefix: string) {
  idSeq += 1;
  return `${prefix}_${idSeq}`;
}

function makeFakePrisma() {
  const leagues = [{ id: "league_nfl", key: "nfl", name: "NFL" }];
  const teams = [
    { id: "team_ravens", leagueId: "league_nfl", key: "BAL", name: "Ravens", city: "Baltimore" },
    { id: "team_bills", leagueId: "league_nfl", key: "BUF", name: "Bills", city: "Buffalo" },
    // Deliberately ambiguous: two teams that would both match "Boston Bears".
    { id: "team_bears_a", leagueId: "league_nfl", key: "BOSA", name: "Bears", city: "Boston" },
    { id: "team_bears_b", leagueId: "league_nfl", key: "BOSB", name: "Bears", city: "Boston" }
  ];
  const providerMappings: { id: string; providerId: string; entityType: string; sourceKey: string; canonicalId: string; confidence: number }[] = [];
  const mappingExceptions: { id: string; providerId: string; entityType: string; sourceKey: string; reason: string; status: string }[] = [];
  const sourceEntities: { id: string; providerId: string; sourceKey: string; entityType: string; canonicalEntityId: string | null }[] = [];
  const events: { id: string; leagueId: string; canonicalStartAt: Date; status: string }[] = [];
  const eventParticipants: { id: string; eventId: string; teamId: string; side: string }[] = [];
  const markets: { id: string; eventId: string; marketType: string; period: string; lineKey: string | null }[] = [];
  const outcomes: { id: string; marketId: string; canonicalKey: string; participantId: string | null; side: string; label: string }[] = [];

  const prisma = {
    league: {
      findUnique: async ({ where }: any) => leagues.find((l) => l.key === where.key) ?? null
    },
    team: {
      findMany: async ({ where }: any) => teams.filter((t) => t.leagueId === where.leagueId)
    },
    providerMapping: {
      findFirst: async ({ where }: any) => {
        const matches = providerMappings.filter(
          (m) => m.providerId === where.providerId && m.entityType === where.entityType && m.sourceKey === where.sourceKey
        );
        matches.sort((a, b) => b.confidence - a.confidence);
        return matches[0] ?? null;
      },
      create: async ({ data }: any) => {
        const row = { id: newId("map"), ...data };
        providerMappings.push(row);
        return row;
      }
    },
    mappingException: {
      findFirst: async ({ where }: any) =>
        mappingExceptions.find(
          (e) => e.providerId === where.providerId && e.entityType === where.entityType && e.sourceKey === where.sourceKey && e.status === where.status
        ) ?? null,
      create: async ({ data }: any) => {
        const row = { id: newId("exc"), ...data };
        mappingExceptions.push(row);
        return row;
      }
    },
    sourceEntity: {
      findUnique: async ({ where }: any) => {
        const k = where.providerId_sourceKey_entityType;
        return sourceEntities.find((s) => s.providerId === k.providerId && s.sourceKey === k.sourceKey && s.entityType === k.entityType) ?? null;
      },
      create: async ({ data }: any) => {
        const row = { id: newId("src"), ...data };
        sourceEntities.push(row);
        return row;
      }
    },
    event: {
      create: async ({ data }: any) => {
        const event = { id: newId("evt"), leagueId: data.leagueId, canonicalStartAt: data.canonicalStartAt, status: data.status };
        events.push(event);
        for (const p of data.participants.create) {
          eventParticipants.push({ id: newId("ep"), eventId: event.id, teamId: p.teamId, side: p.side });
        }
        return event;
      }
    },
    market: {
      upsert: async ({ where, create }: any) => {
        const k = where.eventId_marketType_period_lineKey;
        const existing = markets.find((m) => m.eventId === k.eventId && m.marketType === k.marketType && m.period === k.period && m.lineKey === k.lineKey);
        if (existing) return existing;
        const created = { id: newId("mkt"), eventId: create.eventId, marketType: create.marketType, period: create.period, lineKey: create.lineKey };
        markets.push(created);
        return created;
      }
    },
    outcome: {
      upsert: async ({ where, create }: any) => {
        const k = where.marketId_canonicalKey;
        const existing = outcomes.find((o) => o.marketId === k.marketId && o.canonicalKey === k.canonicalKey);
        if (existing) return existing;
        const created = { id: newId("out"), marketId: create.marketId, canonicalKey: create.canonicalKey, participantId: create.participantId, side: create.side, label: create.label };
        outcomes.push(created);
        return created;
      }
    }
  };

  return { prisma, teams, providerMappings, mappingExceptions, sourceEntities, events, eventParticipants, markets, outcomes };
}

const PROVIDER_ID = "provider_odds_api";

describe("resolveTeam", () => {
  it("resolves an exact single match and caches it as a ProviderMapping", async () => {
    const { prisma, providerMappings } = makeFakePrisma();
    const id = await resolveTeam(prisma as any, PROVIDER_ID, "league_nfl", "Baltimore Ravens");
    expect(id).toBe("team_ravens");
    expect(providerMappings).toHaveLength(1);
    expect(providerMappings[0]!.confidence).toBe(1.0);
  });

  it("is case/whitespace-insensitive", async () => {
    const { prisma } = makeFakePrisma();
    const id = await resolveTeam(prisma as any, PROVIDER_ID, "league_nfl", "  baltimore ravens  ");
    expect(id).toBe("team_ravens");
  });

  it("returns null and records a MappingException when no team matches", async () => {
    const { prisma, mappingExceptions } = makeFakePrisma();
    const id = await resolveTeam(prisma as any, PROVIDER_ID, "league_nfl", "Cleveland Browns");
    expect(id).toBeNull();
    expect(mappingExceptions).toHaveLength(1);
    expect(mappingExceptions[0]!.reason).toMatch(/No canonical team matched/);
  });

  it("returns null and records an Ambiguous exception when multiple teams match, rather than guessing", async () => {
    const { prisma, mappingExceptions } = makeFakePrisma();
    const id = await resolveTeam(prisma as any, PROVIDER_ID, "league_nfl", "Boston Bears");
    expect(id).toBeNull();
    expect(mappingExceptions[0]!.reason).toMatch(/Ambiguous/);
  });

  it("does not create a duplicate MappingException for the same repeatedly-unresolved name", async () => {
    const { prisma, mappingExceptions } = makeFakePrisma();
    await resolveTeam(prisma as any, PROVIDER_ID, "league_nfl", "Cleveland Browns");
    await resolveTeam(prisma as any, PROVIDER_ID, "league_nfl", "Cleveland Browns");
    expect(mappingExceptions).toHaveLength(1);
  });

  it("uses the cached ProviderMapping on a second call instead of re-scanning teams", async () => {
    const { prisma, providerMappings } = makeFakePrisma();
    await resolveTeam(prisma as any, PROVIDER_ID, "league_nfl", "Baltimore Ravens");
    await resolveTeam(prisma as any, PROVIDER_ID, "league_nfl", "Baltimore Ravens");
    // A second create would mean the cache wasn't consulted - must stay at 1.
    expect(providerMappings).toHaveLength(1);
  });
});

describe("resolveEvent", () => {
  const normalized: NormalizedEvent = {
    providerEventId: "prov_evt_1",
    league: "nfl",
    commenceTime: "2026-09-21T17:00:00Z",
    homeTeamName: "Baltimore Ravens",
    awayTeamName: "Buffalo Bills"
  };

  it("creates the event and both participants on first resolution", async () => {
    const { prisma, events, eventParticipants } = makeFakePrisma();
    const resolved = await resolveEvent(prisma as any, PROVIDER_ID, normalized);
    expect(resolved).not.toBeNull();
    expect(events).toHaveLength(1);
    expect(eventParticipants).toHaveLength(2);
    expect(resolved!.homeTeamId).toBe("team_ravens");
    expect(resolved!.awayTeamId).toBe("team_bills");
  });

  it("is idempotent - a second call with the same provider event id does not create a duplicate Event", async () => {
    const { prisma, events } = makeFakePrisma();
    const first = await resolveEvent(prisma as any, PROVIDER_ID, normalized);
    const second = await resolveEvent(prisma as any, PROVIDER_ID, normalized);
    expect(events).toHaveLength(1);
    expect(second!.eventId).toBe(first!.eventId);
  });

  it("returns null (does not create an event) when a team can't be resolved", async () => {
    const { prisma, events } = makeFakePrisma();
    const bad: NormalizedEvent = { ...normalized, homeTeamName: "Cleveland Browns" };
    const resolved = await resolveEvent(prisma as any, PROVIDER_ID, bad);
    expect(resolved).toBeNull();
    expect(events).toHaveLength(0);
  });

  it("throws a clear setup error when the league isn't seeded, instead of a confusing null-pointer failure", async () => {
    const { prisma } = makeFakePrisma();
    const unseeded: NormalizedEvent = { ...normalized, league: "nba" };
    await expect(resolveEvent(prisma as any, PROVIDER_ID, unseeded)).rejects.toThrow(/not seeded/);
  });
});

describe("resolveMarketAndOutcome", () => {
  const normalized: NormalizedEvent = {
    providerEventId: "prov_evt_2",
    league: "nfl",
    commenceTime: "2026-09-21T17:00:00Z",
    homeTeamName: "Baltimore Ravens",
    awayTeamName: "Buffalo Bills"
  };
  const quote: NormalizedQuote = {
    providerEventId: "prov_evt_2",
    league: "nfl",
    marketType: "spread",
    side: "home",
    point: -2.5,
    sportsbook: "fanduel",
    americanOdds: -110,
    decimalOdds: 1 + 100 / 110,
    bookLastUpdate: "2026-09-20T12:00:00Z",
    fetchedAt: "2026-09-20T12:05:00Z"
  };

  it("creates a market/outcome pair and is idempotent on repeated calls regardless of point movement", async () => {
    const { prisma, markets, outcomes } = makeFakePrisma();
    const resolved = await resolveEvent(prisma as any, PROVIDER_ID, normalized);

    const first = await resolveMarketAndOutcome(prisma as any, resolved!, quote);
    // Line moves from -2.5 to -3 - should NOT mint a new Market/Outcome.
    const second = await resolveMarketAndOutcome(prisma as any, resolved!, { ...quote, point: -3 });

    expect(markets).toHaveLength(1);
    expect(outcomes).toHaveLength(1);
    expect(first.marketId).toBe(second.marketId);
    expect(first.outcomeId).toBe(second.outcomeId);
  });

  it("creates separate outcomes for home vs. away on the same market", async () => {
    const { prisma, outcomes } = makeFakePrisma();
    const resolved = await resolveEvent(prisma as any, PROVIDER_ID, normalized);

    await resolveMarketAndOutcome(prisma as any, resolved!, quote);
    await resolveMarketAndOutcome(prisma as any, resolved!, { ...quote, side: "away", point: 2.5 });

    expect(outcomes).toHaveLength(2);
  });
});
