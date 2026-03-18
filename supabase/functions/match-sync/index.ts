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
