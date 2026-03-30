import { assertEquals } from "jsr:@std/assert@1";
import { buildBody, buildTitle, fetchRemindersToSend } from "./query.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// ── Helpers ────────────────────────────────────────────────────────────

const NOW = new Date("2026-03-30T12:00:00.000Z");

const TOURNAMENT_ID = "tournament-uuid-001";

/** Creates a minimal Supabase client stub that returns the provided data
 *  for each table query in sequence. Each .from() call consumes the next entry. */
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

    const noop = () => chain;
    chain.select = noop;
    chain.eq = noop;
    chain.gte = noop;
    chain.lte = noop;
    chain.in = noop;
    chain.not = noop;

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

/** Makes a group_tournaments response with the nested join shape
 *  that fetchRemindersToSend expects after the query restructure. */
function makeGroupTournamentsResponse(
  userId: string,
  displayName: string,
  pushToken: string,
) {
  return [
    {
      groups: {
        group_members: [
          {
            user_id: userId,
            is_active: true,
            profiles: { display_name: displayName, push_token: pushToken },
          },
        ],
      },
    },
  ];
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
            tournament_id: TOURNAMENT_ID,
          },
        ],
      },
      // group_tournaments → group_members → profiles
      {
        table: "group_tournaments",
        data: makeGroupTournamentsResponse(
          userId,
          "Juan",
          "ExponentPushToken[xxx]",
        ),
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
            tournament_id: TOURNAMENT_ID,
          },
        ],
      },
      {
        table: "group_tournaments",
        data: makeGroupTournamentsResponse(
          userId,
          "Maria",
          "ExponentPushToken[yyy]",
        ),
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
            tournament_id: TOURNAMENT_ID,
          },
        ],
      },
      {
        table: "group_tournaments",
        data: makeGroupTournamentsResponse(
          userId,
          "Carlos",
          "ExponentPushToken[zzz]",
        ),
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
          tournament_id: TOURNAMENT_ID,
        },
      ],
    },
    {
      table: "group_tournaments",
      data: makeGroupTournamentsResponse(
        userId,
        "Rodrigo",
        "ExponentPushToken[abc]",
      ),
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
            tournament_id: TOURNAMENT_ID,
          },
        ],
      },
      // group_tournaments query errors
      {
        table: "group_tournaments",
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

Deno.test(
  "fetchRemindersToSend: deduplicates users that appear in multiple groups",
  async () => {
    const matchId = "match-uuid-005";
    const userId = "user-uuid-005";

    // Same user appears in two group_tournaments rows (member of 2 groups)
    const supabase = makeStubClient([
      {
        table: "matches",
        data: [
          {
            id: matchId,
            home_team_name: "X",
            away_team_name: "Y",
            kickoff_time: "2026-03-30T14:05:00Z",
            tournament_id: TOURNAMENT_ID,
          },
        ],
      },
      {
        table: "group_tournaments",
        data: [
          {
            groups: {
              group_members: [
                {
                  user_id: userId,
                  is_active: true,
                  profiles: {
                    display_name: "Dual",
                    push_token: "ExponentPushToken[d]",
                  },
                },
              ],
            },
          },
          {
            groups: {
              group_members: [
                {
                  user_id: userId,
                  is_active: true,
                  profiles: {
                    display_name: "Dual",
                    push_token: "ExponentPushToken[d]",
                  },
                },
              ],
            },
          },
        ],
      },
      { table: "predictions", data: [] },
      { table: "notifications", data: [] },
      { table: "matches", data: [] },
    ]);

    const result = await fetchRemindersToSend(supabase, NOW);
    // User should appear exactly once despite being in two groups
    assertEquals(result.length, 1);
    assertEquals(result[0].users.length, 1);
    assertEquals(result[0].users[0].userId, userId);
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
  assertEquals(
    buildBody(120),
    "2 hours to kick off — your prediction is still missing. Don't let your friends score while you sit this one out.",
  );
});

Deno.test("buildBody: 30min window copy", () => {
  assertEquals(
    buildBody(30),
    "Last call! Submit your prediction before kickoff and stay in the game.",
  );
});
