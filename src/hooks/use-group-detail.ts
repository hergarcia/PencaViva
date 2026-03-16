import { useState, useEffect } from "react";
import { useAuth } from "@hooks/use-auth";
import { fetchGroupById } from "@lib/groups-service";
import type { UserGroup } from "@lib/groups-service";

type UseGroupDetailResult = {
  group: UserGroup | null;
  loading: boolean;
  error: string | null;
};

/**
 * Hook that loads a single group by ID for the current authenticated user.
 * Guards on isInitialized (not isLoading) — isLoading is only true during
 * sign-in/sign-out operations, while isInitialized indicates auth hydration.
 */
export function useGroupDetail(groupId: string): UseGroupDetailResult {
  const { user, isInitialized } = useAuth();
  const [group, setGroup] = useState<UserGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isInitialized) return; // auth not yet hydrated

    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchGroupById(groupId)
      .then((g) => {
        if (!cancelled) {
          setGroup(g);
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

  return { group, loading, error };
}
