import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@hooks/use-auth";
import { supabase } from "@lib/supabase";
import {
  fetchGroupLeaderboardFiltered,
  type LeaderboardEntry,
  type LeaderboardFilter,
} from "@lib/leaderboard-service";

type UseGroupLeaderboardResult = {
  entries: LeaderboardEntry[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  positionChanges: Record<string, number>;
};

export function useGroupLeaderboard(
  groupId: string | null,
  filter: LeaderboardFilter = "overall",
): UseGroupLeaderboardResult {
  const { isInitialized } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positionChanges, setPositionChanges] = useState<
    Record<string, number>
  >({});
  const cancelledRef = useRef(false);
  const prevPositionsRef = useRef<Record<string, number>>({});

  const loadLeaderboard = useCallback(
    async (opts?: { isRefresh?: boolean }) => {
      if (!groupId) {
        setIsLoading(false);
        setEntries([]);
        return;
      }

      if (opts?.isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const data = await fetchGroupLeaderboardFiltered(groupId, filter);
        if (!cancelledRef.current) {
          // Compute position changes
          const prev = prevPositionsRef.current;
          const changes: Record<string, number> = {};
          if (Object.keys(prev).length > 0) {
            for (const entry of data) {
              const oldPos = prev[entry.user_id];
              if (oldPos !== undefined && oldPos !== entry.position) {
                changes[entry.user_id] = oldPos - entry.position;
              }
            }
          }

          // Update prev positions for next comparison
          const newPositions: Record<string, number> = {};
          for (const entry of data) {
            newPositions[entry.user_id] = entry.position;
          }
          prevPositionsRef.current = newPositions;

          setEntries(data);
          setPositionChanges(changes);
        }
      } catch (err: unknown) {
        if (!cancelledRef.current) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelledRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [groupId, filter],
  );

  // Reset position tracking when groupId or filter changes
  useEffect(() => {
    prevPositionsRef.current = {};
    setPositionChanges({});
  }, [groupId, filter]);

  // Initial fetch + re-fetch on groupId/filter change
  useEffect(() => {
    cancelledRef.current = false;

    if (!isInitialized) return;

    loadLeaderboard();

    return () => {
      cancelledRef.current = true;
    };
  }, [isInitialized, loadLeaderboard]);

  // Realtime subscription: only for overall filter
  useEffect(() => {
    if (!groupId || !isInitialized || filter !== "overall") return;

    const channel = supabase
      .channel(`leaderboard:${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leaderboard_cache",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          loadLeaderboard();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, isInitialized, filter, loadLeaderboard]);

  const refetch = useCallback(async () => {
    cancelledRef.current = false;
    await loadLeaderboard({ isRefresh: true });
  }, [loadLeaderboard]);

  return { entries, isLoading, isRefreshing, error, refetch, positionChanges };
}
