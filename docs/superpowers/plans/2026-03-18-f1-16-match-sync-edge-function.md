# F1-16: Match Sync Edge Function — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Supabase Edge Function that syncs football match data from API-Football into the `matches` table, with daily fixture import, live polling, and single-match finalization modes.

**Architecture:** Single Deno Edge Function (`match-sync`) with 4 internal modules: entry point (`index.ts`), API client (`api-football.ts`), data mapper (`mapper.ts`), and sync logic (`sync.ts`). Uses `service_role` key to bypass RLS. Cron scheduling via `pg_cron` + `pg_net` extensions.

**Tech Stack:** Deno 2 (Supabase Edge Functions runtime), `@supabase/supabase-js@2` (npm import), API-Football v3 (RapidAPI), PostgreSQL `pg_cron` + `pg_net`

**Spec:** `docs/superpowers/specs/2026-03-18-f1-16-match-sync-edge-function-design.md`

---

## File Structure

```
supabase/functions/match-sync/
├── index.ts              # Entry point: parse mode, auth check, dispatch handler
├── api-football.ts       # API-Football HTTP client + response types
├── mapper.ts             # Map API fixture → matches table row
├── mapper.test.ts        # Unit tests for mapper (Deno test runner)
└── sync.ts               # Tournament lookup + UPSERT logic

supabase/migrations/
├── 00011_seed_tournaments.sql      # Seed initial tournaments with api_league_id
└── 00012_match_sync_cron.sql       # Enable pg_cron + pg_net, create cron jobs

.env.example              # Add API_FOOTBALL_KEY entry
```

---

## Task 1: Seed Tournaments Migration

**Files:**

- Create: `supabase/migrations/00011_seed_tournaments.sql`

This migration seeds the initial Uruguayan and South American tournaments that PencaViva tracks, with their `api_league_id` values for API-Football mapping.

- [ ] **Step 1: Verify API-Football league IDs**

Before writing the migration, we need correct league IDs. The spec has placeholders. For MVP, use these verified IDs from API-Football:

- Liga Profesional Uruguay → league ID `268` (Primera División Uruguay)
- Copa Libertadores → league ID `13`
- Copa Sudamericana → league ID `11`

**Note:** If you have API access, verify with `GET /leagues?country=Uruguay` and `GET /leagues?search=Libertadores`. Otherwise, use these well-known IDs and adjust later.

- [ ] **Step 2: Write the seed migration**

Create `supabase/migrations/00011_seed_tournaments.sql`:

```sql
-- Add unique constraint on (api_league_id, season) so match-sync can resolve
-- API-Football league IDs to tournament UUIDs unambiguously, and so the seed
-- INSERT is safely re-runnable.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tournaments_api_league_season
  ON tournaments (api_league_id, season)
  WHERE api_league_id IS NOT NULL;

-- Seed initial tournaments with API-Football league IDs.
INSERT INTO tournaments (name, short_name, sport, country, season, api_league_id, status, start_date, end_date)
VALUES
  ('Primera División Uruguay', 'PDU', 'football', 'Uruguay', '2026', 268, 'active', '2026-02-01', '2026-12-15'),
  ('Copa Libertadores', 'Libertadores', 'football', 'South America', '2026', 13, 'active', '2026-02-01', '2026-11-30'),
  ('Copa Sudamericana', 'Sudamericana', 'football', 'South America', '2026', 11, 'active', '2026-02-01', '2026-11-30')
ON CONFLICT (api_league_id, season) DO NOTHING;
```

- [ ] **Step 3: Verify migration applies locally**

Run:

```bash
npx supabase db reset
```

Expected: All migrations apply including 00011. No errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00011_seed_tournaments.sql
git commit -m "feat(db): seed initial tournaments with API-Football league IDs"
```

---

## Task 2: Data Mapper Module + Tests

**Files:**

- Create: `supabase/functions/match-sync/mapper.ts`
- Create: `supabase/functions/match-sync/mapper.test.ts`

The mapper converts API-Football fixture responses into rows for our `matches` table. This is the most testable unit — pure functions, no I/O.

- [ ] **Step 1: Write the mapper types and function**

Create `supabase/functions/match-sync/mapper.ts`:

```typescript
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
```

- [ ] **Step 2: Write mapper unit tests**

Create `supabase/functions/match-sync/mapper.test.ts`:

```typescript
import { assertEquals } from "jsr:@std/assert@1";
import {
  mapApiStatus,
  mapFixtureToMatch,
  parseMatchday,
  type ApiFixture,
} from "./mapper.ts";

