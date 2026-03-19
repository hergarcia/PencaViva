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
  predictions: (row) =>
    (row.id as string | undefined) ?? predictionCompositeKey(row),
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
