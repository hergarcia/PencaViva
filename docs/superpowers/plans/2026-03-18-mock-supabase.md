# Mock Supabase System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the real Supabase client with an in-memory mock when `EXPO_PUBLIC_USE_MOCKS=true`, enabling offline UI development without Docker or network.

**Architecture:** A mock client implements the Supabase SDK's chaining API (`.from()`, `.select()`, `.eq()`, `.rpc()`, `.auth`, `.storage`) operating on in-memory Maps seeded with fixtures. The conditional switch lives in `src/lib/supabase.ts`; all services remain unchanged.

**Tech Stack:** TypeScript, Supabase JS SDK types (`SupabaseClient`, `Session`, `User`), Expo env vars, Jest

**Spec:** `docs/superpowers/specs/2026-03-18-mock-supabase-design.md`

---

## File Structure

| Action | File                                                | Responsibility                                                                          |
| ------ | --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Create | `src/lib/mock/index.ts`                             | Re-exports `createMockClient`                                                           |
| Create | `src/lib/mock/mock-store.ts`                        | In-memory Maps for all 9 tables, seeded from fixtures                                   |
| Create | `src/lib/mock/fixtures.ts`                          | Realistic seed data (UUIDs, dates, profiles, groups, matches, predictions)              |
| Create | `src/lib/mock/mock-query-builder.ts`                | Chaining query builder: `.select()`, `.eq()`, `.insert()`, `.upsert()`, etc.            |
| Create | `src/lib/mock/mock-auth.ts`                         | Mock auth: `signInWithIdToken`, `signOut`, `onAuthStateChange`, `getUser`, `getSession` |
| Create | `src/lib/mock/mock-storage.ts`                      | Mock storage: `upload` (no-op), `getPublicUrl` (placeholder URL)                        |
| Create | `src/lib/mock/mock-client.ts`                       | Assembles mock client with `.from()`, `.rpc()`, `.auth`, `.storage`                     |
| Create | `src/__tests__/lib/mock/mock-query-builder.test.ts` | Tests for query builder chain operations                                                |
| Create | `src/__tests__/lib/mock/mock-auth.test.ts`          | Tests for mock auth behavior                                                            |
| Create | `src/__tests__/lib/mock/mock-integration.test.ts`   | End-to-end tests: services work with mock client                                        |
| Modify | `src/lib/supabase.ts`                               | Conditional export: mock or real client                                                 |
| Modify | `src/lib/google-auth.ts`                            | Mock path for `configureGoogleSignIn`, `signInWithGoogle`, `signOutFromGoogle`          |
| Modify | `.env.example`                                      | Add `EXPO_PUBLIC_USE_MOCKS` entry                                                       |
| Modify | `CLAUDE.md`                                         | Add step 6.5 (mock verification) to Task Workflow                                       |
| Modify | `TAREAS.md`                                         | Add mock system task, mark complete                                                     |

---

## Task 1: Fixtures — Seed Data

**Files:**

- Create: `src/lib/mock/fixtures.ts`

This is the data foundation. All subsequent tasks depend on realistic IDs and shapes.

- [ ] **Step 1: Create fixtures file with all seed data**