// ── Helper: minimal valid fixture ──────────────────────────────────

function makeFixture(
  overrides: Partial<{
    id: number;
    date: string;
    statusShort: string;
    venue: string | null;
    leagueId: number;
    round: string | null;
    homeName: string;
    awayName: string;
    homeLogo: string | null;
    awayLogo: string | null;
    homeGoals: number | null;
    awayGoals: number | null;
  }> = {},
): ApiFixture {
  return {
    fixture: {
      id: overrides.id ?? 1001,
      date: overrides.date ?? "2026-03-20T20:00:00+00:00",
      status: { short: overrides.statusShort ?? "NS" },
      venue: { name: overrides.venue ?? "Estadio Centenario" },
    },
    league: {
      id: overrides.leagueId ?? 268,
      round: overrides.round ?? "Regular Season - 5",
    },
    teams: {
      home: {
        name: overrides.homeName ?? "Peñarol",
        logo: overrides.homeLogo ?? "https://example.com/penarol.png",
      },
      away: {
        name: overrides.awayName ?? "Nacional",
        logo: overrides.awayLogo ?? "https://example.com/nacional.png",
      },
    },
    goals: {
      home: overrides.homeGoals ?? null,
      away: overrides.awayGoals ?? null,
    },
  };
}

const TOURNAMENT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

// ── mapApiStatus tests ─────────────────────────────────────────────

Deno.test("mapApiStatus: scheduled statuses", () => {
  assertEquals(mapApiStatus("TBD"), "scheduled");
  assertEquals(mapApiStatus("NS"), "scheduled");
});

Deno.test("mapApiStatus: live statuses", () => {
  for (const s of ["1H", "HT", "2H", "ET", "BT", "P", "INT", "LIVE"]) {
    assertEquals(mapApiStatus(s), "live");
  }
});

Deno.test("mapApiStatus: finished statuses", () => {
  for (const s of ["FT", "AET", "PEN"]) {
    assertEquals(mapApiStatus(s), "finished");
  }
});

Deno.test("mapApiStatus: postponed statuses", () => {
  assertEquals(mapApiStatus("PST"), "postponed");
  assertEquals(mapApiStatus("SUSP"), "postponed");
});

Deno.test("mapApiStatus: cancelled statuses", () => {
  for (const s of ["CANC", "ABD", "AWD", "WO"]) {
    assertEquals(mapApiStatus(s), "cancelled");
  }
});

Deno.test("mapApiStatus: unknown status defaults to scheduled", () => {
  assertEquals(mapApiStatus("UNKNOWN"), "scheduled");
  assertEquals(mapApiStatus(""), "scheduled");
});

// ── parseMatchday tests ────────────────────────────────────────────

Deno.test("parseMatchday: extracts number from round string", () => {
  assertEquals(parseMatchday("Regular Season - 5"), 5);
  assertEquals(parseMatchday("Clausura - 12"), 12);
  assertEquals(parseMatchday("Round 1"), 1);
});

Deno.test("parseMatchday: returns null for non-numeric or null", () => {
  assertEquals(parseMatchday(null), null);
  assertEquals(parseMatchday("Quarterfinals"), null);
  assertEquals(parseMatchday(""), null);
});

// ── mapFixtureToMatch tests ────────────────────────────────────────

Deno.test("mapFixtureToMatch: maps a scheduled fixture correctly", () => {
  const fixture = makeFixture({ statusShort: "NS" });
  const row = mapFixtureToMatch(fixture, TOURNAMENT_ID);

  assertEquals(row.api_match_id, 1001);
  assertEquals(row.tournament_id, TOURNAMENT_ID);
  assertEquals(row.home_team_name, "Peñarol");
  assertEquals(row.away_team_name, "Nacional");
  assertEquals(row.status, "scheduled");
  assertEquals(row.home_score, null);
  assertEquals(row.away_score, null);
  assertEquals(row.matchday, 5);
  assertEquals(row.venue, "Estadio Centenario");
});

Deno.test("mapFixtureToMatch: maps a finished fixture with scores", () => {
  const fixture = makeFixture({
    statusShort: "FT",
    homeGoals: 2,
    awayGoals: 1,
  });
  const row = mapFixtureToMatch(fixture, TOURNAMENT_ID);

  assertEquals(row.status, "finished");
  assertEquals(row.home_score, 2);
  assertEquals(row.away_score, 1);
});

