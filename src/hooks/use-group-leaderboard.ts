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
  const [error, setError] = useState<string | null>(null);
  const [positionChanges, setPositionChanges] = useState<
    Record<string, number>
  >({});
  const cancelledRef = useRef(false);
  // Track previous positions to compute change indicators
  const prevPositionsRef = useRef<Map<string, number>>(new Map());

  const loadLeaderboard = useCallback(async () => {
    if (!groupId) {
      setIsLoading(false);
      setEntries([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchGroupLeaderboardFiltered(groupId, filter);
      if (!cancelledRef.current) {
        // Compute position changes vs previous snapshot
        const changes: Record<string, number> = {};
        if (prevPositionsRef.current.size > 0) {
          for (const entry of data) {
            const prev = prevPositionsRef.current.get(entry.user_id);
            if (prev !== undefined) {
              const change = prev - entry.position; // positive = moved up
              if (change !== 0) changes[entry.user_id] = change;
            }
          }
        }

        // Update previous positions snapshot
        prevPositionsRef.current = new Map(
          data.map((e) => [e.user_id, e.position]),
        );

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
      }
    }
  }, [groupId, filter]);

  // Initial fetch + re-fetch on groupId/filter change; reset position history on change
  useEffect(() => {
    cancelledRef.current = false;
    prevPositionsRef.current = new Map(); // reset when group or filter changes
    setPositionChanges({});

    if (!isInitialized) return;

    loadLeaderboard();

    return () => {
      cancelledRef.current = true;
    };
  }, [isInitialized, loadLeaderboard]);

  // Realtime subscription: auto-refresh when leaderboard_cache changes (overall only)
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
    await loadLeaderboard();
  }, [loadLeaderboard]);

  return { entries, isLoading, error, refetch, positionChanges };
}
