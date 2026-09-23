/**
 * Static reference catalog - PRD Decision Log: MVP leagues NFL/NBA/MLB/NHL,
 * MVP books FanDuel/DraftKings/BetMGM/Caesars. A representative subset of
 * teams is enough to generate a realistic, browsable slate for the
 * prototype without hand-maintaining full league rosters.
 */

export interface LeagueDef {
  key: "nfl" | "nba" | "mlb" | "nhl";
  name: string;
  sportKey: "football" | "basketball" | "baseball" | "hockey";
  teams: { key: string; name: string; city: string }[];
}

export const LEAGUES: LeagueDef[] = [
  {
    key: "nfl",
    name: "NFL",
    sportKey: "football",
    teams: [
      { key: "BAL", name: "Ravens", city: "Baltimore" },
      { key: "BUF", name: "Bills", city: "Buffalo" },
      { key: "KC", name: "Chiefs", city: "Kansas City" },
      { key: "SF", name: "49ers", city: "San Francisco" },
      { key: "PHI", name: "Eagles", city: "Philadelphia" },
      { key: "DAL", name: "Cowboys", city: "Dallas" },
      { key: "GB", name: "Packers", city: "Green Bay" },
      { key: "DET", name: "Lions", city: "Detroit" }
    ]
  },
  {
    key: "nba",
    name: "NBA",
    sportKey: "basketball",
    teams: [
      { key: "BOS", name: "Celtics", city: "Boston" },
      { key: "DEN", name: "Nuggets", city: "Denver" },
      { key: "MIL", name: "Bucks", city: "Milwaukee" },
      { key: "LAL", name: "Lakers", city: "Los Angeles" },
      { key: "PHX", name: "Suns", city: "Phoenix" },
      { key: "NYK", name: "Knicks", city: "New York" },
      { key: "DAL", name: "Mavericks", city: "Dallas" },
      { key: "MIN", name: "Timberwolves", city: "Minneapolis" }
    ]
  },
  {
    key: "mlb",
    name: "MLB",
    sportKey: "baseball",
    teams: [
      { key: "LAD", name: "Dodgers", city: "Los Angeles" },
      { key: "NYY", name: "Yankees", city: "New York" },
      { key: "ATL", name: "Braves", city: "Atlanta" },
      { key: "HOU", name: "Astros", city: "Houston" },
      { key: "PHI", name: "Phillies", city: "Philadelphia" },
      { key: "BAL", name: "Orioles", city: "Baltimore" }
    ]
  },
  {
    key: "nhl",
    name: "NHL",
    sportKey: "hockey",
    teams: [
      { key: "COL", name: "Avalanche", city: "Denver" },
      { key: "FLA", name: "Panthers", city: "Sunrise" },
      { key: "EDM", name: "Oilers", city: "Edmonton" },
      { key: "TOR", name: "Maple Leafs", city: "Toronto" },
      { key: "NYR", name: "Rangers", city: "New York" },
      { key: "VGK", name: "Golden Knights", city: "Las Vegas" }
    ]
  }
];

export interface SportsbookDef {
  key: "fanduel" | "draftkings" | "betmgm" | "caesars";
  name: string;
}

export const SPORTSBOOKS: SportsbookDef[] = [
  { key: "fanduel", name: "FanDuel" },
  { key: "draftkings", name: "DraftKings" },
  { key: "betmgm", name: "BetMGM" },
  { key: "caesars", name: "Caesars" }
];
