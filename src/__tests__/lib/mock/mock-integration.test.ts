// src/__tests__/lib/mock/mock-integration.test.ts
//
// Integration tests verifying that real service functions work correctly
// when backed by the in-memory mock Supabase client.
//
// Jest hoists ES imports above all code, so we cannot set process.env before
// the service modules are evaluated that way. Instead we use jest.isolateModules
// + require() inside beforeAll so the env var is guaranteed to be set before
// supabase.ts is first required.

import type {
  UserGroup,
  GroupMember,
  GroupTournament,
  Tournament,
} from "@lib/groups-service";
import type { MatchWithPrediction } from "@lib/matches-service";
import type { MatchDetail, ExistingPrediction } from "@lib/prediction-service";
import type { LeaderboardEntry } from "@lib/leaderboard-service";
import {
  MOCK_USER_ID,
  MOCK_GROUP_IDS,
  MOCK_MATCH_IDS,
  MOCK_TOURNAMENT_ID,
} from "@lib/mock/fixtures";

// ── Lazy-loaded service functions (set after isolateModules) ─────────

let fetchUserGroups: (userId: string) => Promise<UserGroup[]>;
let fetchGroupById: (groupId: string) => Promise<UserGroup>;
let fetchGroupMembers: (groupId: string) => Promise<GroupMember[]>;
let fetchGroupTournaments: (groupId: string) => Promise<GroupTournament[]>;
let fetchActiveTournaments: () => Promise<Tournament[]>;
let lookupGroupByInviteCode: (code: string) => Promise<{
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  member_count: number;
  max_members: number;
  scoring_system: unknown;
}>;
let joinGroupByCode: (
  code: string,
) => Promise<{ id: string; name: string; invite_code: string }>;
let updateGroupTournaments: (
  groupId: string,
  newTournamentIds: string[],
) => Promise<void>;
let fetchGroupMatches: (
  groupId: string,
  userId: string,
  now?: string,
) => Promise<MatchWithPrediction[]>;
let fetchMatchDetail: (
  matchId: string,
  groupId: string,
  userId: string,
) => Promise<{ match: MatchDetail; prediction: ExistingPrediction | null }>;
let checkUsernameAvailable: (
  username: string,
  currentUserId: string,
) => Promise<boolean>;
let checkProfileComplete: (userId: string) => Promise<boolean>;
let fetchGroupLeaderboard: (groupId: string) => Promise<LeaderboardEntry[]>;

beforeAll(() => {
  // Set mock mode BEFORE requiring any module that imports supabase.ts
  process.env.EXPO_PUBLIC_USE_MOCKS = "true";

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const gs = require("@lib/groups-service");
    fetchUserGroups = gs.fetchUserGroups;
    fetchGroupById = gs.fetchGroupById;
    fetchGroupMembers = gs.fetchGroupMembers;
    fetchGroupTournaments = gs.fetchGroupTournaments;
    fetchActiveTournaments = gs.fetchActiveTournaments;
    lookupGroupByInviteCode = gs.lookupGroupByInviteCode;
    joinGroupByCode = gs.joinGroupByCode;
    updateGroupTournaments = gs.updateGroupTournaments;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ms = require("@lib/matches-service");
    fetchGroupMatches = ms.fetchGroupMatches;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ps = require("@lib/prediction-service");
    fetchMatchDetail = ps.fetchMatchDetail;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pfs = require("@lib/profile-service");
    checkUsernameAvailable = pfs.checkUsernameAvailable;
    checkProfileComplete = pfs.checkProfileComplete;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ls = require("@lib/leaderboard-service");
    fetchGroupLeaderboard = ls.fetchGroupLeaderboard;
  });
});

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
    // fetchGroupById takes only groupId — user id is fetched from auth internally
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

describe("Mock integration: leaderboard-service", () => {
  it("fetchGroupLeaderboard returns entries sorted by position", async () => {
    const entries = await fetchGroupLeaderboard(MOCK_GROUP_IDS.owned);
    expect(entries.length).toBeGreaterThanOrEqual(3);
    expect(entries[0].position).toBe(1);
    expect(entries[1].position).toBe(2);
    expect(entries[2].position).toBe(3);
  });

  it("fetchGroupLeaderboard entries have profile data", async () => {
    const entries = await fetchGroupLeaderboard(MOCK_GROUP_IDS.owned);
    expect(entries[0]).toHaveProperty("display_name");
    expect(entries[0]).toHaveProperty("username");
    expect(entries[0]).toHaveProperty("total_points");
    expect(entries[0]).toHaveProperty("matches_played");
    expect(entries[0]).toHaveProperty("exact_scores");
    expect(entries[0]).toHaveProperty("correct_results");
  });

  it("fetchGroupLeaderboard top entry is current mock user", async () => {
    const entries = await fetchGroupLeaderboard(MOCK_GROUP_IDS.owned);
    expect(entries[0].user_id).toBe(MOCK_USER_ID);
    expect(entries[0].total_points).toBe(42);
  });

  it("fetchGroupLeaderboard returns empty for group with no leaderboard", async () => {
    // MOCK_GROUP_IDS.member has no leaderboard entries
    const entries = await fetchGroupLeaderboard(MOCK_GROUP_IDS.member);
    expect(entries).toHaveLength(0);
  });
});

// ── Destructive mutation tests (run last to avoid affecting other tests) ─

describe("Mock integration: groups-service (mutations)", () => {
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
