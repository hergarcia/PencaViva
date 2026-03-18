import { supabase } from "@/lib/supabase";

// ── Types ───────────────────────────────────────────────────────────

export type GroupRole = "admin" | "moderator" | "member";

export interface ScoringSystem {
  exact_score: number;
  correct_result: number;
  correct_goal_diff: number;
  wrong: number;
}

export type UserGroup = {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  invite_code: string;
  created_by: string;
  member_count: number;
  scoring_system: ScoringSystem;
  role: GroupRole;
};

export interface CreateGroupInput {
  name: string;
  description?: string;
  scoring_system: ScoringSystem;
  tournament_ids?: string[];
}

export interface CreatedGroup {
  id: string;
  name: string;
  invite_code: string;
}

export interface Tournament {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
}

export type GroupMember = {
  user_id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  points_total: number;
  role: GroupRole;
  joined_at: string;
};

export type GroupTournament = {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
};

// ── Supabase queries ────────────────────────────────────────────────

/**
 * Fetch all groups the user is an active member of.
 * Uses group_members as the base table, joining groups and counting members.
 * Note: member_count includes all members (active + inactive) because PostgREST
 * embedded resource counts cannot be filtered. Acceptable for MVP.
 */
export async function fetchUserGroups(userId: string): Promise<UserGroup[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select(
      `
      role,
      group:groups!inner (
        id,
        name,
        description,
        avatar_url,
        invite_code,
        created_by,
        scoring_system,
        group_members ( count )
      )
    `,
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("joined_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => {
    const group = row.group as Record<string, unknown>;
    const memberCountArr = group.group_members as { count: number }[];
    return {
      id: group.id as string,
      name: group.name as string,
      description: group.description as string | null,
      avatar_url: group.avatar_url as string | null,
      invite_code: group.invite_code as string,
      created_by: group.created_by as string,
      member_count: memberCountArr?.[0]?.count ?? 0,
      scoring_system: group.scoring_system as ScoringSystem,
      role: row.role as GroupRole,
    };
  });
}

/**
 * Create a new group owned by userId, optionally linking tournaments.
 * Inserts group → adds creator as admin member → links tournaments.
 */
export async function createGroup(
  userId: string,
  input: CreateGroupInput,
): Promise<CreatedGroup> {
  // Use SECURITY DEFINER RPC to avoid RLS issues with ES256 JWT tokens
  const { data, error } = await supabase.rpc("create_group_for_user", {
    p_name: input.name.trim(),
    p_description: input.description?.trim() || null,
    p_scoring_system: input.scoring_system,
    p_tournament_ids:
      input.tournament_ids && input.tournament_ids.length > 0
        ? input.tournament_ids
        : null,
  });
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Failed to create group");
  return data[0] as CreatedGroup;
}

/**
 * Fetch a single group by ID for the authenticated user.
 * Uses the same group:groups!inner alias as fetchUserGroups.
 * RLS is enforced implicitly — only members can load a group.
 */
export async function fetchGroupById(groupId: string): Promise<UserGroup> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("group_members")
    .select(
      `
      role,
      group:groups!inner (
        id,
        name,
        description,
        avatar_url,
        invite_code,
        created_by,
        scoring_system,
        group_members ( count )
      )
    `,
    )
    .eq("user_id", user.id)
    .eq("group_id", groupId)
    .eq("is_active", true)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Group not found");

  const g = data.group as unknown as Record<string, unknown>;
  const memberCountArr = g.group_members as { count: number }[];
  return {
    id: g.id as string,
    name: g.name as string,
    description: g.description as string | null,
    avatar_url: g.avatar_url as string | null,
    invite_code: g.invite_code as string,
    created_by: g.created_by as string,
    member_count: memberCountArr?.[0]?.count ?? 0,
    scoring_system: g.scoring_system as ScoringSystem,
    role: data.role as GroupRole,
  };
}

const ROLE_ORDER: Record<string, number> = {
  admin: 0,
  moderator: 1,
  member: 2,
};

/**
 * Fetch all active members of a group, joined with their profile data.
 * Sorted admin → moderator → member, then joined_at ascending.
 * RLS allows members to query group_members for their own groups.
 */
