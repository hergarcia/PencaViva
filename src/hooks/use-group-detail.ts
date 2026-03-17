import { useState, useEffect } from "react";
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

  useEffect(() => {
    if (!isInitialized) return;

    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchGroupById(groupId),
      fetchGroupMembers(groupId),
      fetchGroupTournaments(groupId),
    ])
      .then(([g, m, t]) => {
        if (!cancelled) {
          setGroup(g);
          setMembers(m);
          setTournaments(t);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [groupId, user, isInitialized]);

  return { group, members, tournaments, loading, error };
}
