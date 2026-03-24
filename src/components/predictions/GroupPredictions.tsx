import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { colors } from "@lib/constants";
import { useGroupPredictions } from "@hooks/use-group-predictions";
import {
  calculatePotentialPoints,
  getPredictionStatus,
} from "@lib/scoring-utils";
import { PredictionRow } from "@components/predictions/PredictionRow";
import type { MatchStatus } from "@lib/matches-service";
import type { ScoringSystem } from "@lib/groups-service";
import type { GroupPrediction } from "@lib/prediction-service";
import type { PredictionStatus as PredStatus } from "@lib/scoring-utils";

type GroupPredictionsProps = {
  matchId: string;
  groupId: string;
  matchStatus: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  currentUserId: string;
  scoringSystem: ScoringSystem;
};

type EnrichedPrediction = {
  prediction: GroupPrediction;
  status: PredStatus | null;
  potentialPoints: number | null;
  rank: number | null;
};

export function GroupPredictions({
  matchId,
  groupId,
  matchStatus,
  homeScore,
  awayScore,
  currentUserId,
  scoringSystem,
}: GroupPredictionsProps) {
  const { predictions, isLoading, error } = useGroupPredictions(
    matchId,
    groupId,
    matchStatus,
  );

  // Don't render for non-live/finished matches
  if (matchStatus !== "live" && matchStatus !== "finished") return null;

  // Guard: hide if scores are null during live (shouldn't happen)
  if (homeScore === null || awayScore === null) return null;

  const isFinished = matchStatus === "finished";
  const sectionTitle = isFinished ? "GROUP RANKINGS" : "GROUP PREDICTIONS";

  if (isLoading) {
    return (
      <View style={{ marginTop: 28, alignItems: "center" }}>
        <ActivityIndicator
          testID="group-predictions-loading"
          size="small"
          color={colors.primary}
        />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ marginTop: 28, alignItems: "center" }}>
        <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text>
      </View>
    );
  }

  if (predictions.length === 0) {
    return (
      <View style={{ marginTop: 28, alignItems: "center" }}>
        <Text
          testID="group-predictions-empty"
          style={{ color: colors.textSecondary, fontSize: 14 }}
        >
          No one predicted this match yet
        </Text>
      </View>
    );
  }

  // Enrich predictions with status and points
  const enriched: EnrichedPrediction[] = predictions.map((p) => {
    if (p.homeScorePred === null || p.awayScorePred === null) {
      return { prediction: p, status: null, potentialPoints: null, rank: null };
    }

    const status = getPredictionStatus(
      p.homeScorePred,
      p.awayScorePred,
      homeScore,
      awayScore,
    );

    const points = isFinished
      ? (p.points ?? 0)
      : calculatePotentialPoints(
          p.homeScorePred,
          p.awayScorePred,
          homeScore,
          awayScore,
          scoringSystem,
        );

    return { prediction: p, status, potentialPoints: points, rank: null };
  });

  // Sort: predictions first (by points desc, then name), no-predictions last
  enriched.sort((a, b) => {
    const aHas = a.prediction.homeScorePred !== null;
    const bHas = b.prediction.homeScorePred !== null;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    if (!aHas && !bHas) {
      return a.prediction.displayName.localeCompare(b.prediction.displayName);
    }

    const pointsDiff = (b.potentialPoints ?? 0) - (a.potentialPoints ?? 0);
    if (pointsDiff !== 0) return pointsDiff;
    return a.prediction.displayName.localeCompare(b.prediction.displayName);
  });

  // Assign ranks (only for finished, standard ranking — skip on ties)
  if (isFinished) {
    let currentRank = 1;
    for (let i = 0; i < enriched.length; i++) {
      if (enriched[i].prediction.homeScorePred === null) {
        enriched[i].rank = null; // no prediction = no rank
        continue;
      }
      if (
        i > 0 &&
        enriched[i].potentialPoints === enriched[i - 1].potentialPoints &&
        enriched[i - 1].rank !== null
      ) {
        enriched[i].rank = enriched[i - 1].rank;
      } else {
        enriched[i].rank = currentRank;
      }
      currentRank = i + 2; // next potential rank (standard ranking skips)
    }
  }

  return (
    <View testID="group-predictions-section" style={{ marginTop: 28 }}>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 10,
        }}
      >
        {sectionTitle}
      </Text>

      {enriched.map((item) => (
        <PredictionRow
          key={item.prediction.userId}
          prediction={item.prediction}
          rank={item.rank}
          status={item.status}
          potentialPoints={item.potentialPoints}
          isCurrentUser={item.prediction.userId === currentUserId}
          isFinished={isFinished}
        />
      ))}
    </View>
  );
}
