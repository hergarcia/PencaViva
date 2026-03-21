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
};

export function useGroupLeaderboard(
  groupId: string | null,
): UseGroupLeaderboardResult {
  const { isInitialized } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

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
        setEntries(data);
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

  // Initial fetch + re-fetch on groupId change
  useEffect(() => {
    cancelledRef.current = false;

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

  return { entries, isLoading, error, refetch };
}
