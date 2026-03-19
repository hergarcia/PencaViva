// src/__tests__/lib/mock/mock-query-builder.test.ts
import { MockQueryBuilder } from "@lib/mock/mock-query-builder";
import { createMockStore, type MockStore } from "@lib/mock/mock-store";
import {
  MOCK_USER_ID,
  MOCK_GROUP_IDS,
  MOCK_MATCH_IDS,
  MOCK_TOURNAMENT_ID,
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