```ts
// src/lib/mock/fixtures.ts

// ── Fixed UUIDs for stable references ────────────────────────────────

export const MOCK_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

export const MOCK_GROUP_IDS = {
  owned: "g0000001-0000-0000-0000-000000000001",
  member: "g0000002-0000-0000-0000-000000000002",
} as const;

export const MOCK_MEMBER_IDS = {
  alice: "m0000001-0000-0000-0000-000000000001",
  bob: "m0000002-0000-0000-0000-000000000002",
  carol: "m0000003-0000-0000-0000-000000000003",
  dave: "m0000004-0000-0000-0000-000000000004",
} as const;

export const MOCK_TOURNAMENT_ID = "t0000001-0000-0000-0000-000000000001";

// Match IDs: 10 matches across different states
export const MOCK_MATCH_IDS = {
  scheduled1: "mt000001-0000-0000-0000-000000000001",
  scheduled2: "mt000002-0000-0000-0000-000000000002",
  scheduled3: "mt000003-0000-0000-0000-000000000003",
  scheduled4: "mt000004-0000-0000-0000-000000000004",
  live1: "mt000005-0000-0000-0000-000000000005",
  live2: "mt000006-0000-0000-0000-000000000006",
  finished1: "mt000007-0000-0000-0000-000000000007",
  finished2: "mt000008-0000-0000-0000-000000000008",
  finished3: "mt000009-0000-0000-0000-000000000009",
  postponed1: "mt000010-0000-0000-0000-000000000010",
} as const;

export const MOCK_PREDICTION_IDS = {
  pred1: "pr000001-0000-0000-0000-000000000001",
  pred2: "pr000002-0000-0000-0000-000000000002",
  pred3: "pr000003-0000-0000-0000-000000000003",
  pred4: "pr000004-0000-0000-0000-000000000004",
} as const;

// ── Date helpers ────────────────────────────────────────────────────

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(20, 0, 0, 0);
  return d.toISOString();
}

function daysAgo(days: number): string {
  return daysFromNow(-days);
}

// ── Profiles ────────────────────────────────────────────────────────

export const mockProfiles = [
  {
    id: MOCK_USER_ID,
    username: "hernan_uy",
    display_name: "Hernan Garcia",
    avatar_url: "https://placehold.co/200x200/00D4AA/white?text=HG",
    bio: "Football fan from Montevideo",
    favorite_team: "Nacional",
    points_total: 42,
    updated_at: new Date().toISOString(),
    created_at: daysAgo(30),
  },
  {
    id: MOCK_MEMBER_IDS.alice,
    username: "alice_mvd",
    display_name: "Alice Rodriguez",
    avatar_url: "https://placehold.co/200x200/7C5CFC/white?text=AR",
    bio: null,
    favorite_team: "Penarol",
    points_total: 38,
    updated_at: new Date().toISOString(),
    created_at: daysAgo(28),
  },
  {
    id: MOCK_MEMBER_IDS.bob,
    username: "bob_scores",
    display_name: "Bob Martinez",
    avatar_url: "https://placehold.co/200x200/FFB800/black?text=BM",
    bio: null,
    favorite_team: "Liverpool",
    points_total: 35,
    updated_at: new Date().toISOString(),
    created_at: daysAgo(25),
  },
  {
    id: MOCK_MEMBER_IDS.carol,
    username: "carol_gol",
    display_name: "Carol Fernandez",
    avatar_url: null,
    bio: null,
    favorite_team: null,
    points_total: 29,
    updated_at: new Date().toISOString(),
    created_at: daysAgo(20),
  },
  {
    id: MOCK_MEMBER_IDS.dave,
    username: "dave_futbol",
    display_name: "Dave Suarez",
    avatar_url: "https://placehold.co/200x200/0D0D0D/white?text=DS",
    bio: null,
    favorite_team: "Defensor",
    points_total: 22,
    updated_at: new Date().toISOString(),
    created_at: daysAgo(15),
  },
];

// ── Groups ──────────────────────────────────────────────────────────

export const mockGroups = [
  {
    id: MOCK_GROUP_IDS.owned,
    name: "Los Bolsos",
    description: "Neighborhood prediction league",
    avatar_url: null,
    invite_code: "ABCD1234",
    created_by: MOCK_USER_ID,
    max_members: 50,
    scoring_system: {
      exact_score: 5,
      correct_result: 3,
      correct_goal_diff: 1,
      wrong: 0,
    },
    is_active: true,
    created_at: daysAgo(30),
  },
  {
    id: MOCK_GROUP_IDS.member,
    name: "Oficina FC",
    description: "Office prediction league",
    avatar_url: null,
    invite_code: "WXYZ5678",
    created_by: MOCK_MEMBER_IDS.alice,
    max_members: 30,
    scoring_system: {
      exact_score: 5,
      correct_result: 3,
      correct_goal_diff: 1,
      wrong: 0,
    },
    is_active: true,
    created_at: daysAgo(25),
  },
];

// ── Group Members ───────────────────────────────────────────────────

export const mockGroupMembers = [
  // "Los Bolsos" — user is admin
  {
    user_id: MOCK_USER_ID,
    group_id: MOCK_GROUP_IDS.owned,
    role: "admin",
    is_active: true,
    joined_at: daysAgo(30),
  },
  {
    user_id: MOCK_MEMBER_IDS.alice,
    group_id: MOCK_GROUP_IDS.owned,
    role: "member",
    is_active: true,
    joined_at: daysAgo(28),
  },
  {
    user_id: MOCK_MEMBER_IDS.bob,
    group_id: MOCK_GROUP_IDS.owned,
    role: "member",
    is_active: true,
    joined_at: daysAgo(25),
  },
  {
    user_id: MOCK_MEMBER_IDS.carol,
    group_id: MOCK_GROUP_IDS.owned,
    role: "member",
    is_active: true,
    joined_at: daysAgo(20),
  },
  // "Oficina FC" — user is member
  {
    user_id: MOCK_MEMBER_IDS.alice,
    group_id: MOCK_GROUP_IDS.member,
    role: "admin",
    is_active: true,
    joined_at: daysAgo(25),
  },
  {
    user_id: MOCK_USER_ID,
    group_id: MOCK_GROUP_IDS.member,
    role: "member",
    is_active: true,
    joined_at: daysAgo(22),
  },
  {
    user_id: MOCK_MEMBER_IDS.dave,
    group_id: MOCK_GROUP_IDS.member,
    role: "member",
    is_active: true,
    joined_at: daysAgo(15),
  },
];

// ── Tournaments ─────────────────────────────────────────────────────

export const mockTournaments = [
  {
    id: MOCK_TOURNAMENT_ID,
    name: "Copa Libertadores 2026",
    short_name: "Libertadores",
    logo_url: "https://placehold.co/64x64/00D4AA/white?text=CL",
    country: "South America",
    season: 2026,
    api_league_id: 13,
    status: "active",
    created_at: daysAgo(60),
  },
];

// ── Group Tournaments ───────────────────────────────────────────────

export const mockGroupTournaments = [
  {
    group_id: MOCK_GROUP_IDS.owned,
    tournament_id: MOCK_TOURNAMENT_ID,
    added_at: daysAgo(30),
  },
  {
    group_id: MOCK_GROUP_IDS.member,
    tournament_id: MOCK_TOURNAMENT_ID,
    added_at: daysAgo(25),
  },
];

// ── Matches ─────────────────────────────────────────────────────────

export const mockMatches = [
  // Scheduled (future)
  {
    id: MOCK_MATCH_IDS.scheduled1,
    tournament_id: MOCK_TOURNAMENT_ID,
    home_team_name: "Boca Juniors",
    away_team_name: "River Plate",
    home_team_logo: "https://placehold.co/48x48?text=BOC",
    away_team_logo: "https://placehold.co/48x48?text=RIV",
    home_score: null,
    away_score: null,
    status: "scheduled",
    kickoff_time: daysFromNow(1),
    matchday: 5,
    venue: "La Bombonera",
    api_match_id: 1001,
  },
  {
    id: MOCK_MATCH_IDS.scheduled2,
    tournament_id: MOCK_TOURNAMENT_ID,
    home_team_name: "Nacional",
    away_team_name: "Penarol",
    home_team_logo: "https://placehold.co/48x48?text=NAC",
    away_team_logo: "https://placehold.co/48x48?text=PEN",
    home_score: null,
    away_score: null,
    status: "scheduled",
    kickoff_time: daysFromNow(2),
    matchday: 5,
    venue: "Gran Parque Central",
    api_match_id: 1002,
  },
  {
    id: MOCK_MATCH_IDS.scheduled3,
    tournament_id: MOCK_TOURNAMENT_ID,
    home_team_name: "Flamengo",
    away_team_name: "Palmeiras",
    home_team_logo: "https://placehold.co/48x48?text=FLA",
    away_team_logo: "https://placehold.co/48x48?text=PAL",
    home_score: null,
    away_score: null,
    status: "scheduled",
    kickoff_time: daysFromNow(5),
    matchday: 6,
    venue: "Maracana",
    api_match_id: 1003,
  },
  {
    id: MOCK_MATCH_IDS.scheduled4,
    tournament_id: MOCK_TOURNAMENT_ID,
    home_team_name: "Atletico Mineiro",
    away_team_name: "Gremio",
    home_team_logo: "https://placehold.co/48x48?text=CAM",
    away_team_logo: "https://placehold.co/48x48?text=GRE",
    home_score: null,
    away_score: null,
    status: "scheduled",
    kickoff_time: daysFromNow(7),
    matchday: 6,
    venue: "Mineirao",
    api_match_id: 1004,
  },
  // Live (in-progress)
  {
    id: MOCK_MATCH_IDS.live1,
    tournament_id: MOCK_TOURNAMENT_ID,
    home_team_name: "Santos",
    away_team_name: "Sao Paulo",
    home_team_logo: "https://placehold.co/48x48?text=SAN",
    away_team_logo: "https://placehold.co/48x48?text=SAO",
    home_score: 1,
    away_score: 0,
    status: "live",
    kickoff_time: daysFromNow(0),
    matchday: 5,
    venue: "Vila Belmiro",
    api_match_id: 1005,
  },
  {
    id: MOCK_MATCH_IDS.live2,
    tournament_id: MOCK_TOURNAMENT_ID,
    home_team_name: "Racing Club",
    away_team_name: "Independiente",
    home_team_logo: "https://placehold.co/48x48?text=RAC",
    away_team_logo: "https://placehold.co/48x48?text=IND",
    home_score: 2,
    away_score: 2,
    status: "live",
    kickoff_time: daysFromNow(0),
    matchday: 5,
    venue: "El Cilindro",
    api_match_id: 1006,
  },
  // Finished (past)
  {
    id: MOCK_MATCH_IDS.finished1,
    tournament_id: MOCK_TOURNAMENT_ID,
    home_team_name: "Cerro Porteno",
    away_team_name: "Olimpia",
    home_team_logo: "https://placehold.co/48x48?text=CER",
    away_team_logo: "https://placehold.co/48x48?text=OLI",
    home_score: 3,
    away_score: 1,
    status: "finished",
    kickoff_time: daysAgo(1),
    matchday: 4,
    venue: "La Nueva Olla",
    api_match_id: 1007,
  },
  {
    id: MOCK_MATCH_IDS.finished2,
    tournament_id: MOCK_TOURNAMENT_ID,
    home_team_name: "Universitario",
    away_team_name: "Alianza Lima",
    home_team_logo: "https://placehold.co/48x48?text=UNI",
    away_team_logo: "https://placehold.co/48x48?text=ALI",
    home_score: 0,
    away_score: 0,
    status: "finished",
    kickoff_time: daysAgo(2),
    matchday: 4,
    venue: "Monumental",
    api_match_id: 1008,
  },
  {
    id: MOCK_MATCH_IDS.finished3,
    tournament_id: MOCK_TOURNAMENT_ID,
    home_team_name: "Emelec",
    away_team_name: "Barcelona SC",
    home_team_logo: "https://placehold.co/48x48?text=EME",
    away_team_logo: "https://placehold.co/48x48?text=BSC",
    home_score: 1,
    away_score: 2,
    status: "finished",
    kickoff_time: daysAgo(2),
    matchday: 4,
    venue: "George Capwell",
    api_match_id: 1009,
  },
  // Postponed
  {
    id: MOCK_MATCH_IDS.postponed1,
    tournament_id: MOCK_TOURNAMENT_ID,
    home_team_name: "Colon",
    away_team_name: "Union",
    home_team_logo: "https://placehold.co/48x48?text=COL",
    away_team_logo: "https://placehold.co/48x48?text=UNI",
    home_score: null,
    away_score: null,
    status: "postponed",
    kickoff_time: daysAgo(1),
    matchday: 4,
    venue: "Brigadier Lopez",
    api_match_id: 1010,
  },
];

// ── Predictions ─────────────────────────────────────────────────────

export const mockPredictions = [
  // Predictions on finished matches
  {
    id: MOCK_PREDICTION_IDS.pred1,
    user_id: MOCK_USER_ID,
    match_id: MOCK_MATCH_IDS.finished1,
    group_id: MOCK_GROUP_IDS.owned,
    home_score_pred: 2,
    away_score_pred: 1,
    points_earned: 3,
    created_at: daysAgo(3),
    updated_at: daysAgo(3),
  },
  {
    id: MOCK_PREDICTION_IDS.pred2,
    user_id: MOCK_USER_ID,
    match_id: MOCK_MATCH_IDS.finished2,
    group_id: MOCK_GROUP_IDS.owned,
    home_score_pred: 0,
    away_score_pred: 0,
    points_earned: 5,
    created_at: daysAgo(4),
    updated_at: daysAgo(4),
  },
  // Prediction on a live match (already submitted)
  {
    id: MOCK_PREDICTION_IDS.pred3,
    user_id: MOCK_USER_ID,
    match_id: MOCK_MATCH_IDS.live1,
    group_id: MOCK_GROUP_IDS.owned,
    home_score_pred: 2,
    away_score_pred: 0,
    points_earned: null,
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
  },
  // Prediction on a scheduled match
  {
    id: MOCK_PREDICTION_IDS.pred4,
    user_id: MOCK_USER_ID,
    match_id: MOCK_MATCH_IDS.scheduled1,
    group_id: MOCK_GROUP_IDS.owned,
    home_score_pred: 1,
    away_score_pred: 0,
    points_earned: null,
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
  },
];

// ── Leaderboard Cache ───────────────────────────────────────────────

export const mockLeaderboardCache = [
  {
    id: "lb000001-0000-0000-0000-000000000001",
    group_id: MOCK_GROUP_IDS.owned,
    user_id: MOCK_USER_ID,
    points_total: 42,
    rank: 1,
    predictions_count: 15,
    exact_scores: 3,
    correct_results: 8,
    updated_at: new Date().toISOString(),
  },
  {
    id: "lb000002-0000-0000-0000-000000000002",
    group_id: MOCK_GROUP_IDS.owned,
    user_id: MOCK_MEMBER_IDS.alice,
    points_total: 38,
    rank: 2,
    predictions_count: 14,
    exact_scores: 2,
    correct_results: 9,
    updated_at: new Date().toISOString(),
  },
  {
    id: "lb000003-0000-0000-0000-000000000003",
    group_id: MOCK_GROUP_IDS.owned,
    user_id: MOCK_MEMBER_IDS.bob,
    points_total: 35,
    rank: 3,
    predictions_count: 13,
    exact_scores: 2,
    correct_results: 7,
    updated_at: new Date().toISOString(),
  },
];

// ── Notifications (empty for now) ───────────────────────────────────

export const mockNotifications: Record<string, unknown>[] = [];
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit`
Expected: No new type errors (file is under `src/` which is included by `tsconfig.json`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/mock/fixtures.ts
git commit -m "feat(mock): add fixture seed data for all 9 tables"
```

---

## Task 2: Mock Store — In-Memory Maps

**Files:**

- Create: `src/lib/mock/mock-store.ts`

- [ ] **Step 1: Create the store module**

```ts
// src/lib/mock/mock-store.ts
import {
  mockProfiles,
  mockGroups,
  mockGroupMembers,
  mockGroupTournaments,
  mockTournaments,
  mockMatches,
  mockPredictions,
  mockLeaderboardCache,
  mockNotifications,
} from "./fixtures";

// ── Types ───────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

export type MockStore = {
  profiles: Map<string, Row>;
  groups: Map<string, Row>;
  group_members: Map<string, Row>;
  group_tournaments: Map<string, Row>;
  tournaments: Map<string, Row>;
  matches: Map<string, Row>;
  predictions: Map<string, Row>;
  leaderboard_cache: Map<string, Row>;
  notifications: Map<string, Row>;
};

export type TableName = keyof MockStore;

// ── Composite key helpers ───────────────────────────────────────────

function groupMemberKey(row: Row): string {
  return `${row.user_id}:${row.group_id}`;
}

function groupTournamentKey(row: Row): string {
  return `${row.group_id}:${row.tournament_id}`;
}

function predictionCompositeKey(row: Row): string {
  return `${row.user_id}:${row.match_id}:${row.group_id}`;
}

// Map table names to their key extraction function
const KEY_EXTRACTORS: Partial<Record<TableName, (row: Row) => string>> = {
  group_members: groupMemberKey,
  group_tournaments: groupTournamentKey,
  predictions: (row) => (row.id as string) ?? predictionCompositeKey(row),
};

export function getRowKey(table: TableName, row: Row): string {
  const extractor = KEY_EXTRACTORS[table];
  if (extractor) return extractor(row);
  return row.id as string;
}

// ── Composite key lookup for upsert conflicts ───────────────────────

const CONFLICT_KEY_BUILDERS: Record<string, (row: Row) => string> = {
  "user_id,match_id,group_id": predictionCompositeKey,
  "user_id,group_id": groupMemberKey,
  "group_id,tournament_id": groupTournamentKey,
};

export function findByConflictKey(
  table: Map<string, Row>,
  conflictCols: string,
  row: Row,
): [string, Row] | undefined {
  const builder = CONFLICT_KEY_BUILDERS[conflictCols];
  if (!builder) return undefined;
  const targetKey = builder(row);
  for (const [key, existing] of table) {
    if (builder(existing) === targetKey) return [key, existing];
  }
  return undefined;
}

// ── Store factory ───────────────────────────────────────────────────

function arrayToMap(table: TableName, rows: Row[]): Map<string, Row> {
  const map = new Map<string, Row>();
  for (const row of rows) {
    map.set(getRowKey(table, row), { ...row });
  }
  return map;
}

export function createMockStore(): MockStore {
  return {
    profiles: arrayToMap("profiles", mockProfiles),
    groups: arrayToMap("groups", mockGroups),
    group_members: arrayToMap("group_members", mockGroupMembers),
    group_tournaments: arrayToMap("group_tournaments", mockGroupTournaments),
    tournaments: arrayToMap("tournaments", mockTournaments),
    matches: arrayToMap("matches", mockMatches),
    predictions: arrayToMap("predictions", mockPredictions),
    leaderboard_cache: arrayToMap("leaderboard_cache", mockLeaderboardCache),
    notifications: arrayToMap("notifications", mockNotifications),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/mock/mock-store.ts
git commit -m "feat(mock): add in-memory store with composite key support"
```

---

## Task 3: Mock Query Builder

**Files:**

- Create: `src/lib/mock/mock-query-builder.ts`
- Create: `src/__tests__/lib/mock/mock-query-builder.test.ts`

This is the core of the mock system. It implements the Supabase PostgREST chaining API.

- [ ] **Step 1: Write tests for the query builder**

```ts
// src/__tests__/lib/mock/mock-query-builder.test.ts
import { MockQueryBuilder } from "@lib/mock/mock-query-builder";
import { createMockStore, type MockStore } from "@lib/mock/mock-store";
import {
  MOCK_USER_ID,
  MOCK_GROUP_IDS,
  MOCK_MATCH_IDS,
} from "@lib/mock/fixtures";

let store: MockStore;

beforeEach(() => {
  store = createMockStore();
});

function query(table: keyof MockStore) {
  return new MockQueryBuilder(store, table);
}

describe("MockQueryBuilder", () => {
  describe("select + filters", () => {
    it("selects all rows from a table", async () => {
      const { data, error } = await query("profiles").select("*");
      expect(error).toBeNull();
      expect(data).toHaveLength(5);
    });

    it("filters with .eq()", async () => {
      const { data } = await query("profiles")
        .select("id, username")
        .eq("id", MOCK_USER_ID);
      expect(data).toHaveLength(1);
      expect(data![0].username).toBe("hernan_uy");
    });

    it("filters with .neq()", async () => {
      const { data } = await query("profiles")
        .select("id")
        .neq("id", MOCK_USER_ID);
      expect(data).toHaveLength(4);
    });

    it("filters with .in()", async () => {
      const ids = [MOCK_MATCH_IDS.scheduled1, MOCK_MATCH_IDS.live1];
      const { data } = await query("matches").select("id").in("id", ids);
      expect(data).toHaveLength(2);
    });

    it("filters with .not()", async () => {
      const { data } = await query("matches")
        .select("id")
        .not("status", "eq", "cancelled");
      // All 10 mock matches are non-cancelled
      expect(data!.length).toBeGreaterThan(0);
      expect(
        data!.every((m: Record<string, unknown>) => m.status !== "cancelled"),
      ).toBe(true);
    });

    it("filters with .gte() and .lte()", async () => {
      const now = new Date().toISOString();
      const { data } = await query("matches")
        .select("id")
        .gte("kickoff_time", now);
      // Should include scheduled and some live matches
      expect(data!.length).toBeGreaterThan(0);
    });

    it("limits results with .limit()", async () => {
      const { data } = await query("profiles").select("id").limit(2);
      expect(data).toHaveLength(2);
    });

    it("orders results with .order()", async () => {
      const { data } = await query("profiles")
        .select("username")
        .order("username", { ascending: true });
      const usernames = data!.map((r: Record<string, unknown>) => r.username);
      expect(usernames).toEqual([...usernames].sort());
    });

    it("unwraps single row with .single()", async () => {
      const { data, error } = await query("profiles")
        .select("username")
        .eq("id", MOCK_USER_ID)
        .single();
      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data!.username).toBe("hernan_uy");
    });

    it("returns null for .maybeSingle() with no match", async () => {
      const { data, error } = await query("predictions")
        .select("id")
        .eq("user_id", "nonexistent")
        .maybeSingle();
      expect(error).toBeNull();
      expect(data).toBeNull();
    });
  });

  describe("embedded joins", () => {
    it("resolves a named join (tournament:tournaments!tournament_id)", async () => {
      const { data } = await query("matches")
        .select("id, tournament:tournaments!tournament_id ( name, short_name )")
        .eq("id", MOCK_MATCH_IDS.scheduled1)
        .single();
      expect(data!.tournament).toBeDefined();
      expect((data!.tournament as Record<string, unknown>).name).toBe(
        "Copa Libertadores 2026",
      );
    });

    it("resolves embedded count aggregate (group_members(count))", async () => {
      const { data } = await query("groups")
        .select("id, name, group_members ( count )")
        .eq("id", MOCK_GROUP_IDS.owned)
        .single();
      // "Los Bolsos" has 4 members
      const members = data!.group_members as { count: number }[];
      expect(members[0].count).toBe(4);
    });
  });

  describe("mutations", () => {
    it("inserts rows", async () => {
      const before = store.group_tournaments.size;
      await query("group_tournaments").insert([
        { group_id: MOCK_GROUP_IDS.owned, tournament_id: "new-tid" },
      ]);
      expect(store.group_tournaments.size).toBe(before + 1);
    });

    it("upserts with onConflict (insert new)", async () => {
      const before = store.predictions.size;
      await query("predictions")
        .upsert(
          {
            id: "new-pred-id",
            user_id: MOCK_USER_ID,
            match_id: MOCK_MATCH_IDS.scheduled2,
            group_id: MOCK_GROUP_IDS.owned,
            home_score_pred: 1,
            away_score_pred: 1,
          },
          { onConflict: "user_id,match_id,group_id" },
        )
        .select("id")
        .single();
      expect(store.predictions.size).toBe(before + 1);
    });

    it("upserts with onConflict (update existing)", async () => {
      const before = store.predictions.size;
      await query("predictions")
        .upsert(
          {
            id: "updated-id",
            user_id: MOCK_USER_ID,
            match_id: MOCK_MATCH_IDS.finished1,
            group_id: MOCK_GROUP_IDS.owned,
            home_score_pred: 9,
            away_score_pred: 9,
          },
          { onConflict: "user_id,match_id,group_id" },
        )
        .select("id")
        .single();
      // Should NOT create a new row
      expect(store.predictions.size).toBe(before);
    });

    it("updates rows with filters", async () => {
      await query("profiles")
        .update({ bio: "Updated bio" })
        .eq("id", MOCK_USER_ID);
      const row = store.profiles.get(MOCK_USER_ID)!;
      expect(row.bio).toBe("Updated bio");
    });

    it("deletes rows with filters", async () => {
      const before = store.group_tournaments.size;
      await query("group_tournaments")
        .delete()
        .eq("group_id", MOCK_GROUP_IDS.owned)
        .in("tournament_id", [MOCK_TOURNAMENT_ID]);
      expect(store.group_tournaments.size).toBe(before - 1);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/lib/mock/mock-query-builder.test.ts --no-coverage 2>&1 | tail -5`
Expected: FAIL — `MockQueryBuilder` module not found

- [ ] **Step 3: Implement the query builder**

```ts
// src/lib/mock/mock-query-builder.ts
import {
  type MockStore,
  type TableName,
  getRowKey,
  findByConflictKey,
} from "./mock-store";

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;
type Result<T = Row[]> =
  | { data: T; error: null }
  | { data: null; error: { message: string } };

// ── Join parsing ────────────────────────────────────────────────────
// Handles nested joins like: group:groups!inner ( id, name, group_members ( count ) )
// and FK hints like: profiles!user_id, groups!inner

type JoinSpec = {
  alias: string;
  table: TableName;
  fk: string;
  columns: string[];
  isCount: boolean;
  children: JoinSpec[]; // nested joins inside this join
};

const JOIN_TYPE_HINTS = new Set(["inner", "left"]);

function inferFk(table: string, fkHint: string | undefined): string {
  // If no hint or hint is a join type keyword (inner/left), infer from table name
  if (!fkHint || JOIN_TYPE_HINTS.has(fkHint)) {
    return `${table.replace(/s$/, "")}_id`;
  }
  return fkHint;
}

function findMatchingParen(str: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < str.length; i++) {
    if (str[i] === "(") depth++;
    if (str[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseSelectLevel(selectStr: string): {
  columns: string[];
  joins: JoinSpec[];
} {
  const joins: JoinSpec[] = [];
  const columns: string[] = [];
  let remaining = selectStr;

  // Repeatedly find the next join pattern: [alias:]table[!fk] ( ... )
  while (true) {
    const match = remaining.match(/(?:(\w+):)?(\w+)(?:!(\w+))?\s*\(/);
    if (!match || match.index === undefined) break;

    // Extract plain columns before this join
    const before = remaining.substring(0, match.index);
    for (const col of before.split(",")) {
      const c = col.trim();
      if (c) columns.push(c);
    }

    const alias = match[1] || match[2];
    const table = match[2];
    const fkHint = match[3];
    const openParenIdx = match.index + match[0].length - 1;
    const closeParenIdx = findMatchingParen(remaining, openParenIdx);
    if (closeParenIdx === -1) break;

    const innerContent = remaining
      .substring(openParenIdx + 1, closeParenIdx)
      .trim();
    const fk = inferFk(table, fkHint);
    const isCount = innerContent === "count";

    // Recursively parse inner content for nested joins
    const inner = isCount
      ? { columns: [], joins: [] }
      : parseSelectLevel(innerContent);

    joins.push({
      alias,
      table: table as TableName,
      fk,
      columns: isCount ? [] : inner.columns,
      isCount,
      children: inner.joins,
    });

    remaining = remaining.substring(closeParenIdx + 1);
  }

  // Any remaining text after the last join
  for (const col of remaining.split(",")) {
    const c = col.trim();
    if (c) columns.push(c);
  }

  return { columns, joins };
}

// ── Query Builder ───────────────────────────────────────────────────

export class MockQueryBuilder {
  private store: MockStore;
  private table: TableName;
  private filters: Filter[] = [];
  private selectStr = "*";
  private limitCount: number | null = null;
  private orderCol: string | null = null;
  private orderAsc = true;
  private mode: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private mutationData: Row | Row[] | null = null;
  private upsertConflict: string | null = null;
  private isSingle = false;
  private isMaybeSingle = false;
  private postMutationSelect: string | null = null;

  constructor(store: MockStore, table: TableName) {
    this.store = store;
    this.table = table;
  }

  // ── Select ──────────────────────────────────────────────────────

  select(columns?: string): this {
    if (this.mode !== "select" && columns) {
      // Post-mutation select
      this.postMutationSelect = columns;
      return this;
    }
    this.selectStr = columns || "*";
    return this;
  }

  // ── Filters ─────────────────────────────────────────────────────

  eq(col: string, val: unknown): this {
    this.filters.push((row) => row[col] === val);
    return this;
  }

  neq(col: string, val: unknown): this {
    this.filters.push((row) => row[col] !== val);
    return this;
  }

  in(col: string, vals: unknown[]): this {
    this.filters.push((row) => vals.includes(row[col]));
    return this;
  }

  not(col: string, op: string, val: unknown): this {
    this.filters.push((row) => {
      switch (op) {
        case "eq":
          return row[col] !== val;
        case "neq":
          return row[col] === val;
        case "gt":
          return (row[col] as number) <= (val as number);
        case "lt":
          return (row[col] as number) >= (val as number);
        default:
          return true;
      }
    });
    return this;
  }

  gt(col: string, val: unknown): this {
    this.filters.push((row) => (row[col] as string) > (val as string));
    return this;
  }

  gte(col: string, val: unknown): this {
    this.filters.push((row) => (row[col] as string) >= (val as string));
    return this;
  }

  lt(col: string, val: unknown): this {
    this.filters.push((row) => (row[col] as string) < (val as string));
    return this;
  }

  lte(col: string, val: unknown): this {
    this.filters.push((row) => (row[col] as string) <= (val as string));
    return this;
  }

  // ── Modifiers ───────────────────────────────────────────────────

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }): this {
    this.orderCol = col;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }

  single(): this {
    this.isSingle = true;
    return this;
  }

  maybeSingle(): this {
    this.isMaybeSingle = true;
    return this;
  }

  // ── Mutations ───────────────────────────────────────────────────

  insert(data: Row | Row[]): this {
    this.mode = "insert";
    this.mutationData = data;
    return this;
  }

  upsert(data: Row, opts?: { onConflict?: string }): this {
    this.mode = "upsert";
    this.mutationData = data;
    this.upsertConflict = opts?.onConflict ?? null;
    return this;
  }

  update(data: Row): this {
    this.mode = "update";
    this.mutationData = data;
    return this;
  }

  delete(): this {
    this.mode = "delete";
    return this;
  }

  // ── Execution (thenable) ────────────────────────────────────────

  private getRows(): Row[] {
    return Array.from(this.store[this.table].values());
  }

  private applyFilters(rows: Row[]): Row[] {
    return rows.filter((row) => this.filters.every((f) => f(row)));
  }

  private applyOrder(rows: Row[]): Row[] {
    if (!this.orderCol) return rows;
    const col = this.orderCol;
    const dir = this.orderAsc ? 1 : -1;
    return [...rows].sort((a, b) => {
      const aVal = a[col];
      const bVal = b[col];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return dir;
      if (bVal == null) return -dir;
      if (typeof aVal === "string" && typeof bVal === "string")
        return aVal.localeCompare(bVal) * dir;
      return ((aVal as number) - (bVal as number)) * dir;
    });
  }

  private resolveJoin(
    join: JoinSpec,
    parentRow: Row,
    parentTable: TableName,
  ): unknown {
    if (join.isCount) {
      // Count aggregate: count rows in the join table matching the parent row's id
      const joinTable = this.store[join.table];
      if (!joinTable) return [{ count: 0 }];
      const fkCol = `${parentTable.replace(/s$/, "")}_id`;
      const parentId = parentRow.id;
      let count = 0;
      for (const jRow of joinTable.values()) {
        if (jRow[fkCol] === parentId) count++;
      }
      return [{ count }];
    }

    // Data join: find the related row via FK
    const joinTable = this.store[join.table];
    if (!joinTable) return null;
    const fkVal = parentRow[join.fk];
    let found: Row | null = null;
    for (const jRow of joinTable.values()) {
      if (jRow.id === fkVal) {
        found = jRow;
        break;
      }
    }
    if (!found) return null;

    // Project columns from the joined row
    const joinProjected: Row = {};
    for (const col of join.columns) {
      joinProjected[col] = found[col];
    }

    // Recursively resolve nested joins (e.g., group_members(count) inside groups)
    for (const child of join.children) {
      joinProjected[child.alias] = this.resolveJoin(child, found, join.table);
    }

    return joinProjected;
  }

  private projectColumns(rows: Row[]): Row[] {
    const sel = this.postMutationSelect || this.selectStr;
    if (sel === "*") return rows;

    const { columns, joins } = parseSelectLevel(sel);

    return rows.map((row) => {
      const projected: Row = {};

      // Plain columns
      if (columns.length === 0 && joins.length > 0) {
        Object.assign(projected, row);
      } else {
        for (const col of columns) {
          if (col === "*") {
            Object.assign(projected, row);
          } else {
            projected[col] = row[col];
          }
        }
      }

      // Resolve joins (with recursive nesting support)
      for (const join of joins) {
        projected[join.alias] = this.resolveJoin(join, row, this.table);
      }

      return projected;
    });
  }

  private executeSelect(): Result<Row[] | Row | null> {
    let rows = this.getRows();
    rows = this.applyFilters(rows);
    rows = this.applyOrder(rows);
    if (this.limitCount !== null) rows = rows.slice(0, this.limitCount);
    rows = this.projectColumns(rows);

    if (this.isSingle) {
      if (rows.length === 0)
        return { data: null, error: { message: "Row not found" } };
      return { data: rows[0], error: null };
    }
    if (this.isMaybeSingle) {
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  }

  private executeInsert(): Result {
    const tableMap = this.store[this.table];
    const rows = Array.isArray(this.mutationData)
      ? this.mutationData
      : [this.mutationData!];
    for (const row of rows) {
      tableMap.set(getRowKey(this.table, row), { ...row });
    }
    return { data: rows, error: null };
  }

  private executeUpsert(): Result<Row[] | Row | null> {
    const tableMap = this.store[this.table];
    const row = this.mutationData as Row;

    if (this.upsertConflict) {
      const existing = findByConflictKey(tableMap, this.upsertConflict, row);
      if (existing) {
        const [key, existingRow] = existing;
        const merged = { ...existingRow, ...row };
        tableMap.set(key, merged);
        const result = [merged];
        if (this.isSingle) return { data: result[0], error: null };
        return { data: result, error: null };
      }
    }

    // Insert new
    const key = getRowKey(this.table, row);
    tableMap.set(key, { ...row });
    const result = [row];
    if (this.isSingle) return { data: result[0], error: null };
    return { data: result, error: null };
  }

  private executeUpdate(): Result {
    const tableMap = this.store[this.table];
    const patch = this.mutationData as Row;
    const rows = this.applyFilters(Array.from(tableMap.values()));
    for (const row of rows) {
      const key = getRowKey(this.table, row);
      tableMap.set(key, { ...row, ...patch });
    }
    return { data: rows, error: null };
  }

  private executeDelete(): Result {
    const tableMap = this.store[this.table];
    const rows = this.applyFilters(Array.from(tableMap.values()));
    for (const row of rows) {
      const key = getRowKey(this.table, row);
      tableMap.delete(key);
    }
    return { data: rows, error: null };
  }

  // ── Then (makes the builder thenable / awaitable) ───────────────

  then<TResult1 = Result<Row[] | Row | null>>(
    resolve?: (value: Result<Row[] | Row | null>) => TResult1,
  ): Promise<TResult1> {
    let result: Result<Row[] | Row | null>;
    switch (this.mode) {
      case "insert":
        result = this.executeInsert();
        break;
      case "upsert":
        result = this.executeUpsert();
        break;
      case "update":
        result = this.executeUpdate();
        break;
      case "delete":
        result = this.executeDelete();
        break;
      default:
        result = this.executeSelect();
    }
    return Promise.resolve(
      resolve ? resolve(result) : (result as unknown as TResult1),
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/lib/mock/mock-query-builder.test.ts --no-coverage`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/mock/mock-query-builder.ts src/__tests__/lib/mock/mock-query-builder.test.ts
git commit -m "feat(mock): add query builder with chaining API, joins, and mutations"
```

---

## Task 4: Mock Auth

**Files:**

- Create: `src/lib/mock/mock-auth.ts`
- Create: `src/__tests__/lib/mock/mock-auth.test.ts`

- [ ] **Step 1: Write tests for mock auth**

```ts
// src/__tests__/lib/mock/mock-auth.test.ts
import { createMockAuth } from "@lib/mock/mock-auth";
import { MOCK_USER_ID } from "@lib/mock/fixtures";

describe("MockAuth", () => {
  it("fires onAuthStateChange with INITIAL_SESSION on subscribe", () => {
    const auth = createMockAuth();
    const callback = jest.fn();
    auth.onAuthStateChange(callback);
    expect(callback).toHaveBeenCalledWith(
      "INITIAL_SESSION",
      expect.objectContaining({
        user: expect.objectContaining({ id: MOCK_USER_ID }),
      }),
    );
  });

  it("signInWithIdToken sets session and fires SIGNED_IN", async () => {
    const auth = createMockAuth();
    const callback = jest.fn();
    auth.onAuthStateChange(callback);
    callback.mockClear();

    const result = await auth.signInWithIdToken({
      provider: "google",
      token: "fake",
    });
    expect(result.error).toBeNull();
    expect(result.data.session).toBeDefined();
    expect(callback).toHaveBeenCalledWith("SIGNED_IN", expect.anything());
  });

  it("signOut clears session and fires SIGNED_OUT", async () => {
    const auth = createMockAuth();
    const callback = jest.fn();
    auth.onAuthStateChange(callback);

    await auth.signOut();
    expect(callback).toHaveBeenCalledWith("SIGNED_OUT", null);
  });

  it("getUser returns the mock user", async () => {
    const auth = createMockAuth();
    const { data } = await auth.getUser();
    expect(data.user?.id).toBe(MOCK_USER_ID);
  });

  it("getSession returns the current session", async () => {
    const auth = createMockAuth();
    const { data } = await auth.getSession();
    expect(data.session).toBeDefined();
    expect(data.session?.user.id).toBe(MOCK_USER_ID);
  });

  it("startAutoRefresh and stopAutoRefresh are no-ops", () => {
    const auth = createMockAuth();
    expect(() => auth.startAutoRefresh()).not.toThrow();
    expect(() => auth.stopAutoRefresh()).not.toThrow();
  });

  it("unsubscribe removes the callback", async () => {
    const auth = createMockAuth();
    const callback = jest.fn();
    const {
      data: { subscription },
    } = auth.onAuthStateChange(callback);
    callback.mockClear();

    subscription.unsubscribe();
    await auth.signOut();
    expect(callback).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/lib/mock/mock-auth.test.ts --no-coverage 2>&1 | tail -5`
Expected: FAIL

- [ ] **Step 3: Implement mock auth**

```ts
// src/lib/mock/mock-auth.ts
import { MOCK_USER_ID, mockProfiles } from "./fixtures";

type AuthChangeEvent = "INITIAL_SESSION" | "SIGNED_IN" | "SIGNED_OUT";

// Minimal Session/User shapes matching what auth-store.ts consumes
type MockUser = {
  id: string;
  email: string;
  user_metadata: { full_name: string; avatar_url: string };
  app_metadata: Record<string, unknown>;
  aud: string;
  created_at: string;
};

type MockSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: MockUser;
};

type AuthCallback = (
  event: AuthChangeEvent,
  session: MockSession | null,
) => void;

function createMockUser(): MockUser {
  const profile = mockProfiles[0]; // The main mock user
  return {
    id: MOCK_USER_ID,
    email: "hernan@example.com",
    user_metadata: {
      full_name: profile.display_name,
      avatar_url: profile.avatar_url ?? "",
    },
    app_metadata: {},
    aud: "authenticated",
    created_at: profile.created_at,
  };
}

function createMockSession(): MockSession {
  return {
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user: createMockUser(),
  };
}

export function createMockAuth() {
  const callbacks = new Set<AuthCallback>();
  let currentSession: MockSession | null = createMockSession();

  function notify(event: AuthChangeEvent, session: MockSession | null) {
    for (const cb of callbacks) {
      cb(event, session);
    }
  }

  return {
    onAuthStateChange(callback: AuthCallback) {
      callbacks.add(callback);
      // Fire initial session synchronously (sufficient for mock)
      callback("INITIAL_SESSION", currentSession);
      return {
        data: {
          subscription: {
            unsubscribe: () => callbacks.delete(callback),
          },
        },
      };
    },

    async signInWithIdToken(_opts: { provider: string; token: string }) {
      currentSession = createMockSession();
      notify("SIGNED_IN", currentSession);
      return {
        data: { session: currentSession, user: currentSession.user },
        error: null,
      };
    },

    async signOut() {
      currentSession = null;
      notify("SIGNED_OUT", null);
      return { error: null };
    },

    async getUser() {
      return {
        data: { user: currentSession ? createMockUser() : null },
        error: null,
      };
    },

    async getSession() {
      return {
        data: { session: currentSession },
        error: null,
      };
    },

    startAutoRefresh() {},
    stopAutoRefresh() {},
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/lib/mock/mock-auth.test.ts --no-coverage`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/mock/mock-auth.ts src/__tests__/lib/mock/mock-auth.test.ts
git commit -m "feat(mock): add mock auth with session management and callbacks"
```

---

## Task 5: Mock Storage

**Files:**

- Create: `src/lib/mock/mock-storage.ts`

Simple module — no dedicated tests needed (covered by integration tests).

- [ ] **Step 1: Create mock storage**

```ts
// src/lib/mock/mock-storage.ts

const PLACEHOLDER_URL = "https://placehold.co/200x200/00D4AA/white?text=AV";

export function createMockStorage() {
  return {
    from(_bucket: string) {
      return {
        upload(path: string, _file: unknown, _opts?: Record<string, unknown>) {
          return Promise.resolve({ data: { path }, error: null });
        },
        getPublicUrl(path: string) {
          return {
            data: {
              publicUrl: `${PLACEHOLDER_URL}&path=${encodeURIComponent(path)}`,
            },
          };
        },
      };
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/mock/mock-storage.ts
git commit -m "feat(mock): add mock storage with placeholder URLs"
```

---

## Task 6: Mock Client — Assembly

**Files:**

- Create: `src/lib/mock/mock-client.ts`
- Create: `src/lib/mock/index.ts`

Assembles all pieces into a single mock client matching the `SupabaseClient` interface.

- [ ] **Step 1: Create mock client**

```ts
// src/lib/mock/mock-client.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMockStore, type TableName } from "./mock-store";
import { MockQueryBuilder } from "./mock-query-builder";
import { createMockAuth } from "./mock-auth";
import { createMockStorage } from "./mock-storage";
import {
  MOCK_USER_ID,
  MOCK_GROUP_IDS,
  MOCK_MEMBER_IDS,
  mockGroups,
  mockGroupMembers,
} from "./fixtures";

// ── RPC handlers ────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function createRpcHandlers(store: ReturnType<typeof createMockStore>) {
  return {
    create_group_for_user(params: Row): { data: Row[]; error: null } {
      const id = `g${Date.now()}-0000-4000-8000-${Math.random().toString(16).slice(2, 14)}`;
      const inviteCode = Math.random()
        .toString(36)
        .substring(2, 10)
        .toUpperCase();
      const group: Row = {
        id,
        name: params.p_name,
        description: params.p_description ?? null,
        avatar_url: null,
        invite_code: inviteCode,
        created_by: MOCK_USER_ID,
        max_members: 50,
        scoring_system: params.p_scoring_system,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      store.groups.set(id, group);

      // Add creator as admin member
      const memberKey = `${MOCK_USER_ID}:${id}`;
      store.group_members.set(memberKey, {
        user_id: MOCK_USER_ID,
        group_id: id,
        role: "admin",
        is_active: true,
        joined_at: new Date().toISOString(),
      });

      // Link tournaments if provided
      const tids = params.p_tournament_ids as string[] | null;
      if (tids) {
        for (const tid of tids) {
          store.group_tournaments.set(`${id}:${tid}`, {
            group_id: id,
            tournament_id: tid,
            added_at: new Date().toISOString(),
          });
        }
      }

      return {
        data: [{ id, name: group.name, invite_code: inviteCode }],
        error: null,
      };
    },

    lookup_group_by_invite_code(params: Row): { data: Row[]; error: null } {
      const code = params.p_invite_code as string;
      for (const group of store.groups.values()) {
        if (group.invite_code === code) {
          // Count members
          let memberCount = 0;
          for (const m of store.group_members.values()) {
            if (m.group_id === group.id && m.is_active) memberCount++;
          }
          return {
            data: [
              {
                id: group.id,
                name: group.name,
                description: group.description,
                avatar_url: group.avatar_url,
                member_count: memberCount,
                max_members: group.max_members,
                scoring_system: group.scoring_system,
              },
            ],
            error: null,
          };
        }
      }
      return { data: [], error: null };
    },

    join_group_by_code(params: Row): { data: Row[]; error: null } {
      const code = params.p_invite_code as string;
      for (const group of store.groups.values()) {
        if (group.invite_code === code) {
          const memberKey = `${MOCK_USER_ID}:${group.id}`;
          if (!store.group_members.has(memberKey)) {
            store.group_members.set(memberKey, {
              user_id: MOCK_USER_ID,
              group_id: group.id,
              role: "member",
              is_active: true,
              joined_at: new Date().toISOString(),
            });
          }
          return {
            data: [
              {
                id: group.id,
                name: group.name,
                invite_code: group.invite_code,
              },
            ],
            error: null,
          };
        }
      }
      return { data: [], error: null };
    },
  };
}

// ── Client factory ──────────────────────────────────────────────────

export function createMockClient(): SupabaseClient {
  const store = createMockStore();
  const auth = createMockAuth();
  const storage = createMockStorage();
  const rpcHandlers = createRpcHandlers(store);

  const client = {
    from(table: string) {
      return new MockQueryBuilder(store, table as TableName);
    },

    rpc(fnName: string, params?: Row) {
      const handler = rpcHandlers[fnName as keyof typeof rpcHandlers];
      if (!handler) {
        return Promise.resolve({
          data: null,
          error: { message: `Unknown RPC: ${fnName}` },
        });
      }
      return Promise.resolve(handler(params ?? {}));
    },

    auth,
    storage,
  };

  return client as unknown as SupabaseClient;
}
```

- [ ] **Step 2: Create index re-export**

```ts
// src/lib/mock/index.ts
export { createMockClient } from "./mock-client";
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/mock/mock-client.ts src/lib/mock/index.ts
git commit -m "feat(mock): assemble mock client with RPC handlers, auth, and storage"
```

---

## Task 7: Wire Up — supabase.ts + google-auth.ts

**Files:**

- Modify: `src/lib/supabase.ts`
- Modify: `src/lib/google-auth.ts`
- Modify: `.env.example`

- [ ] **Step 1: Modify supabase.ts for conditional export**

Replace the entire content of `src/lib/supabase.ts`:

```ts
// src/lib/supabase.ts
import type { SupabaseClient } from "@supabase/supabase-js";

const IS_MOCK = process.env.EXPO_PUBLIC_USE_MOCKS === "true";

let supabase: SupabaseClient;

if (IS_MOCK) {
  // Lazy import to avoid bundling mock code in production
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createMockClient } = require("@lib/mock");
  supabase = createMockClient();
} else {
  // Real Supabase client
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@supabase/supabase-js");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { secureStoreAdapter } = require("@lib/secure-store-adapter");
  const { AppState } = require("react-native");

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing Supabase environment variables. " +
        "Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in your .env file.",
    );
  }

  supabase = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      storage: secureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  AppState.addEventListener("change", (state: string) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

export { supabase };
```

- [ ] **Step 2: Add mock path to google-auth.ts**

Add the mock check at the top of each exported function in `src/lib/google-auth.ts`:

At the top of the file, after imports, add:

```ts
const IS_MOCK = process.env.EXPO_PUBLIC_USE_MOCKS === "true";
```

Modify `configureGoogleSignIn`:

```ts
export function configureGoogleSignIn(): void {
  if (IS_MOCK) return;
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
}
```

Modify `signInWithGoogle` — add early return at the start:

```ts
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  if (IS_MOCK) {
    return { success: true, data: { idToken: "mock-google-id-token" } };
  }
  // ... rest of existing implementation unchanged
}
```

Modify `signOutFromGoogle` — add early return at the start:

```ts
export async function signOutFromGoogle(): Promise<void> {
  if (IS_MOCK) return;
  // ... rest of existing implementation unchanged
}
```

- [ ] **Step 3: Add EXPO_PUBLIC_USE_MOCKS to .env.example**

Append to `.env.example`:

```
# Set to 'true' to use mock Supabase client (no network required)
# EXPO_PUBLIC_USE_MOCKS=true
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No new errors (existing warnings are OK)

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: No new errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase.ts src/lib/google-auth.ts .env.example
git commit -m "feat(mock): wire conditional mock client in supabase.ts and google-auth.ts"
```

---

## Task 8: Integration Tests — Services Work With Mock

**Files:**

- Create: `src/__tests__/lib/mock/mock-integration.test.ts`

Verifies that the actual service functions work correctly when backed by the mock client.

- [ ] **Step 1: Write integration tests**

```ts
// src/__tests__/lib/mock/mock-integration.test.ts

// Set mock mode BEFORE any imports
process.env.EXPO_PUBLIC_USE_MOCKS = "true";

import {
  fetchUserGroups,
  fetchGroupById,
  fetchGroupMembers,
  fetchGroupTournaments,
  fetchActiveTournaments,
  lookupGroupByInviteCode,
  joinGroupByCode,
  updateGroupTournaments,
} from "@lib/groups-service";
import { fetchGroupMatches } from "@lib/matches-service";
import { fetchMatchDetail, savePrediction } from "@lib/prediction-service";
import {
  checkUsernameAvailable,
  checkProfileComplete,
  updateProfile,
} from "@lib/profile-service";
import {
  MOCK_USER_ID,
  MOCK_GROUP_IDS,
  MOCK_MATCH_IDS,
  MOCK_TOURNAMENT_ID,
} from "@lib/mock/fixtures";

describe("Mock integration: groups-service", () => {
  it("fetchUserGroups returns user groups", async () => {
    const groups = await fetchUserGroups(MOCK_USER_ID);
    expect(groups.length).toBeGreaterThanOrEqual(2);
    expect(groups[0]).toHaveProperty("id");
    expect(groups[0]).toHaveProperty("name");
    expect(groups[0]).toHaveProperty("role");
    expect(groups[0]).toHaveProperty("member_count");
  });

  it("fetchGroupById returns a specific group", async () => {
    const group = await fetchGroupById(MOCK_GROUP_IDS.owned);
    expect(group.id).toBe(MOCK_GROUP_IDS.owned);
    expect(group.name).toBe("Los Bolsos");
    expect(group.role).toBe("admin");
  });

  it("fetchGroupMembers returns members with profiles", async () => {
    const members = await fetchGroupMembers(MOCK_GROUP_IDS.owned);
    expect(members.length).toBeGreaterThanOrEqual(3);
    expect(members[0]).toHaveProperty("username");
    expect(members[0]).toHaveProperty("display_name");
  });

  it("fetchGroupTournaments returns linked tournaments", async () => {
    const tournaments = await fetchGroupTournaments(MOCK_GROUP_IDS.owned);
    expect(tournaments.length).toBeGreaterThanOrEqual(1);
    expect(tournaments[0]).toHaveProperty("name");
  });

  it("fetchActiveTournaments returns active tournaments", async () => {
    const tournaments = await fetchActiveTournaments();
    expect(tournaments.length).toBeGreaterThanOrEqual(1);
    expect(tournaments[0].name).toBe("Copa Libertadores 2026");
  });

  it("lookupGroupByInviteCode finds a group", async () => {
    const preview = await lookupGroupByInviteCode("ABCD1234");
    expect(preview.id).toBe(MOCK_GROUP_IDS.owned);
    expect(preview.name).toBe("Los Bolsos");
  });

  it("joinGroupByCode adds user to group", async () => {
    const result = await joinGroupByCode("WXYZ5678");
    expect(result.id).toBe(MOCK_GROUP_IDS.member);
    expect(result.name).toBe("Oficina FC");
  });

  it("updateGroupTournaments removes and adds tournaments", async () => {
    const before = await fetchGroupTournaments(MOCK_GROUP_IDS.owned);
    const beforeIds = before.map((t) => t.id);
    expect(beforeIds).toContain(MOCK_TOURNAMENT_ID);

    // Remove the existing tournament (pass empty array)
    await updateGroupTournaments(MOCK_GROUP_IDS.owned, []);
    const after = await fetchGroupTournaments(MOCK_GROUP_IDS.owned);
    expect(after).toHaveLength(0);
  });
});

describe("Mock integration: matches-service", () => {
  it("fetchGroupMatches returns matches with prediction status", async () => {
    const matches = await fetchGroupMatches(MOCK_GROUP_IDS.owned, MOCK_USER_ID);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]).toHaveProperty("tournament_name");
    expect(matches[0]).toHaveProperty("prediction_status");
  });
});

describe("Mock integration: prediction-service", () => {
  it("fetchMatchDetail returns match and prediction", async () => {
    const { match, prediction } = await fetchMatchDetail(
      MOCK_MATCH_IDS.finished1,
      MOCK_GROUP_IDS.owned,
      MOCK_USER_ID,
    );
    expect(match.id).toBe(MOCK_MATCH_IDS.finished1);
    expect(match.tournament_name).toBe("Copa Libertadores 2026");
    expect(prediction).not.toBeNull();
  });

  it("fetchMatchDetail returns null prediction for unpredicted match", async () => {
    const { prediction } = await fetchMatchDetail(
      MOCK_MATCH_IDS.scheduled3,
      MOCK_GROUP_IDS.owned,
      MOCK_USER_ID,
    );
    expect(prediction).toBeNull();
  });
});

describe("Mock integration: profile-service", () => {
  it("checkUsernameAvailable returns true for unused username", async () => {
    const available = await checkUsernameAvailable(
      "totally_unique_999",
      MOCK_USER_ID,
    );
    expect(available).toBe(true);
  });

  it("checkUsernameAvailable returns false for taken username", async () => {
    const available = await checkUsernameAvailable("alice_mvd", MOCK_USER_ID);
    expect(available).toBe(false);
  });

  it("checkProfileComplete returns true for customized profile", async () => {
    const complete = await checkProfileComplete(MOCK_USER_ID);
    expect(complete).toBe(true);
  });
});
```

- [ ] **Step 2: Run integration tests**

Run: `npx jest src/__tests__/lib/mock/mock-integration.test.ts --no-coverage`
Expected: All PASS

If any test fails, fix the mock implementation (query builder, fixtures, or RPC handlers) and re-run.

- [ ] **Step 3: Run full test suite to ensure no regressions**

Run: `npm run test:ci`
Expected: All existing tests still pass

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/lib/mock/mock-integration.test.ts
git commit -m "test(mock): add integration tests verifying services work with mock client"
```

---

## Task 9: Documentation Updates

**Files:**

- Modify: `CLAUDE.md`
- Modify: `TAREAS.md`

- [ ] **Step 1: Add step 6.5 to CLAUDE.md Task Workflow**

In the `### Task Workflow` section, after step 6 (TDD line), add:

```
7. **Mock data verification**: If the task adds or modifies a service function or Supabase query, verify that the mock system handles the new operation. Add mock RPC handlers, fixtures, or query builder support as needed. Run the app with `EXPO_PUBLIC_USE_MOCKS=true` to confirm the flow works without Supabase
```

And renumber subsequent steps (old 7→8, old 8→9, old 9→10, old 10→11).

Also add to the `## Commands` section under `# Dev`:

```bash
# Mock mode (no Supabase required)
EXPO_PUBLIC_USE_MOCKS=true npm start  # Dev server with mock data
```

Add to `## Project Structure` under `src/`:

```
├── lib/
│   ├── mock/              # Mock Supabase client (EXPO_PUBLIC_USE_MOCKS=true)
│   │   ├── index.ts       # Re-exports createMockClient
│   │   ├── mock-client.ts # Mock SupabaseClient assembly + RPC handlers
│   │   ├── mock-query-builder.ts  # Chaining query builder over in-memory Maps
│   │   ├── mock-store.ts  # In-memory Maps for all tables
│   │   ├── mock-auth.ts   # Mock auth (session, signIn, signOut)
│   │   ├── mock-storage.ts # Mock storage (upload no-op, placeholder URLs)
│   │   └── fixtures.ts    # Seed data (profiles, groups, matches, etc.)
```

- [ ] **Step 2: Add mock system task to TAREAS.md**

Add under Phase 0 (or whichever phase is appropriate), mark as complete:

```
- [x] **F0-13** Mock Supabase system for offline development
  - Criteria: App runs with `EXPO_PUBLIC_USE_MOCKS=true` without network/Docker, all existing service functions work against mock data
  - Effort: 6h
  - Depends: F0-02 (Supabase), F1-17 (predictions)
```

- [ ] **Step 3: Run pre-commit checks**

Run: `npm run format:check && npm run lint && npm run typecheck && npm run test:ci`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md TAREAS.md
git commit -m "docs: add mock system to workflow, commands, and task tracking"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Run full pre-commit pipeline**

```bash
npm run format:check && npm run lint && npm run typecheck && npm run test:ci
```

Expected: All pass with no new errors.

- [ ] **Step 2: Verify mock module paths resolve**

```bash
npx jest --testPathPattern="mock" --no-coverage --verbose
```

Expected: All mock tests (query-builder, auth, integration) pass.

- [ ] **Step 3: Verify the app starts in mock mode** (manual)

Set `EXPO_PUBLIC_USE_MOCKS=true` in `.env`, run `npm start`, and confirm the app launches without Supabase errors. Navigate through groups, matches, and predictions screens to verify data renders.
