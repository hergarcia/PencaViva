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
