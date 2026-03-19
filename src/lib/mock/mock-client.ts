// src/lib/mock/mock-client.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMockStore, type TableName } from "./mock-store";
import { MockQueryBuilder } from "./mock-query-builder";
import { createMockAuth } from "./mock-auth";
import { createMockStorage } from "./mock-storage";
import { MOCK_USER_ID } from "./fixtures";

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
