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
 * Returns counts of inserted and updated rows.
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
  const relevantFixtures: Array<{
    fixture: ApiFixture;
    tournamentId: string;
  }> = [];
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
