import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@hooks/use-auth";
import { fetchUserGroups } from "@lib/groups-service";
import type { UserGroup } from "@lib/groups-service";
import { withRetry } from "@lib/retry";

type UseUserGroupsResult = {
  groups: UserGroup[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useUserGroups(): UseUserGroupsResult {
  const { user, isInitialized } = useAuth();
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const load = useCallback(
    async (opts?: { isRefresh?: boolean }) => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      if (opts?.isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const data = await withRetry(() => fetchUserGroups(user.id));
        if (!cancelledRef.current) setGroups(data);
      } catch (err: unknown) {
        if (!cancelledRef.current) {
          setError(
            err instanceof Error ? err.message : "Failed to load groups.",
          );
        }
      } finally {
        if (!cancelledRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [user?.id],
  );

  useEffect(() => {
    cancelledRef.current = false;
    if (!isInitialized) return;
    load();
    return () => {
      cancelledRef.current = true;
    };
  }, [isInitialized, load]);

  const refetch = useCallback(async () => {
    cancelledRef.current = false;
    await load({ isRefresh: true });
  }, [load]);

  return { groups, isLoading, isRefreshing, error, refetch };
}
