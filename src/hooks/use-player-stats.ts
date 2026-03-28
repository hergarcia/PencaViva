// src/hooks/use-player-stats.ts
import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchPlayerGroupStats,
  computeStreaks,
  type PlayerPredictionRecord,
  type StreakResult,
} from "@lib/player-stats-service";

interface UsePlayerStatsResult {
  predictions: PlayerPredictionRecord[];
  streaks: StreakResult;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const EMPTY_STREAKS: StreakResult = {
  currentStreak: { count: 0, type: "correct" },
  bestStreak: 0,
};

export function usePlayerStats(
  userId: string,
  groupId: string,
): UsePlayerStatsResult {
  const [predictions, setPredictions] = useState<PlayerPredictionRecord[]>([]);
  const [streaks, setStreaks] = useState<StreakResult>(EMPTY_STREAKS);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const load = useCallback(
    async (opts?: { isRefresh?: boolean }) => {
      if (!userId || !groupId) return;
      if (opts?.isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      cancelledRef.current = false;

      try {
        const data = await fetchPlayerGroupStats(userId, groupId);
        if (cancelledRef.current) return;

        const sorted = [...data].sort(
          (a, b) =>
            new Date(b.match.kickoff_time).getTime() -
            new Date(a.match.kickoff_time).getTime(),
        );
        setPredictions(sorted);
        setStreaks(computeStreaks(data));
      } catch (err) {
        if (cancelledRef.current) return;
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelledRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [userId, groupId],
  );

  useEffect(() => {
    load();
    return () => {
      cancelledRef.current = true;
    };
  }, [load]);

  const refetch = useCallback(async () => {
    cancelledRef.current = false;
    await load({ isRefresh: true });
  }, [load]);

  return { predictions, streaks, isLoading, isRefreshing, error, refetch };
}
