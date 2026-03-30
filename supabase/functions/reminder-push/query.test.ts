import { assertEquals } from "jsr:@std/assert@1";
import { buildBody, buildTitle, fetchRemindersToSend } from "./query.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// ── Helpers ────────────────────────────────────────────────────────────

const NOW = new Date("2026-03-30T12:00:00.000Z");

/** Creates a minimal Supabase client stub that returns the provided data
 *  for the given table sequence. Each call to .from() consumes the next entry. */
function makeStubClient(
  responses: Array<{
    table: string;
    data: unknown[] | null;
    error?: { message: string } | null;
  }>,
): SupabaseClient {
  let callIndex = 0;

  const makeChain = (entry: (typeof responses)[0]) => {
    const chain: Record<string, unknown> = {};

    // All filter/select methods return the chain itself for fluent chaining
    const noop = () => chain;
    chain.select = noop;
    chain.eq = noop;
    chain.gte = noop;
    chain.lte = noop;
    chain.in = noop;
    chain.not = noop;

    // Awaiting resolves with the stubbed result
    chain.then = (
      resolve: (value: { data: unknown; error: unknown }) => void,
    ) => {
      resolve({ data: entry.data, error: entry.error ?? null });
    };

    return chain;
  };

  return {
    from: (_table: string) => {
      const entry = responses[callIndex++] ?? {
        table: "unknown",
        data: [],
        error: null,
      };
      return makeChain(entry);
    },
  } as unknown as SupabaseClient;
}

// ── fetchRemindersToSend ───────────────────────────────────────────────

Deno.test(
  "fetchRemindersToSend: returns empty when no matches in window",
  async () => {
    const supabase = makeStubClient([
      { table: "matches", data: [], error: null }, // 2h window
      { table: "matches", data: [], error: null }, // 30min window
    ]);

    const result = await fetchRemindersToSend(supabase, NOW);
    assertEquals(result, []);
  },
);

Deno.test(
  "fetchRemindersToSend: returns empty when all candidates already predicted",
  async () => {
    const matchId = "match-uuid-001";
    const userId = "user-uuid-001";
    const tournamentId = "tournament-uuid-001";

    const supabase = makeStubClient([
      // 2h window: one match found
      {
        table: "matches",
        data: [
          {
            id: matchId,
            home_team_name: "Peñarol",
            away_team_name: "Nacional",
            kickoff_time: "2026-03-30T14:00:00Z",
            tournament_id: tournamentId,
          },
        ],
      },
      // candidates: one user with push token
      {
        table: "group_members",
        data: [
          {
            user_id: userId,
            profiles: {
              display_name: "Juan",
              push_token: "ExponentPushToken[xxx]",
            },
            groups: { group_tournaments: [{ tournament_id: tournamentId }] },
          },
        ],
      },
      // predictions: this user already predicted
      { table: "predictions", data: [{ user_id: userId }] },
      // dedup: no recent notifications
      { table: "notifications", data: [] },
      // 30min window: no matches
      { table: "matches", data: [] },
    ]);

    const result = await fetchRemindersToSend(supabase, NOW);
    assertEquals(result, []);
  },
);

Deno.test(
  "fetchRemindersToSend: excludes users already notified (dedup)",
  async () => {
    const matchId = "match-uuid-002";
    const userId = "user-uuid-002";
    const tournamentId = "tournament-uuid-002";

    const supabase = makeStubClient([
      // 2h window: one match found
      {
        table: "matches",
        data: [
          {
            id: matchId,
            home_team_name: "River",
            away_team_name: "Boca",
            kickoff_time: "2026-03-30T14:10:00Z",
            tournament_id: tournamentId,
          },
        ],
      },
      // candidates: one user with push token
      {
        table: "group_members",
        data: [
          {
            user_id: userId,
            profiles: {
              display_name: "Maria",
              push_token: "ExponentPushToken[yyy]",
            },
            groups: { group_tournaments: [{ tournament_id: tournamentId }] },
          },
        ],
      },
      // predictions: user has NOT predicted
      { table: "predictions", data: [] },
      // dedup: user was already notified in the last 3h
      { table: "notifications", data: [{ user_id: userId }] },
      // 30min window: no matches
      { table: "matches", data: [] },
    ]);

    const result = await fetchRemindersToSend(supabase, NOW);
    assertEquals(result, []);
  },
);

