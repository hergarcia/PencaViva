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
  // INSERT groups
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      created_by: userId,
      scoring_system: input.scoring_system,
      max_members: 50,
      is_public: false,
    })
    .select("id, name, invite_code")
    .single();
  if (groupError) throw groupError;

  // INSERT group_members (creator as admin)
  // NOTE: group_tournaments RLS uses get_user_admin_group_ids() which queries
  // group_members. This group_members row is inserted first, so the subsequent
  // group_tournaments INSERT will see it and pass the admin check.
  const { error: memberError } = await supabase.from("group_members").insert({
    group_id: group.id,
    user_id: userId,
    role: "admin" as GroupRole,
    is_active: true,
  });
  if (memberError) throw memberError;

  // INSERT group_tournaments (optional)
  if (input.tournament_ids && input.tournament_ids.length > 0) {
    const rows = input.tournament_ids.map((tid) => ({
      group_id: group.id,
      tournament_id: tid,
    }));
    const { error: tournamentError } = await supabase
      .from("group_tournaments")
      .insert(rows);
    if (tournamentError) throw tournamentError;
  }

  return group;
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
