import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@hooks/use-auth";
import { fetchMatchDetail, savePrediction } from "@lib/prediction-service";
import type { MatchDetail, ExistingPrediction } from "@lib/prediction-service";

function isRLSError(message: string): boolean {
  return message.toLowerCase().includes("row-level security");
}

type UseMatchDetailResult = {
  match: MatchDetail | null;
  prediction: ExistingPrediction | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  save: (home: number, away: number) => Promise<boolean>;
  isSaving: boolean;
  saveError: string | null;
  isLockedByServer: boolean;
};

export function useMatchDetail(
  matchId: string | undefined,
  groupId: string | null,
): UseMatchDetailResult {
  const { user, isInitialized } = useAuth();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [prediction, setPrediction] = useState<ExistingPrediction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLockedByServer, setIsLockedByServer] = useState(false);
  const cancelledRef = useRef(false);

  const loadData = useCallback(async () => {
    if (!user?.id || !matchId || !groupId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsLockedByServer(false); // reset on every load/refetch

    try {
      const result = await fetchMatchDetail(matchId, groupId, user.id);
      if (!cancelledRef.current) {
        setMatch(result.match);
        setPrediction(result.prediction);
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
  }, [matchId, groupId, user?.id]);

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

  const save = useCallback(
    async (home: number, away: number): Promise<boolean> => {
      if (!user?.id || !matchId || !groupId) return false;

      const previousPrediction = prediction; // capture for rollback

      // Optimistic update — show result immediately before network call
      setPrediction({
        id: "optimistic",
        home_score_pred: home,
        away_score_pred: away,
      });
      setIsSaving(true);
      setSaveError(null);

      try {
        await savePrediction(matchId, groupId, user.id, home, away);
        // Deferred background refetch to replace fake optimistic ID with real DB row
        setTimeout(() => refetch(), 0);
        return true;
      } catch (err: unknown) {
        // Rollback to previous state
        setPrediction(previousPrediction);
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (isRLSError(msg)) {
          setSaveError(
            "Predictions are locked — the match has already started.",
          );
          setIsLockedByServer(true);
        } else {
          setSaveError(msg);
        }
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [matchId, groupId, user?.id, prediction, refetch],
  );

  return {
    match,
    prediction,
    isLoading,
    error,
    refetch,
    save,
    isSaving,
    saveError,
    isLockedByServer,
  };
}