Deno.test("mapFixtureToMatch: finished with null scores stays live", () => {
  const fixture = makeFixture({
    statusShort: "FT",
    homeGoals: null,
    awayGoals: null,
  });
  const row = mapFixtureToMatch(fixture, TOURNAMENT_ID);

  assertEquals(row.status, "live");
});

Deno.test("mapFixtureToMatch: finished with one null score stays live", () => {
  const fixture = makeFixture({
    statusShort: "AET",
    homeGoals: 3,
    awayGoals: null,
  });
  const row = mapFixtureToMatch(fixture, TOURNAMENT_ID);

  assertEquals(row.status, "live");
});

Deno.test("mapFixtureToMatch: null venue returns null", () => {
  const fixture = makeFixture();
  fixture.fixture.venue = null;
  const row = mapFixtureToMatch(fixture, TOURNAMENT_ID);

  assertEquals(row.venue, null);
});

Deno.test("mapFixtureToMatch: preserves kickoff_time as ISO string", () => {
  const fixture = makeFixture({ date: "2026-06-15T19:30:00+00:00" });
  const row = mapFixtureToMatch(fixture, TOURNAMENT_ID);

  assertEquals(row.kickoff_time, "2026-06-15T19:30:00+00:00");
});
```

- [ ] **Step 3: Run mapper tests to verify they pass**

Run:

```bash
cd supabase/functions/match-sync && deno test mapper.test.ts
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/match-sync/mapper.ts supabase/functions/match-sync/mapper.test.ts
git commit -m "feat(edge): add match-sync mapper with status mapping and unit tests"
```

---

## Task 3: API-Football Client Module

**Files:**

- Create: `supabase/functions/match-sync/api-football.ts`

HTTP client for API-Football. Handles authentication, endpoint construction, and response parsing. No tests for this module — it's a thin HTTP wrapper tested via integration.

- [ ] **Step 1: Write the API client**

Create `supabase/functions/match-sync/api-football.ts`:

```typescript
/**
 * API-Football HTTP client.
 * Thin wrapper around fetch — handles auth headers and response parsing.
 */

import type { ApiFixture } from "./mapper.ts";

const BASE_URL = "https://api-football-v3.p.rapidapi.com";

interface ApiFootballResponse {
  results: number;
  response: ApiFixture[];
}

export interface ApiClientConfig {
  apiKey: string;
}

export interface FetchResult {
  fixtures: ApiFixture[];
  quotaRemaining: number | null;
}

/**
 * Thrown when API-Football returns 429 (rate limit exceeded).
 * Callers should stop making further requests when this is caught.
 */
export class RateLimitError extends Error {
  constructor(quotaRemaining: number | null) {
    super(
      `API-Football rate limit exceeded (remaining: ${quotaRemaining ?? "unknown"})`,
    );
    this.name = "RateLimitError";
  }
}

async function callApi(
  endpoint: string,
  params: Record<string, string>,
  config: ApiClientConfig,
): Promise<FetchResult> {
  const url = new URL(endpoint, BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "x-rapidapi-key": config.apiKey,
      "x-rapidapi-host": "api-football-v3.p.rapidapi.com",
    },
  });

  const quotaHeader = response.headers.get("x-ratelimit-requests-remaining");
  const quotaRemaining = quotaHeader ? parseInt(quotaHeader, 10) : null;

  if (response.status === 429) {
    throw new RateLimitError(quotaRemaining);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `API-Football error ${response.status}: ${body.slice(0, 200)}`,
    );
  }

  const data: ApiFootballResponse = await response.json();
  return { fixtures: data.response ?? [], quotaRemaining };
}

/**
 * Fetch all fixtures for a league/season (daily sync).
 */
export async function fetchFixturesByLeague(
  leagueId: number,
  season: string,
  config: ApiClientConfig,
): Promise<FetchResult> {
  return callApi("/fixtures", { league: String(leagueId), season }, config);
}

/**
 * Fetch all currently live fixtures globally (live polling).
 */
export async function fetchLiveFixtures(
  config: ApiClientConfig,
): Promise<FetchResult> {
  return callApi("/fixtures", { live: "all" }, config);
}

/**
 * Fetch a single fixture by its API-Football ID (single mode).
 */
