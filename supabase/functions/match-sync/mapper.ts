/**
 * Maps API-Football fixture data to PencaViva matches table rows.
 * Pure functions — no I/O, fully testable.
 */

// ── API-Football response types (subset we use) ────────────────────

export interface ApiFixture {
  fixture: {
    id: number;
    date: string; // ISO 8601
    status: {
      short: string; // "NS", "1H", "FT", etc.
    };
    venue: {
      name: string | null;
    } | null;
  };
  league: {
    id: number;
    round: string | null; // e.g., "Regular Season - 1"
  };
  teams: {
    home: { name: string; logo: string | null };
    away: { name: string; logo: string | null };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

// ── PencaViva match row type ────────────────────────────────────────

export interface MatchRow {
  api_match_id: number;
  tournament_id: string;
  home_team_name: string;
  away_team_name: string;
  home_team_logo: string | null;
  away_team_logo: string | null;
  home_score: number | null;
  away_score: number | null;
  status: "scheduled" | "live" | "finished" | "postponed" | "cancelled";
  kickoff_time: string;
  matchday: number | null;
  venue: string | null;
}

// ── Status mapping ──────────────────────────────────────────────────

const STATUS_MAP: Record<string, MatchRow["status"]> = {
  // Scheduled
  TBD: "scheduled",
  NS: "scheduled",
  // Live
  "1H": "live",
  HT: "live",
  "2H": "live",
  ET: "live",
  BT: "live",
  P: "live",
  INT: "live",
  LIVE: "live",
  // Finished
  FT: "finished",
  AET: "finished",
  PEN: "finished",
  // Postponed
  PST: "postponed",
  SUSP: "postponed",
  // Cancelled
  CANC: "cancelled",
  ABD: "cancelled",
  AWD: "cancelled",
  WO: "cancelled",
};

export function mapApiStatus(apiStatus: string): MatchRow["status"] {
  return STATUS_MAP[apiStatus] ?? "scheduled";
}

// ── Matchday parser ─────────────────────────────────────────────────

/**
 * Extract matchday number from API-Football round string.
 * e.g., "Regular Season - 5" → 5, "Clausura - 12" → 12
 * Returns null if no number found.
 */
export function parseMatchday(round: string | null): number | null {
  if (!round) return null;
  const match = round.match(/(\d+)\s*$/);
  return match ? parseInt(match[1], 10) : null;
}

// ── Main mapper ─────────────────────────────────────────────────────

/**
 * Map a single API-Football fixture to a matches table row.
 * Requires a tournamentId (resolved externally from the tournament map).
 *
 * Score validation: if status maps to "finished" but scores are null,
 * the match stays as "live" until valid scores arrive.
 */
export function mapFixtureToMatch(
  fixture: ApiFixture,
  tournamentId: string,
): MatchRow {
  let status = mapApiStatus(fixture.fixture.status.short);

  // Score validation: finished requires non-null scores
  if (
    status === "finished" &&
    (fixture.goals.home === null || fixture.goals.away === null)
  ) {
    status = "live";
  }

  return {
    api_match_id: fixture.fixture.id,
    tournament_id: tournamentId,
    home_team_name: fixture.teams.home.name,
    away_team_name: fixture.teams.away.name,
    home_team_logo: fixture.teams.home.logo ?? null,
    away_team_logo: fixture.teams.away.logo ?? null,
    home_score: fixture.goals.home,
    away_score: fixture.goals.away,
    status,
    kickoff_time: fixture.fixture.date,
    matchday: parseMatchday(fixture.league.round),
    venue: fixture.fixture.venue?.name ?? null,
  };
}
