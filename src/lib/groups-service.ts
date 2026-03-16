import { supabase } from "@/lib/supabase";

// ── Types ───────────────────────────────────────────────────────────

export type GroupRole = "admin" | "moderator" | "member";

export type UserGroup = {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  invite_code: string;
  created_by: string;
  member_count: number;
  role: GroupRole;
};

export interface ScoringSystem {
  exact_score: number;
  correct_result: number;
  correct_goal_diff: number;
  wrong: number;
}

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
    role: data.role as GroupRole,
  };
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
