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
