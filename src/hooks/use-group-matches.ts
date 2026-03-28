import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@hooks/use-auth";
import { fetchGroupMatches } from "@lib/matches-service";
import type { MatchWithPrediction } from "@lib/matches-service";
import { withRetry } from "@lib/retry";
import { format, isToday, isTomorrow } from "date-fns";

// ── Types ───────────────────────────────────────────────────────────

export interface DateSection {
  title: string;
  dateKey: string;
  data: MatchWithPrediction[];
}

type UseGroupMatchesResult = {
  matches: MatchWithPrediction[];
  sections: DateSection[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

// ── Date sectioning ─────────────────────────────────────────────────

function formatSectionTitle(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
}

function groupMatchesByDate(matches: MatchWithPrediction[]): DateSection[] {
  const sectionMap = new Map<string, DateSection>();

  for (const match of matches) {
    const date = new Date(match.kickoff_time);
    const dateKey = format(date, "yyyy-MM-dd");

    if (!sectionMap.has(dateKey)) {
      sectionMap.set(dateKey, {
        title: formatSectionTitle(date),
        dateKey,
        data: [],
      });
    }
    sectionMap.get(dateKey)!.data.push(match);
  }

  return Array.from(sectionMap.values());
}

// ── Hook ────────────────────────────────────────────────────────────

export function useGroupMatches(groupId: string | null): UseGroupMatchesResult {
  const { user, isInitialized } = useAuth();
  const [matches, setMatches] = useState<MatchWithPrediction[]>([]);
  const [sections, setSections] = useState<DateSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const loadMatches = useCallback(
    async (opts?: { isRefresh?: boolean }) => {
      if (!user?.id || !groupId) {
        setIsLoading(false);
        setMatches([]);
        setSections([]);
        return;
      }

      if (opts?.isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const data = await withRetry(() => fetchGroupMatches(groupId, user.id));
        if (!cancelledRef.current) {
          setMatches(data);
          setSections(groupMatchesByDate(data));
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
    [groupId, user?.id],
  );

  useEffect(() => {
    cancelledRef.current = false;

    if (!isInitialized) return;

    loadMatches();

    return () => {
      cancelledRef.current = true;
    };
  }, [isInitialized, loadMatches]);

  const refetch = useCallback(async () => {
    cancelledRef.current = false;
    await loadMatches({ isRefresh: true });
  }, [loadMatches]);

  return { matches, sections, isLoading, isRefreshing, error, refetch };
}