export async function fetchFixtureById(
  fixtureId: number,
  config: ApiClientConfig,
): Promise<FetchResult> {
  return callApi("/fixtures", { id: String(fixtureId) }, config);
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/match-sync/api-football.ts
git commit -m "feat(edge): add API-Football HTTP client module"
```

---

## Task 4: Sync Logic Module

**Files:**

- Create: `supabase/functions/match-sync/sync.ts`

Core sync logic: loads tournament map from DB, calls API-Football, maps fixtures, and UPSERTs into `matches` table.

- [ ] **Step 1: Write the sync module**

Create `supabase/functions/match-sync/sync.ts`:

```typescript
/**
 * Sync logic: tournament resolution + UPSERT into matches.
 * Orchestrates api-football.ts and mapper.ts.
 */

import { type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  fetchFixturesByLeague,
  fetchLiveFixtures,
  fetchFixtureById,
  RateLimitError,
  type ApiClientConfig,
} from "./api-football.ts";
import { mapFixtureToMatch, type ApiFixture, type MatchRow } from "./mapper.ts";

// ── Types ───────────────────────────────────────────────────────────

export interface TournamentEntry {
  tournamentId: string;
  apiLeagueId: number;
  season: string;
}

export interface SyncResult {
  mode: "daily" | "live" | "single";
  tournaments_synced: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ api_match_id: number; error: string }>;
  api_quota_remaining: number | null;
  duration_ms: number;
}

// ── Tournament map loader ───────────────────────────────────────────

/**
 * Load active tournaments with api_league_id from the DB.
 * Returns a Map from api_league_id → { tournamentId, season }.
 */
export async function loadActiveTournaments(
  supabase: SupabaseClient,
): Promise<Map<number, TournamentEntry>> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, api_league_id, season")
    .eq("status", "active")
    .not("api_league_id", "is", null);

  if (error) throw new Error(`Failed to load tournaments: ${error.message}`);

  const map = new Map<number, TournamentEntry>();
  for (const row of data ?? []) {
    map.set(row.api_league_id, {
      tournamentId: row.id,
      apiLeagueId: row.api_league_id,
      season: row.season,
    });
  }
  return map;
}

// ── UPSERT helper ───────────────────────────────────────────────────

/**
 * UPSERT match rows into the matches table.
 * Returns counts of inserted, updated, and skipped rows.
 */
async function upsertMatches(
  supabase: SupabaseClient,
  rows: MatchRow[],
): Promise<{ inserted: number; updated: number }> {
  if (rows.length === 0) return { inserted: 0, updated: 0 };

  // Get existing api_match_ids to distinguish insert vs update
  const apiIds = rows.map((r) => r.api_match_id);
  const { data: existing } = await supabase
    .from("matches")
    .select("api_match_id")
    .in("api_match_id", apiIds);

  const existingIds = new Set(
    (existing ?? []).map((e: { api_match_id: number }) => e.api_match_id),
  );

  const { error } = await supabase
    .from("matches")
    .upsert(rows, { onConflict: "api_match_id" });

  if (error) throw new Error(`UPSERT failed: ${error.message}`);

  const updated = rows.filter((r) => existingIds.has(r.api_match_id)).length;
  const inserted = rows.length - updated;
  return { inserted, updated };
}

// ── Sync modes ──────────────────────────────────────────────────────

/**
 * Daily sync: fetch all fixtures for each active tournament (or a specific one).
 */
