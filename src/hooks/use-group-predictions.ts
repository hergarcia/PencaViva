import { useState, useEffect, useCallback, useRef } from "react";
import { fetchGroupPredictions } from "@lib/prediction-service";
import type { GroupPrediction } from "@lib/prediction-service";
import type { MatchStatus } from "@lib/matches-service";

type UseGroupPredictionsResult = {
  predictions: GroupPrediction[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const LIVE_REFETCH_INTERVAL_MS = 30_000;

export function useGroupPredictions(
  matchId: string | undefined,
  groupId: string | undefined,
  matchStatus: MatchStatus | undefined,
): UseGroupPredictionsResult {
  const [predictions, setPredictions] = useState<GroupPrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const isEnabled =
    !!matchId &&
    !!groupId &&
    (matchStatus === "live" || matchStatus === "finished");

  const loadData = useCallback(async () => {
    if (!matchId || !groupId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchGroupPredictions(matchId, groupId);
      if (!cancelledRef.current) {
        setPredictions(data);
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
  }, [matchId, groupId]);

  useEffect(() => {
    cancelledRef.current = false;

    if (!isEnabled) {
      setPredictions([]);
      setIsLoading(false);
      return;
    }

    loadData();

    // Refetch every 30s during live matches
    let intervalId: ReturnType<typeof setInterval> | undefined;
    if (matchStatus === "live") {
      intervalId = setInterval(loadData, LIVE_REFETCH_INTERVAL_MS);
    }

    return () => {
      cancelledRef.current = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [isEnabled, matchStatus, loadData]);

  const refetch = useCallback(async () => {
    cancelledRef.current = false;
    await loadData();
  }, [loadData]);

  return { predictions, isLoading, error, refetch };
}
