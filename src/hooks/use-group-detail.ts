import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@hooks/use-auth";
import {
  fetchGroupById,
  fetchGroupMembers,
  fetchGroupTournaments,
} from "@lib/groups-service";
import type {
  UserGroup,
  GroupMember,
  GroupTournament,
} from "@lib/groups-service";

type UseGroupDetailResult = {
  group: UserGroup | null;
  members: GroupMember[];
  tournaments: GroupTournament[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

/**
 * Hook that loads a group, its members, and its assigned tournaments in parallel.
 * Guards on isInitialized (not isLoading) — isLoading is only true during
 * sign-in/sign-out operations, while isInitialized indicates auth hydration.
 */
export function useGroupDetail(groupId: string): UseGroupDetailResult {
  const { user, isInitialized } = useAuth();
  const [group, setGroup] = useState<UserGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [tournaments, setTournaments] = useState<GroupTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [g, m, t] = await Promise.all([
        fetchGroupById(groupId),
        fetchGroupMembers(groupId),
        fetchGroupTournaments(groupId),
      ]);
      if (!cancelledRef.current) {
        setGroup(g);
        setMembers(m);
        setTournaments(t);
      }
    } catch (err: unknown) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, [groupId, user]);

  useEffect(() => {
    cancelledRef.current = false;

    if (!isInitialized) return;

    loadData();

    return () => {
      cancelledRef.current = true;
    };
  }, [isInitialized, loadData]);

  const refetch = useCallback(async () => {
    cancelledRef.current = false;
    await loadData();
  }, [loadData]);

  return { group, members, tournaments, loading, error, refetch };
}
