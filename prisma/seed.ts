/**
 * Seeds the canonical sports/sportsbook catalog into a real Postgres
 * instance. Run via `npm run db:seed` once DATABASE_URL points at a real
 * database and migrations have run.
 *
 * Reuses the exact same LEAGUES/SPORTSBOOKS constants the mock data layer
 * generates fixtures from (lib/mock/catalog.ts), so the real DB and the
 * prototype's mock data always agree on team names/keys - there is only one
 * source of truth for the catalog, not two that can drift apart.
 *
 * Idempotent: safe to re-run, every write is an upsert keyed on the same
 * unique constraints the schema already enforces.
 *
 * A bare `tsx` process doesn't auto-load .env the way Next's own dev/
 * build/start commands do (confirmed by testing, not assumed) - must be
 * the very first import, before `new PrismaClient()` reads DATABASE_URL.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { LEAGUES, SPORTSBOOKS } from "../lib/mock/catalog";

const prisma = new PrismaClient();

const SPORT_NAMES: Record<string, string> = {
  football: "Football",
  basketball: "Basketball",
  baseball: "Baseball",
  hockey: "Hockey"
};

async function main() {
  console.log("Seeding sports/leagues/teams...");
  for (const league of LEAGUES) {
    const sport = await prisma.sport.upsert({
      where: { key: league.sportKey },
      update: {},
      create: { key: league.sportKey, name: SPORT_NAMES[league.sportKey] ?? league.sportKey }
    });

    const leagueRecord = await prisma.league.upsert({
      where: { key: league.key },
      update: { name: league.name },
      create: { key: league.key, name: league.name, sportId: sport.id }
    });

    for (const team of league.teams) {
      await prisma.team.upsert({
        where: { leagueId_key: { leagueId: leagueRecord.id, key: team.key } },
        update: { name: team.name, city: team.city },
        create: { leagueId: leagueRecord.id, key: team.key, name: team.name, city: team.city }
      });
    }
    console.log(`  ${league.name}: ${league.teams.length} teams`);
  }

  console.log("Seeding sportsbooks...");
  for (const book of SPORTSBOOKS) {
    await prisma.sportsbook.upsert({
      where: { key: book.key },
      update: { name: book.name },
      create: { key: book.key, name: book.name, isVisible: true }
    });
  }
  console.log(`  ${SPORTSBOOKS.length} sportsbooks`);

  console.log("Seeding odds provider...");
  await prisma.provider.upsert({
    where: { key: "the-odds-api" },
    update: {},
    create: { key: "the-odds-api", name: "The Odds API" }
  });

  console.log("Seeding prediction-market providers...");
  await prisma.provider.upsert({ where: { key: "kalshi" }, update: {}, create: { key: "kalshi", name: "Kalshi" } });
  await prisma.provider.upsert({ where: { key: "polymarket" }, update: {}, create: { key: "polymarket", name: "Polymarket" } });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