export async function fetchGroupMembers(
  groupId: string,
): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select(
      `
      user_id,
      role,
      joined_at,
      profile:profiles!user_id (
        display_name,
        username,
        avatar_url,
        points_total
      )
    `,
    )
    .eq("group_id", groupId)
    .eq("is_active", true);

  if (error) throw error;

  type RawMember = {
    user_id: string;
    role: string;
    joined_at: string;
    profile: {
      display_name: string;
      username: string;
      avatar_url: string | null;
      points_total: number;
    };
  };

  return ((data ?? []) as unknown as RawMember[])
    .map((row) => ({
      user_id: row.user_id,
      display_name: row.profile.display_name,
      username: row.profile.username,
      avatar_url: row.profile.avatar_url,
      points_total: row.profile.points_total,
      role: row.role as GroupRole,
      joined_at: row.joined_at,
    }))
    .sort((a, b) => {
      const roleDiff = (ROLE_ORDER[a.role] ?? 2) - (ROLE_ORDER[b.role] ?? 2);
      if (roleDiff !== 0) return roleDiff;
      return a.joined_at.localeCompare(b.joined_at);
    });
}

/**
 * Fetch tournaments assigned to a group, ordered by when they were added.
 * RLS allows group members to query group_tournaments.
 */
export async function fetchGroupTournaments(
  groupId: string,
): Promise<GroupTournament[]> {
  const { data, error } = await supabase
    .from("group_tournaments")
    .select(
      `
      tournament:tournaments!tournament_id (
        id,
        name,
        short_name,
        logo_url
      )
    `,
    )
    .eq("group_id", groupId)
    .order("added_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => {
    return row.tournament as GroupTournament;
  });
}

export interface GroupPreview {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  member_count: number;
  max_members: number;
  scoring_system: ScoringSystem;
}

/**
 * Look up a group by its 8-character invite code.
 * Returns a preview with group info, member count, and scoring.
 * SECURITY DEFINER RPC — bypasses RLS so non-members can preview.
 */
export async function lookupGroupByInviteCode(
  code: string,
): Promise<GroupPreview> {
  if (code.length !== 8) {
    throw new Error("Invite code must be exactly 8 characters");
  }
  const { data, error } = await supabase.rpc("lookup_group_by_invite_code", {
    p_invite_code: code.toUpperCase(),
  });
  if (error) throw new Error(error.message);
  // RETURNS TABLE RPCs return an array — take the first row
  const rows = data as GroupPreview[];
  if (!rows || rows.length === 0) throw new Error("group_not_found");
  return rows[0];
}

/**
 * Join a group by its 8-character invite code.
 * Atomically validates membership capacity and inserts the user.
 * SECURITY DEFINER RPC — handles all validation server-side.
 */
export async function joinGroupByCode(code: string): Promise<CreatedGroup> {
  if (code.length !== 8) {
    throw new Error("Invite code must be exactly 8 characters");
  }
  const { data, error } = await supabase.rpc("join_group_by_code", {
    p_invite_code: code.toUpperCase(),
  });
  if (error) throw new Error(error.message);
  // RETURNS TABLE RPCs return an array — take the first row
  const rows = data as CreatedGroup[];
  if (!rows || rows.length === 0) throw new Error("Failed to join group");
  return rows[0];
}

/**
 * Fetch all active tournaments for display in the group creation form.
 */
export async function fetchActiveTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, short_name, logo_url")
    .eq("status", "active")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

/**
 * Update the tournaments assigned to a group by diffing current vs desired.
 * Deletes removed tournaments and inserts new ones.
 * RLS enforces admin-only access on group_tournaments INSERT/DELETE.
 */
export async function updateGroupTournaments(
  groupId: string,
  newTournamentIds: string[],
): Promise<void> {
  const current = await fetchGroupTournaments(groupId);
  const currentIds = new Set(current.map((t) => t.id));
  const newIds = new Set(newTournamentIds);

  const toRemove = [...currentIds].filter((id) => !newIds.has(id));
  const toAdd = [...newIds].filter((id) => !currentIds.has(id));

  if (toRemove.length === 0 && toAdd.length === 0) return;

  const operations: Promise<void>[] = [];

  if (toRemove.length > 0) {
    operations.push(
      (async () => {
        const { error } = await supabase
          .from("group_tournaments")
          .delete()
          .eq("group_id", groupId)
          .in("tournament_id", toRemove);
        if (error) throw error;
      })(),
    );
  }

  if (toAdd.length > 0) {
    operations.push(
      (async () => {
        const { error } = await supabase
          .from("group_tournaments")
          .insert(
            toAdd.map((tid) => ({ group_id: groupId, tournament_id: tid })),
          );
        if (error) throw error;
      })(),
    );
  }

  await Promise.all(operations);
}