export async function syncDaily(
  supabase: SupabaseClient,
  config: ApiClientConfig,
  tournamentMap: Map<number, TournamentEntry>,
  leagueId?: number,
  season?: string,
): Promise<SyncResult> {
  const start = Date.now();
  const result: SyncResult = {
    mode: "daily",
    tournaments_synced: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    api_quota_remaining: null,
    duration_ms: 0,
  };

  // Determine which tournaments to sync
  const entries: TournamentEntry[] = [];
  if (leagueId !== undefined) {
    const entry = tournamentMap.get(leagueId);
    if (!entry) {
      result.duration_ms = Date.now() - start;
      return result; // Unknown league — nothing to sync
    }
    entries.push({
      ...entry,
      season: season ?? entry.season,
    });
  } else {
    entries.push(...tournamentMap.values());
  }

  for (const entry of entries) {
    try {
      const { fixtures, quotaRemaining } = await fetchFixturesByLeague(
        entry.apiLeagueId,
        entry.season,
        config,
      );
      result.api_quota_remaining = quotaRemaining;

      const rows = fixtures.map((f) =>
        mapFixtureToMatch(f, entry.tournamentId),
      );

      if (rows.length > 0) {
        const counts = await upsertMatches(supabase, rows);
        result.inserted += counts.inserted;
        result.updated += counts.updated;
      }
      result.tournaments_synced++;
    } catch (err) {
      // Rate limit: stop processing remaining tournaments
      if (err instanceof RateLimitError) {
        console.error("Rate limit hit, stopping daily sync");
        result.errors.push({ api_match_id: 0, error: err.message });
        break;
      }
      // Other errors: log and continue with remaining tournaments
      console.error(
        `Error syncing league ${entry.apiLeagueId}:`,
        err instanceof Error ? err.message : err,
      );
      result.errors.push({
        api_match_id: 0,
        error: `League ${entry.apiLeagueId}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  result.duration_ms = Date.now() - start;
  return result;
}

/**
 * Live sync: fetch all live fixtures, filter to our tournaments, UPSERT.
 */
export async function syncLive(
  supabase: SupabaseClient,
  config: ApiClientConfig,
  tournamentMap: Map<number, TournamentEntry>,
): Promise<SyncResult> {
  const start = Date.now();
  const result: SyncResult = {
    mode: "live",
    tournaments_synced: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    api_quota_remaining: null,
    duration_ms: 0,
  };

  const { fixtures, quotaRemaining } = await fetchLiveFixtures(config);
  result.api_quota_remaining = quotaRemaining;

  // Filter to only our tournaments
  const relevantFixtures: Array<{ fixture: ApiFixture; tournamentId: string }> =
    [];
  const tournamentsSeen = new Set<string>();

  for (const fixture of fixtures) {
    const entry = tournamentMap.get(fixture.league.id);
    if (entry) {
      relevantFixtures.push({ fixture, tournamentId: entry.tournamentId });
      tournamentsSeen.add(entry.tournamentId);
    } else {
      result.skipped++;
    }
  }

  result.tournaments_synced = tournamentsSeen.size;

  if (relevantFixtures.length > 0) {
    const rows = relevantFixtures.map(({ fixture, tournamentId }) =>
      mapFixtureToMatch(fixture, tournamentId),
    );
    const counts = await upsertMatches(supabase, rows);
    result.inserted += counts.inserted;
    result.updated += counts.updated;
  }

  result.duration_ms = Date.now() - start;
  return result;
}

/**
 * Single match sync: fetch one fixture by ID, UPSERT it.
 */
export async function syncSingle(
  supabase: SupabaseClient,
  config: ApiClientConfig,
  tournamentMap: Map<number, TournamentEntry>,
  fixtureId: number,
): Promise<SyncResult> {
  const start = Date.now();
  const result: SyncResult = {
    mode: "single",
    tournaments_synced: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    api_quota_remaining: null,
    duration_ms: 0,
  };

  const { fixtures, quotaRemaining } = await fetchFixtureById(
    fixtureId,
    config,
  );
  result.api_quota_remaining = quotaRemaining;

  if (fixtures.length === 0) {
    result.duration_ms = Date.now() - start;
    return result;
  }

  const fixture = fixtures[0];
  const entry = tournamentMap.get(fixture.league.id);
  if (!entry) {
    result.skipped = 1;
    result.duration_ms = Date.now() - start;
    return result;
  }

  const row = mapFixtureToMatch(fixture, entry.tournamentId);
  const counts = await upsertMatches(supabase, [row]);
  result.inserted = counts.inserted;
  result.updated = counts.updated;
  result.tournaments_synced = 1;
  result.duration_ms = Date.now() - start;
  return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/match-sync/sync.ts
git commit -m "feat(edge): add match-sync tournament resolution and UPSERT logic"
```

---

## Task 5: Edge Function Entry Point

**Files:**

- Create: `supabase/functions/match-sync/index.ts`

The entry point validates the request, authenticates via `service_role` key, and dispatches to the correct sync mode.

- [ ] **Step 1: Write the entry point**

Create `supabase/functions/match-sync/index.ts`:

```typescript
/**
 * match-sync Edge Function entry point.
 *
 * Modes:
 *   POST { "mode": "daily" }                         — sync all active tournaments
 *   POST { "mode": "daily", "leagueId": 268, "season": "2026" } — sync one league
 *   POST { "mode": "live" }                          — poll all live matches
 *   POST { "mode": "single", "fixtureId": 12345 }   — refresh one match
 *
 * Auth: Authorization: Bearer <service_role_key>
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  loadActiveTournaments,
  syncDaily,
  syncLive,
  syncSingle,
  type SyncResult,
} from "./sync.ts";

Deno.serve(async (req) => {
  try {
    // ── Auth check ────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    const expectedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Parse body ────────────────────────────────────────────────
    const body = await req.json();
    const mode = body.mode as string;

    if (!mode || !["daily", "live", "single"].includes(mode)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid mode. Must be "daily", "live", or "single".',
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // ── Supabase admin client ─────────────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── API-Football config ───────────────────────────────────────
    const apiKey = Deno.env.get("API_FOOTBALL_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API_FOOTBALL_KEY secret not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
    const apiConfig = { apiKey };

    // ── Load tournament map ───────────────────────────────────────
    const tournamentMap = await loadActiveTournaments(supabase);
    if (tournamentMap.size === 0) {
      return new Response(
        JSON.stringify({
          error: "No active tournaments with api_league_id found",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    // ── Dispatch ──────────────────────────────────────────────────
    let result: SyncResult;

    switch (mode) {
      case "daily":
        result = await syncDaily(
          supabase,
          apiConfig,
          tournamentMap,
          body.leagueId as number | undefined,
          body.season as string | undefined,
        );
        break;

      case "live":
        result = await syncLive(supabase, apiConfig, tournamentMap);
        break;

      case "single": {
        const fixtureId = body.fixtureId as number | undefined;
        if (!fixtureId) {
          return new Response(
            JSON.stringify({
              error: "fixtureId is required for single mode",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        result = await syncSingle(
          supabase,
          apiConfig,
          tournamentMap,
          fixtureId,
        );
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Unexpected mode" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
    }

    // ── Response ──────────────────────────────────────────────────
    console.log(
      `match-sync [${mode}]: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped, ${result.errors.length} errors, ${result.duration_ms}ms`,
    );

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("match-sync error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
```

- [ ] **Step 2: Verify Deno can type-check the function**

Run:

```bash
deno check supabase/functions/match-sync/index.ts
```

Expected: No errors. If there are import issues, ensure the npm: and jsr: specifiers are correct.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/match-sync/index.ts
git commit -m "feat(edge): add match-sync entry point with auth, mode dispatch"
```

---

## Task 6: Cron Scheduling Migration

**Files:**

- Create: `supabase/migrations/00012_match_sync_cron.sql`

Enable `pg_cron` and `pg_net` extensions and create the two scheduled jobs.

- [ ] **Step 1: Write the cron migration**

Create `supabase/migrations/00012_match_sync_cron.sql`:

```sql
-- Enable extensions for scheduled Edge Function invocation.
-- pg_cron + pg_net are platform extensions available on Supabase hosted.
-- Wrapped in exception handlers so this migration is non-fatal on local dev
-- (where these extensions may not be available).

DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available (local dev), skipping';
END $$;

DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net not available (local dev), skipping';
END $$;

-- Schedule cron jobs (only if pg_cron is available)
DO $$ BEGIN
  -- Daily sync: runs at 04:00 UTC, syncs all active tournaments
  PERFORM cron.schedule(
    'match-sync-daily',
    '0 4 * * *',
    $job$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/match-sync',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{"mode": "daily"}'::jsonb
    );
    $job$
  );

  -- Live polling: every 2 minutes (Pro tier only for API quota)
  PERFORM cron.schedule(
    'match-sync-live',
    '*/2 * * * *',
    $job$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/match-sync',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{"mode": "live"}'::jsonb
    );
    $job$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron scheduling not available (local dev), skipping';
END $$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/00012_match_sync_cron.sql
git commit -m "feat(db): add pg_cron jobs for daily and live match sync"
```

**Note:** `pg_cron` and `pg_net` are platform extensions available on Supabase hosted. On local dev, the exception handlers make this migration non-fatal — it will log notices and proceed. Local testing uses manual `curl` invocation instead of cron.

---

## Task 7: Environment & Configuration Updates

**Files:**

- Modify: `.env.example`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add API_FOOTBALL_KEY to .env.example**

Add the following block to `.env.example` after the existing `SUPABASE_SERVICE_ROLE_KEY` entry:

```bash
# API-Football (RapidAPI) — used by match-sync Edge Function
# Get your key at: https://rapidapi.com/api-sports/api/api-football
# Free tier: 100 req/day (dev), Pro tier: 7,500 req/day (production)
API_FOOTBALL_KEY=
```

- [ ] **Step 2: Update CLAUDE.md with Edge Function documentation**

Add a new section after "## Authentication" in CLAUDE.md:

```markdown
## Edge Functions

- **Runtime**: Supabase Edge Functions run on Deno v2 (not Node.js). Use `npm:` specifiers for npm packages (e.g., `import { createClient } from "npm:@supabase/supabase-js@2"`) and `jsr:` for Deno standard library
- **Auth pattern**: Edge Functions that modify data use `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS). Validate the `Authorization` header matches the service role key to prevent unauthorized access
- **Local dev**: `supabase functions serve match-sync` starts the function with hot reload. Test with `curl -X POST http://localhost:54321/functions/v1/match-sync -H "Authorization: Bearer <service_role_key>" -H "Content-Type: application/json" -d '{"mode":"daily"}'`
- **Testing**: Mapper/pure-logic modules use Deno's built-in test runner (`deno test`). Integration tests hit local Supabase
- **Secrets**: Store API keys via `supabase secrets set KEY=value`. Access in code via `Deno.env.get('KEY')`. Default secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.) are auto-injected
- **Cron**: `pg_cron` + `pg_net` extensions schedule periodic Edge Function calls. Jobs defined in SQL migrations. Only works on Supabase hosted — local dev uses manual curl

### match-sync Function

First Edge Function in the project. Syncs match data from API-Football into the `matches` table.

- **Modes**: `daily` (all active tournaments), `live` (in-progress matches), `single` (one fixture by ID)
- **Tournament resolution**: Maps `api_league_id` (integer from API-Football) → `tournament_id` (UUID) via `tournaments` table
- **UPSERT**: Uses `api_match_id` as conflict key for idempotent writes
- **Trigger pipeline**: When a match transitions to `finished`, DB trigger `process_match_result()` → `calculate_prediction_points()` → `refresh_leaderboard_cache()`
- **Files**: `supabase/functions/match-sync/{index,api-football,mapper,sync}.ts`
```

- [ ] **Step 3: Commit**

```bash
git add .env.example CLAUDE.md
git commit -m "docs: add Edge Function patterns and API-Football config to CLAUDE.md"
```

---

## Task 8: Update TAREAS.md

**Files:**

- Modify: `TAREAS.md`

- [ ] **Step 1: Mark F1-16 as complete**

Change F1-16 from `- [ ]` to `- [x]` in TAREAS.md. Update the progress counter.

- [ ] **Step 2: Commit**

```bash
git add TAREAS.md
git commit -m "docs: mark F1-16 complete"
```

---

## Task 9: Local Verification

Final verification that everything works together.

- [ ] **Step 1: Run mapper tests**

```bash
cd supabase/functions/match-sync && deno test mapper.test.ts
```

Expected: All tests pass.

- [ ] **Step 2: Type-check the Edge Function**

```bash
deno check supabase/functions/match-sync/index.ts
```

Expected: No type errors.

- [ ] **Step 3: Run existing project tests to ensure no regressions**

```bash
npm run test:ci
```

Expected: All existing tests pass. The Edge Function tests (Deno) are separate from the Jest tests (Node).

- [ ] **Step 4: Run lint and format checks**

```bash
npm run format:check && npm run lint && npm run typecheck
```

Expected: All pass. Edge Function files under `supabase/functions/` are Deno modules — they should not be picked up by the project's ESLint/TypeScript config (they use different module resolution). If lint picks them up, add `supabase/functions/` to `.eslintignore`.

- [ ] **Step 5: Verify migration applies (if local Supabase available)**

```bash
npx supabase db reset 2>&1 | tail -20
```

Expected: Migrations 00001–00012 apply. Migration 00012 logs notices about pg_cron/pg_net not being available locally but does not fail.

**Spec deviation note:** The spec's testing section mentions "Tournament ID resolution (known league → resolved, unknown league → skipped)" as a mapper test. In this plan, tournament resolution lives in `sync.ts` (not the pure mapper), so this case is covered by integration testing against local Supabase and the filtering logic in `syncLive`/`syncSingle`. The mapper itself receives a pre-resolved `tournamentId`.
