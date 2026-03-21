import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@hooks/use-auth";
import { supabase } from "@lib/supabase";
import { fetchGroupLeaderboard } from "@lib/leaderboard-service";
import type { LeaderboardEntry } from "@lib/leaderboard-service";

type UseGroupLeaderboardResult = {
  entries: LeaderboardEntry[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  positionChanges: Record<string, number>;
};

export function useGroupLeaderboard(
  groupId: string | null,
): UseGroupLeaderboardResult {
  const { isInitialized } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [positionChanges, setPositionChanges] = useState<
    Record<string, number>
  >({});
  const cancelledRef = useRef(false);
  // Track previous positions to compute change indicators for animations
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
      const data = await fetchGroupLeaderboard(groupId);
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
  }, [groupId]);

  // Initial fetch + re-fetch on groupId change; reset position history on change
  useEffect(() => {
    cancelledRef.current = false;
    prevPositionsRef.current = new Map(); // reset position history on group change
    setPositionChanges({});

    if (!isInitialized) return;

    loadLeaderboard();

    return () => {
      cancelledRef.current = true;
    };
  }, [isInitialized, loadLeaderboard]);

  // Realtime subscription: auto-refresh when leaderboard_cache changes
  useEffect(() => {
    if (!groupId || !isInitialized) return;

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
  }, [groupId, isInitialized, loadLeaderboard]);

  const refetch = useCallback(async () => {
    cancelledRef.current = false;
    await loadLeaderboard();
  }, [loadLeaderboard]);

  return { entries, isLoading, error, refetch, positionChanges };
}