Deno.test(
  "fetchRemindersToSend: returns eligible users for unpredicted match",
  async () => {
    const matchId = "match-uuid-003";
    const userId = "user-uuid-003";
    const tournamentId = "tournament-uuid-003";

    const supabase = makeStubClient([
      // 2h window: one match found
      {
        table: "matches",
        data: [
          {
            id: matchId,
            home_team_name: "Flamengo",
            away_team_name: "Palmeiras",
            kickoff_time: "2026-03-30T14:05:00Z",
            tournament_id: tournamentId,
          },
        ],
      },
      // candidates
      {
        table: "group_members",
        data: [
          {
            user_id: userId,
            profiles: {
              display_name: "Carlos",
              push_token: "ExponentPushToken[zzz]",
            },
            groups: { group_tournaments: [{ tournament_id: tournamentId }] },
          },
        ],
      },
      // predictions: none
      { table: "predictions", data: [] },
      // dedup: none
      { table: "notifications", data: [] },
      // 30min window: no matches
      { table: "matches", data: [] },
    ]);

    const result = await fetchRemindersToSend(supabase, NOW);
    assertEquals(result.length, 1);
    assertEquals(result[0].match.matchId, matchId);
    assertEquals(result[0].match.windowMinutes, 120);
    assertEquals(result[0].users.length, 1);
    assertEquals(result[0].users[0].userId, userId);
    assertEquals(result[0].users[0].pushToken, "ExponentPushToken[zzz]");
    assertEquals(result[0].users[0].displayName, "Carlos");
  },
);

Deno.test("fetchRemindersToSend: labels 30min window correctly", async () => {
  const matchId = "match-uuid-004";
  const userId = "user-uuid-004";
  const tournamentId = "tournament-uuid-004";

  const supabase = makeStubClient([
    // 2h window: no matches
    { table: "matches", data: [] },
    // 30min window: one match found
    {
      table: "matches",
      data: [
        {
          id: matchId,
          home_team_name: "Uruguay",
          away_team_name: "Brasil",
          kickoff_time: "2026-03-30T12:25:00Z",
          tournament_id: tournamentId,
        },
      ],
    },
    {
      table: "group_members",
      data: [
        {
          user_id: userId,
          profiles: {
            display_name: "Rodrigo",
            push_token: "ExponentPushToken[abc]",
          },
          groups: { group_tournaments: [{ tournament_id: tournamentId }] },
        },
      ],
    },
    { table: "predictions", data: [] },
    { table: "notifications", data: [] },
  ]);

  const result = await fetchRemindersToSend(supabase, NOW);
  assertEquals(result.length, 1);
  assertEquals(result[0].match.windowMinutes, 30);
});

Deno.test(
  "fetchRemindersToSend: skips match when candidates query errors",
  async () => {
    const supabase = makeStubClient([
      // 2h window: one match
      {
        table: "matches",
        data: [
          {
            id: "match-err",
            home_team_name: "A",
            away_team_name: "B",
            kickoff_time: "2026-03-30T14:05:00Z",
            tournament_id: "t-err",
          },
        ],
      },
      // candidates query errors
      {
        table: "group_members",
        data: null,
        error: { message: "connection reset" },
      },
      // 30min window: no matches
      { table: "matches", data: [] },
    ]);

    const result = await fetchRemindersToSend(supabase, NOW);
    assertEquals(result, []);
  },
);

// ── buildTitle ─────────────────────────────────────────────────────────

Deno.test("buildTitle: 2h window returns plain team names", () => {
  assertEquals(buildTitle("Peñarol", "Nacional", 120), "Peñarol vs Nacional");
  assertEquals(
    buildTitle("River Plate", "Boca Juniors", 120),
    "River Plate vs Boca Juniors",
  );
});

Deno.test("buildTitle: 30min window appends time suffix", () => {
  assertEquals(
    buildTitle("Peñarol", "Nacional", 30),
    "Peñarol vs Nacional — 30 min to go",
  );
});

// ── buildBody ──────────────────────────────────────────────────────────

Deno.test("buildBody: 2h window copy", () => {
  const body = buildBody(120);
  assertEquals(typeof body, "string");
  assertEquals(body.length > 0, true);
});

Deno.test("buildBody: 30min window copy", () => {
  const body = buildBody(30);
  assertEquals(typeof body, "string");
  assertEquals(body.length > 0, true);
  // 30min copy should be distinct from 2h copy
  assertEquals(body !== buildBody(120), true);
});
